/**
 * 浏览器半侧的冒烟测试：在 Node 的 vm 里造一个假的 `window.__ModuleLoader__`
 * 与假的 `react`，验证外壳形态、导出面、槽位注册与组件首次渲染都不抛错。
 *
 * 这不是真实浏览器渲染的替代品 —— 只能证明「模块表外壳 + apply + 注册 + 首帧」这条链路。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const CODE = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

function loadBundle(extraGlobals = {}) {
  let captured = null
  const sandbox = { window: { __ModuleLoader__: { load: (def) => { captured = def } } }, console, ...extraGlobals }
  vm.createContext(sandbox)
  vm.runInContext(CODE, sandbox, { filename: 'lib/client.js' })
  assert.ok(captured !== null, '加载外壳应向 window.__ModuleLoader__ 注册 factory')
  return captured
}

/** 最小 React 替身：JSX 走 classic transform，只会用到 createElement。 */
function reactStub() {
  return {
    createElement(type, props, ...children) {
      return { type, props: { ...(props ?? {}), children } }
    },
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useEffect() {},
  }
}

test('client 外壳: id 必须是 npm 包名，且只注册一个 factory', () => {
  const def = loadBundle()
  assert.equal(def.id, '@local/dsh-send-timestamp')
  assert.equal(typeof def.factory, 'function')
})

test('client 导出面: inject 只声明必然存在的 slots', () => {
  const def = loadBundle()
  const mod = def.factory((name) => {
    if (name === 'react') return reactStub()
    throw new Error(`unexpected require: ${name}`)
  })
  assert.equal(JSON.stringify(mod.inject), JSON.stringify(['slots']))
  assert.equal(typeof mod.apply, 'function')
})

test('client apply: 注册进 conversation.input.right 且不带 configForms（缺失时不 park）', () => {
  const def = loadBundle()
  const mod = def.factory((name) => {
    if (name === 'react') return reactStub()
    throw new Error(`unexpected require: ${name}`)
  })
  let registered = null
  const injected = []
  const ctx = {
    effect(cb) {
      return cb()
    },
    inject(deps, cb) {
      injected.push(deps)
      // 刻意不调用 cb：模拟 settings 服务缺席，插件必须不抛错。
    },
    slots: {
      inject(key, cb) {
        assert.equal(key, 'conversation.input.right')
        cb()
        return () => {}
      },
      register(definition, Component) {
        registered = { definition, Component }
        return () => {}
      },
    },
  }
  mod.apply(ctx)
  assert.ok(registered !== null, '应注册一条槽位条目')
  assert.equal(registered.definition.id, 'send-timestamp')
  assert.equal(registered.definition.order, 20)
  // 跨 vm 上下文的数组原型不同，deepStrictEqual 会因原型不等而失败，故比 JSON。
  assert.equal(JSON.stringify(injected), JSON.stringify([['configForms'], ['settingsScope']]))
})

test('client 组件: 首帧渲染出 role=switch 的按钮，且设置服务缺席时仍可点击', () => {
  const def = loadBundle()
  const mod = def.factory((name) => {
    if (name === 'react') return reactStub()
    throw new Error(`unexpected require: ${name}`)
  })
  let registered = null
  const ctx = {
    effect: (cb) => cb(),
    inject: () => {},
    slots: {
      inject: (_key, cb) => {
        cb()
        return () => {}
      },
      register: (definition, Component) => {
        registered = { definition, Component }
        return () => {}
      },
    },
  }
  mod.apply(ctx)
  const tree = registered.Component()
  assert.equal(tree.type, 'button')
  assert.equal(tree.props.role, 'switch')
  assert.equal(tree.props['aria-checked'], false)
  assert.equal(tree.props.className, 'dsh-send-timestamp-btn')
  assert.equal(typeof tree.props.onClick, 'function')
  // localStorage 缺席 ⇒ 开关仍可切换（写本地失败被吞掉，不抛）
  tree.props.onClick()
})

test('client 开关: 逐会话隔离 —— 在一个对话里开关不影响其他对话', () => {
  const cells = new Map()
  const fakeLocalStorage = {
    getItem: (key) => (cells.has(key) ? cells.get(key) : null),
    setItem: (key, value) => { cells.set(key, String(value)) },
    removeItem: (key) => { cells.delete(key) },
  }
  const def = loadBundle({ localStorage: fakeLocalStorage })
  const mod = def.factory((name) => {
    if (name === 'react') return reactStub()
    throw new Error(`unexpected require: ${name}`)
  })
  let registered = null
  const ctx = {
    effect: (cb) => cb(),
    inject: () => {},
    slots: {
      inject: (_key, cb) => { cb(); return () => {} },
      register: (definition, Component) => { registered = { definition, Component }; return () => {} },
    },
  }
  mod.apply(ctx)

  // 每次调用都是一次全新渲染，useState 的初值函数会重新从 store 取值。
  const render = (sessionId) => registered.Component({ sessionId })

  assert.equal(render('session-a').props['aria-checked'], false)
  assert.equal(render('session-b').props['aria-checked'], false)

  render('session-a').props.onClick()
  assert.equal(render('session-a').props['aria-checked'], true, '会话 A 应当已打开')
  assert.equal(render('session-b').props['aria-checked'], false, '会话 B 必须不受影响')

  // 逐会话表写进了本地兜底存储
  assert.equal(fakeLocalStorage.getItem('dsh-send-timestamp:sessions'), JSON.stringify({ 'session-a': true }))

  // B 打开、A 关掉：两边互不干扰
  render('session-b').props.onClick()
  render('session-a').props.onClick()
  assert.equal(render('session-a').props['aria-checked'], false, '会话 A 已关掉')
  assert.equal(render('session-b').props['aria-checked'], true, '会话 B 仍开着')
  assert.equal(
    fakeLocalStorage.getItem('dsh-send-timestamp:sessions'),
    JSON.stringify({ 'session-a': false, 'session-b': true }),
  )

  // 拿不到 sessionId 时退化为全局键，不写坏逐会话表
  render(undefined).props.onClick()
  assert.equal(fakeLocalStorage.getItem('dsh-send-timestamp:enabled'), '1')
})
