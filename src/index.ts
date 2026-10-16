/**
 * Host 半侧：在 `agent/pre-step` waterfall 上，为用户真正提交的那条消息追加一枚时间戳。
 *
 * 为什么用「独立合成消息」而不是改写用户原文 —— 依据 client 侧的事件分类
 * （`dsh-client-ui-chat` 的 `messageDefinition`）：
 *   - `source.kind === 'user'`  → 归为 `user` 节点，渲染成用户气泡；
 *   - `source.kind !== 'user'`  → 经 `contextMessage()` 归为 `context` 节点。
 * 而 `isVisibleChatNode()` 对不含工具增删块的 `context` 节点返回 false，
 * 所以这条合成消息**不会出现在对话框里**，却照样 `session.append` 落库、照样送模型。
 * 官方 `@deepseek-ai/dsh-time-context` 用的正是这套机制。
 *
 * 开关是**逐会话**的：`Config.sessions[sessionId]` 优先，没设过才回落到全局 `enabled`。
 * 于是在一个对话里关掉，不会影响其他对话。
 */
import { randomUUID } from 'node:crypto'
import Schema from '@deepseek-ai/schemastery'
import { DEFAULT_PRESET, normalizePreset, stampFor, textOf, type StampPreset } from './timestamp.js'

/** Cordis 插件名（供 loader 诊断），同时也是合成消息的 `source.kind`。 */
export const name = 'send-timestamp'

/**
 * 合成消息的来源标识。**必须不是 `'user'`** —— 否则 Chat 会把它渲染成用户气泡。
 * 与插件名同值，便于在会话记录里一眼认出是谁注入的。
 */
export const SOURCE_KIND = name

/**
 * 每个字段都 `.volatile()`：设置子系统只把 volatile 字段投影成条目的表单，
 * 没有 volatile 字段的条目会被 describe() 整体跳过 —— 也就是说 client 端
 * `configForms.get('send-timestamp')` 会永远停在 unavailable。
 */
export const Config = Schema.object({
  /** 全局默认开关；某个会话没设过自己的值时用它。 */
  enabled: Schema.boolean().default(false).volatile(),
  preset: Schema.union(['time', 'monthday', 'datetime']).default(DEFAULT_PRESET).volatile(),
  /** 逐会话覆盖：`{ [sessionId]: boolean }`。只记用户真正动过开关的会话。 */
  sessions: Schema.dict(Schema.boolean()).default({}).volatile(),
})

/**
 * volatile 字段到达时是「稳定引用」（读 `.get()`），未经过设置子系统的路径
 * 可能是普通值；两种形态都要能吃下。
 */
function readLive<T>(ref: unknown, fallback: T): T {
  if (ref !== null && typeof ref === 'object' && typeof (ref as { get?: unknown }).get === 'function') {
    const value = (ref as { get: () => unknown }).get()
    return (value ?? fallback) as T
  }
  return (ref ?? fallback) as T
}

/**
 * 解析某个会话是否启用。
 *
 * 逐会话覆盖优先；该会话从没被用户动过开关时，回落到全局 `enabled`。
 * 这就是「一个对话里关了不影响其他对话」的实现点。
 *
 * @param config - 本次激活的插件配置（volatile 字段可能是引用）。
 * @param sessionId - 当前步骤所属会话 id；取不到时只能看全局值。
 */
export function isEnabledFor(config: unknown, sessionId: string | null): boolean {
  const source = config as { enabled?: unknown; sessions?: unknown } | null | undefined
  if (sessionId !== null) {
    const overrides = readLive<Record<string, unknown> | null>(source?.sessions, null)
    if (overrides !== null && typeof overrides === 'object') {
      const own = overrides[sessionId]
      if (typeof own === 'boolean') return own
    }
  }
  return readLive(source?.enabled, false)
}

/** 递归冻结。与 dsh-llm 的 `createUserMessage` 一样，在消息发布前冻结整棵子树。 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
    Object.freeze(value)
  }
  return value
}

/**
 * 铸一条只承载时间戳的合成 user 消息。
 *
 * `id` 直接用 `crypto.randomUUID()`：`@deepseek-ai/dsh-brand` 的 `brandString` 是
 * 编译期空操作（`function brandString(value) { return value }`），所以普通 UUID
 * 与 `createUserMessage` 铸出来的 id 完全等价，无需 import 任何 dsh 内部包。
 */
function stampMessage(text: string): unknown {
  return deepFreeze({
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: SOURCE_KIND, form: 'snapshot', sections: [{ name: SOURCE_KIND, text }] },
  })
}

/** 从 pre-step 载荷里取当前会话 id；取不到返回 null（此时只看全局开关）。 */
function sessionIdOf(agent: unknown): string | null {
  const session = (agent as { session?: { id?: unknown } } | null | undefined)?.session
  return typeof session?.id === 'string' ? session.id : null
}

export function apply(ctx: any, config: any): void {
  ctx.on(
    'agent/pre-step',
    async ({ agent, signal }: any, next: () => Promise<any>) => {
      const decision = await next()
      // 不拥有决策的监听器必须先 next()，并原样放行 reject / 已中止的步骤。
      if (decision?.kind === 'reject' || signal?.aborted) return decision
      // 开关与预设都在回调里读，保证拿到的是设置文档里最后一次提交的值。
      if (!isEnabledFor(config, sessionIdOf(agent))) return decision
      const preset: StampPreset = normalizePreset(readLive(config?.preset, DEFAULT_PRESET))
      // 时间必须在发送前一刻取：绝不能在模块加载或 apply 时取。
      const now = new Date()
      const messages: any[] = Array.isArray(decision.messages) ? decision.messages : []
      // 只有当这一批里真有一条「用户自己提交的」消息、且它需要打戳时，才追加合成消息。
      // 空白、纯附件、`/` 命令、末尾已有同格式时间戳的正文都会让 stampFor 返回 null。
      const stamps = messages
        .filter((message) => message?.role === 'user' && message?.source?.kind === 'user')
        .map((message) => stampFor(textOf(message.content), now, preset))
        .filter((stamp): stamp is string => stamp !== null)
      if (stamps.length === 0) return decision
      // 必须 spread：保留 startsRequestSeries 等本监听器不拥有的字段。
      // 用户的原文**一个字都不改**，时间戳作为独立 context 消息跟在后面。
      return { ...decision, messages: [...messages, stampMessage(stamps[stamps.length - 1])] }
    },
    { prepend: true },
  )
}
