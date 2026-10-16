/**
 * Host 半侧的行为测试：用假 ctx 捕获 agent/pre-step 监听器，验证
 * ① Config（含 .volatile()）能真的构建出来，默认预设为 monthday；
 * ② **用户原文一字不改**，时间戳作为一条独立合成消息追加在批次末尾；
 * ③ 合成消息的 `source.kind` 不是 'user' —— 这是它不进对话框的前提
 *    （dsh-client-ui-chat 的 isVisibleChatNode 会隐藏纯文本 context 节点）；
 * ④ 决策对象必须 spread，startsRequestSeries 等字段不丢；
 * ⑤ 空白 / 纯附件 / 斜杠命令 / 末尾已有同格式时间戳 / 本批无用户提交时都不追加。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { Config, SOURCE_KIND, apply, isEnabledFor } from '../lib/index.js'

const MD_RE = /^\[\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]$/
const DT_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

/** 捕获 ctx.on 注册的监听器，返回可直接调用的 handler。 */
function install(config) {
  const listeners = []
  const ctx = {
    on(event, handler, options) {
      listeners.push({ event, handler, options })
      return () => {}
    },
  }
  apply(ctx, config)
  assert.equal(listeners.length, 1, 'apply 应注册恰好一个监听器')
  assert.equal(listeners[0].event, 'agent/pre-step')
  return { handler: listeners[0].handler, options: listeners[0].options }
}

function decision() {
  return {
    kind: 'continue',
    startsRequestSeries: true,
    messages: [
      { id: 'm1', role: 'user', source: { kind: 'user', rpcId: 'r1' }, content: [{ type: 'text', text: '你好' }] },
      { id: 'm2', role: 'user', source: { kind: 'time-context' }, content: [{ type: 'text', text: '2024-01-02' }] },
      { id: 'm3', role: 'assistant', content: [{ type: 'text', text: '回复' }] },
    ],
  }
}

test('Config: 三个预设都能解析，默认预设与默认开关正确', () => {
  assert.equal(typeof Config, 'function')
  const get = (ref) => (ref !== null && typeof ref === 'object' && typeof ref.get === 'function' ? ref.get() : ref)
  for (const preset of ['time', 'monthday', 'datetime']) {
    assert.equal(get(Config({ enabled: true, preset }).preset), preset)
  }
  const defaults = Config({})
  assert.equal(get(defaults.enabled), false, '默认必须是关闭')
  assert.equal(get(defaults.preset), 'monthday', '默认预设必须是 monthday')
  assert.deepEqual(get(defaults.sessions), {}, '默认没有任何逐会话覆盖')
})

test('apply: 用户原文一字不改，时间戳作为独立合成消息追加在末尾', async () => {
  const { handler, options } = install({ enabled: true, preset: 'monthday' })
  assert.deepEqual(options, { prepend: true })
  const input = decision()
  const out = await handler({ signal: { aborted: false } }, async () => input)

  assert.equal(out.kind, 'continue')
  assert.equal(out.startsRequestSeries, true, '必须 spread 决策对象')

  // 用户原文与引用都不变 —— 这是「气泡里不显示」的根本保证
  assert.equal(out.messages[0], input.messages[0])
  assert.equal(out.messages[0].content[0].text, '你好')

  // 末尾恰好多出一条合成消息
  assert.equal(out.messages.length, input.messages.length + 1)
  const stamp = out.messages[out.messages.length - 1]
  assert.match(stamp.content[0].text, MD_RE)
  assert.equal(stamp.role, 'user')
  assert.equal(stamp.source.kind, SOURCE_KIND)
  assert.notEqual(stamp.source.kind, 'user', 'source.kind 不能是 user，否则会被渲染成用户气泡')
  assert.ok(typeof stamp.id === 'string' && stamp.id.length > 0, '合成消息必须带 id')
  assert.ok(Object.isFrozen(stamp), '合成消息应当在发布前被冻结')

  // 其它消息原样保留（同引用）
  assert.equal(out.messages[1], input.messages[1])
  assert.equal(out.messages[2], input.messages[2])
})

test('apply: 关闭时原样返回决策对象', async () => {
  const { handler } = install({ enabled: false, preset: 'monthday' })
  const input = decision()
  const out = await handler({ signal: { aborted: false } }, async () => input)
  assert.equal(out, input)
})

