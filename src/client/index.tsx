/**
 * Client 半侧：在发送栏工具栏右侧注册一个「时间戳」开关按钮。
 *
 * 按钮**只负责显示和切换开关状态**：追加时间戳这件事完全由 host 端
 * `agent/pre-step` 完成 —— 客户端没有任何 pre-submit 拦截点
 * （Enter / 发送按钮 / inputActions.submit 三条入口都直接汇入
 * SessionInputShell.submit，且 ui-conversation 不暴露任何 pre-submit 钩子）。
 */
import * as React from 'react'
import en from '../../locale/en.json'
import zh from '../../locale/zh.json'
import { buttonStyle, activeStyle, focusRing, inactiveStyle } from './styles'
import { createToggleStore, type ToggleState } from './toggle'

export const name = 'dsh-send-timestamp-client'

/**
 * 只注入必然存在的 `slots`。
 *
 * 刻意**不**把 `configForms` / `settingsScope` 写进 inject：Cordis 会把「注入的
 * 服务缺失」的 fiber park 成 INACTIVE，那样整个浏览器半侧都不会激活，按钮连
 * 渲染都没有 —— 与「设置服务不可用时仍要优雅降级」冲突。二者的取舍见
 * practices.md:20：可选服务用 `ctx.inject([...], cb)` 拿到，拿不到就降级。
 */
export const inject = ['slots']

const DICTS: Record<string, Record<string, string>> = { zh, en }

/** 语言只用于选一份内置词典；不依赖任何未确证的 locale 服务 API。 */
function pickDict(): Record<string, string> {
  const lang = typeof navigator !== 'undefined' && typeof navigator.language === 'string' ? navigator.language : 'zh'
  return lang.toLowerCase().startsWith('zh') ? DICTS.zh : DICTS.en
}

function ClockIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width={13} height={13} aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.4V8.3L10.9 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function presetLabel(dict: Record<string, string>, preset: ToggleState['preset']): string {
  if (preset === 'datetime') return dict['preset.datetime']
  if (preset === 'monthday') return dict['preset.monthday']
  return dict['preset.time']
}

function createToggleButton(store: ReturnType<typeof createToggleStore>) {
  // `sessionId` 来自 session 作用域的 standard props（与 prompt-optimizer 用法一致），
  // 槽位 conversation.input.right 的 scope 就是 session，所以它总是可用。
  return function SendTimestampToggle(props?: { sessionId?: unknown }): JSX.Element {
    const sessionId = typeof props?.sessionId === 'string' ? props.sessionId : null
    // 不用 useSyncExternalStore：configForms 的 getSnapshot() 是否返回稳定引用未确证，
    // 若每次返回新对象会无限重渲染。useState + 显式订阅在任何实现下都安全。
    const [state, setState] = React.useState<ToggleState>(() => store.snapshotFor(sessionId))
    React.useEffect(() => {
      // 切会话时要立刻换成那个会话的状态，而不是沿用上一个会话的。
      setState(store.snapshotFor(sessionId))
      return store.subscribe(() => setState(store.snapshotFor(sessionId)))
    }, [sessionId])
    const dict = pickDict()
    const label = dict['button.label']
    let title = state.enabled ? dict['button.titleOn'] : dict['button.titleOff']
    title = `${title} · ${presetLabel(dict, state.preset)}`
    if (!state.available) title = `${title} · ${dict['hint.localOnly']}`
    const style: React.CSSProperties = {
      ...buttonStyle,
      ...(state.enabled ? activeStyle : inactiveStyle),
    }
    return (
      <button
        type="button"
        className="dsh-send-timestamp-btn"
        role="switch"
        aria-checked={state.enabled}
        aria-label={label}
        title={title}
        style={style}
        onFocus={(event) => {
          event.currentTarget.style.outline = `2px solid ${focusRing}`
        }}
        onBlur={(event) => {
          event.currentTarget.style.outline = 'none'
        }}
        onClick={() => {
          // 只切当前会话；其他会话的开关不受影响。
          store.setEnabledFor(sessionId, !state.enabled)
        }}
      >
        <ClockIcon />
        <span>{label}</span>
      </button>
    )
  }
}

export function apply(ctx: any): void {
  const store = createToggleStore(ctx)
  ctx.effect(() => () => store.dispose())
  // 可选依赖：官方 configForms 优先，第三方 settingsScope 作兼容；都没有就走 localStorage。
  ctx.inject(['configForms'], (scopeCtx: any) => {
    store.attach('configForms', scopeCtx.configForms)
  })
  ctx.inject(['settingsScope'], (scopeCtx: any) => {
    store.attach('settingsScope', scopeCtx.settingsScope)
  })
  ctx.slots.inject('conversation.input.right', () =>
    ctx.slots.register(
      {
        name: 'conversation.input.right',
        // 该槽 kind = list ⇒ id 必填；order 20 让本按钮排在 prompt-optimizer(30) 左侧。
        id: 'send-timestamp',
        order: 20,
      },
      createToggleButton(store),
    ),
  )
}