test('apply: 斜杠命令、已含时间戳的正文、纯附件都不追加', async () => {
  const { handler } = install({ enabled: true, preset: 'time' })
  const input = {
    kind: 'continue',
    messages: [
      { id: 's', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '/help' }] },
      { id: 'd', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '你好 [10:23:45]' }] },
      { id: 'e', role: 'user', source: { kind: 'user' }, content: [{ type: 'image', data: 'x' }] },
    ],
  }
  const out = await handler({ signal: { aborted: false } }, async () => input)
  assert.equal(out, input)
})

test('apply: 本批没有用户提交的消息时不追加（例如纯插件上下文步骤）', async () => {
  const { handler } = install({ enabled: true, preset: 'monthday' })
  const input = {
    kind: 'continue',
    messages: [{ id: 'x', role: 'user', source: { kind: 'time-context' }, content: [{ type: 'text', text: 'ctx' }] }],
  }
  const out = await handler({ signal: { aborted: false } }, async () => input)
  assert.equal(out, input)
})

test('apply: 被拒绝或已中止的步骤原样放行', async () => {
  const { handler } = install({ enabled: true, preset: 'monthday' })
  const rejected = { kind: 'reject', reason: 'x' }
  assert.equal(
    await handler({ signal: { aborted: false } }, async () => rejected),
    rejected,
  )
  const input = decision()
  assert.equal(
    await handler({ signal: { aborted: true } }, async () => input),
    input,
  )
})

test('apply: datetime 预设生成 YYYY-MM-DD HH:mm:ss', async () => {
  const { handler } = install({ enabled: true, preset: 'datetime' })
  const out = await handler({ signal: { aborted: false } }, async () => decision())
  assert.match(out.messages[out.messages.length - 1].content[0].text, DT_RE)
})

test('apply: 缺省 preset 回落到 monthday', async () => {
  const { handler } = install({ enabled: true })
  const out = await handler({ signal: { aborted: false } }, async () => decision())
  assert.match(out.messages[out.messages.length - 1].content[0].text, MD_RE)
})

test('isEnabledFor: 逐会话覆盖优先，未覆盖时回落全局', () => {
  // 只设了全局开
  assert.equal(isEnabledFor({ enabled: true, sessions: {} }, 'A'), true)
  // A 被显式关掉 —— B 不受影响，这就是「分对话」的核心
  assert.equal(isEnabledFor({ enabled: true, sessions: { A: false } }, 'A'), false)
  assert.equal(isEnabledFor({ enabled: true, sessions: { A: false } }, 'B'), true)
  // A 被显式打开，而全局是关
  assert.equal(isEnabledFor({ enabled: false, sessions: { A: true } }, 'A'), true)
  assert.equal(isEnabledFor({ enabled: false, sessions: { A: true } }, 'B'), false)
  // 取不到会话 id 时只能看全局
  assert.equal(isEnabledFor({ enabled: true, sessions: { A: false } }, null), true)
  // 缺字段 / 完全没有配置
  assert.equal(isEnabledFor({}, 'A'), false)
  assert.equal(isEnabledFor(undefined, 'A'), false)
  assert.equal(isEnabledFor(null, null), false)
})

test('apply: 一个会话关掉不影响另一个会话', async () => {
  const config = { enabled: true, preset: 'monthday', sessions: { 'session-a': false } }
  const { handler } = install(config)
  const payloadFor = (id) => ({ agent: { session: { id } }, turn: 1, step: 1, signal: { aborted: false } })

  const a = decision()
  assert.equal(await handler(payloadFor('session-a'), async () => a), a, '会话 A 关着，必须原样返回')

  const b = decision()
  const out = await handler(payloadFor('session-b'), async () => b)
  assert.equal(out.messages.length, b.messages.length + 1, '会话 B 没被关，应当照常注入')
})

test('apply: 会话 id 取不到时回落全局开关', async () => {
  const { handler } = install({ enabled: true, preset: 'monthday', sessions: { whatever: false } })
  const out = await handler({ signal: { aborted: false } }, async () => decision())
  assert.equal(out.messages.length, 4)
})
