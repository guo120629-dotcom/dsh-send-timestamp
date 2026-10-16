/**
 * 开关持久化的**唯一**接缝：settings 命名空间优先，服务不可用时退回 localStorage。
 *
 * 开关是**逐会话**的：
 * - settings 路径：写 `sessions[sessionId]`（Host 端 `Schema.dict` 字段），其他会话互不影响；
 * - localStorage 路径：一张 `{ [sessionId]: boolean }` 的 JSON 表。
 * 某个会话从没被用户动过开关时，回落到全局默认（settings 的 `enabled` / 本地的 `*:enabled`）。
 * 预设则是**全局共享**的 —— 它是格式偏好，不是逐会话状态。
 *
 * 为什么要包一层：命名空间的读写入口在官方与第三方族群之间换过名字与形态，
 * 后续若再变只改本文件。
 *
 * 已核实的两个候选面（二者恰好同形：getSnapshot / subscribe / set / unset）：
 * - 官方 `ctx.configForms.get(entryId)` → ConfigFormController
 *   （@deepseek-ai/dsh-client-ui-settings/lib/client.js:1309-1316，set 在 1152-1158）
 * - 第三方 `ctx.settingsScope.bind({ namespace })` → compat scope
 *   （@linxin666/dsh-client-ui-web-ui-settings/lib/client.js:564-589 返回对象，
 *     set 在 517，store 快照在 513）
 */
import { DEFAULT_PRESET, normalizePreset, type StampPreset } from '../timestamp'

/** 与 cordis.patch.yml 里那一行的 `- id:` 一致；settings 命名空间就是条目 id。 */
export const NAMESPACE = 'send-timestamp'

/** localStorage 兜底的键名。 */
export const ENABLED_KEY = 'dsh-send-timestamp:enabled'
export const PRESET_KEY = 'dsh-send-timestamp:preset'
export const SESSIONS_KEY = 'dsh-send-timestamp:sessions'

/** 某个会话的开关状态（已解析）。 */
export interface ToggleState {
  enabled: boolean
  preset: StampPreset
  /** false = 走的是 localStorage 兜底路径，UI 据此加一句提示。 */
  available: boolean
}

/** configForms / settingsScope 暴露给本模块的公共子集。 */
export interface SettingsFaceLike {
  getSnapshot(): any
  subscribe?(listener: () => void): any
  set?(field: string, value: unknown): any
  unset?(field: string): any
}

export interface ToggleStore {
  /** 读取**指定会话**的开关（`null` 表示拿不到会话 id，只能看全局默认）。 */
  snapshotFor(sessionId: string | null): ToggleState
  subscribe(listener: () => void): () => void
  /** 只切**指定会话**，不影响其他会话。 */
  setEnabledFor(sessionId: string | null, next: boolean): void
  /** 预设是全局的。 */
  setPreset(next: StampPreset): void
  /** 接上可选服务；服务缺席或形态不符时静默保持 localStorage 兜底。 */
  attach(kind: 'configForms' | 'settingsScope', service: any): void
  dispose(): void
}

function warn(message: string, error?: unknown): void {
  // 绝不抛出：组件抛错会让整条槽位条目变空白（slot entry crashed）。
  try {
    console.warn(`[${NAMESPACE}] ${message}`, error ?? '')
  } catch {
    /* 无控制台也不影响功能 */
  }
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** 读本地兜底的逐会话表。损坏时宁可从空表开始，也不要让按钮整个失效。 */
function readLocalSessions(): Record<string, boolean> {
  const store = storage()
  if (store === null) return {}
  try {
    const raw = store.getItem(SESSIONS_KEY)
    const parsed = raw === null ? null : JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
  } catch (error) {
    warn('localStorage 读取逐会话表失败', error)
    return {}
  }
}

function writeLocalSessions(map: Record<string, boolean>): void {
  const store = storage()
  if (store === null) return
  try {
    store.setItem(SESSIONS_KEY, JSON.stringify(map))
  } catch (error) {
    warn('localStorage 写入逐会话表失败', error)
  }
}

function readLocalGlobalEnabled(): boolean {
  const store = storage()
  if (store === null) return false
  try {
    return store.getItem(ENABLED_KEY) === '1'
  } catch (error) {
    warn('localStorage 读取全局开关失败', error)
    return false
  }
}

function readLocalPreset(): StampPreset {
  const store = storage()
  if (store === null) return DEFAULT_PRESET
  try {
    return normalizePreset(store.getItem(PRESET_KEY))
  } catch (error) {
    warn('localStorage 读取预设失败', error)
    return DEFAULT_PRESET
  }
}

function writeLocalEnabled(sessionId: string | null, next: boolean): void {
  const store = storage()
  if (store === null) return
  try {
    if (sessionId !== null) {
      const map = readLocalSessions()
      map[sessionId] = next
      writeLocalSessions(map)
      return
    }
    store.setItem(ENABLED_KEY, next ? '1' : '0')
  } catch (error) {
    warn('localStorage 写入开关失败', error)
  }
}

function writeLocalPreset(next: StampPreset): void {
  const store = storage()
  if (store === null) return
  try {
    store.setItem(PRESET_KEY, next)
  } catch (error) {
    warn('localStorage 写入预设失败', error)
  }
}

/** 本地兜底路径下某个会话的有效开关。 */
function localEnabledFor(sessionId: string | null): boolean {
  if (sessionId !== null) {
    const map = readLocalSessions()
    if (typeof map[sessionId] === 'boolean') return map[sessionId]
  }
  return readLocalGlobalEnabled()
}

export function createToggleStore(ctx: any): ToggleStore {
  const listeners = new Set<() => void>()
  let face: SettingsFaceLike | null = null
  let faceUnsubscribe: (() => void) | null = null

  function refresh(): void {
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch (error) {
        warn('订阅者回调抛错', error)
      }
    }
  }

  /** 从设置快照解析某个会话；`unavailable` 或读取失败时返回 null（调用方走本地兜底）。 */
  function settingsState(sessionId: string | null): { enabled: boolean; preset: StampPreset } | null {
    const current = face
    if (current === null) return null
    let snap: any
    try {
      snap = current.getSnapshot()
    } catch (error) {
      warn('settings 快照读取失败，改用本地兜底', error)
      return null
    }
    // describe() 读不到该条目时 controller 停在 unavailable；此时必须降级而不是当 false。
    if (snap == null || snap.status === 'unavailable') return null
    const value = snap.value ?? {}
    const map = value.sessions !== null && typeof value.sessions === 'object' ? value.sessions : {}
    const own = sessionId !== null ? map[sessionId] : undefined
    const enabled = typeof own === 'boolean'
      ? own
      : typeof value.enabled === 'boolean'
        ? value.enabled
        : false
    return { enabled, preset: normalizePreset(value.preset) }
  }

  /** 处理 `set()` 的返回值：它可能同步返回，也可能返回 Promise<boolean>。 */
  function settle(result: unknown, field: string): void {
    if (result != null && typeof (result as Promise<unknown>).then === 'function') {
      ;(result as Promise<unknown>).then(
        (ok) => {
          if (ok === false) warn(`settings 拒绝了 ${field} 写入，已保留本地值`)
          refresh()
        },
        (error: unknown) => warn(`settings 写入 ${field} 失败，已保留本地值`, error),
      )
    }
  }

  function attach(kind: 'configForms' | 'settingsScope', service: any): void {
    if (face !== null || service == null) return
    let bound: any = null
    try {
      if (kind === 'configForms' && typeof service.get === 'function') bound = service.get(NAMESPACE)
      else if (typeof service.bind === 'function') bound = service.bind({ namespace: NAMESPACE })
    } catch (error) {
      warn(`${kind} 绑定命名空间失败，改用本地兜底`, error)
      return
    }
    if (bound == null || typeof bound.getSnapshot !== 'function') return
    face = bound as SettingsFaceLike
    if (typeof bound.subscribe === 'function') {
      try {
        const off = bound.subscribe(() => refresh())
        if (typeof off === 'function') faceUnsubscribe = off
      } catch (error) {
        warn(`${kind} 订阅失败`, error)
      }
    }
    refresh()
  }

  return {
    snapshotFor(sessionId: string | null): ToggleState {
      const local = { enabled: localEnabledFor(sessionId), preset: readLocalPreset() }
      const remote = settingsState(sessionId)
      if (remote === null) return { ...local, available: false }
      // 把已接受的值镜像到本地，供服务掉线后继续可用。
      writeLocalEnabled(sessionId, remote.enabled)
      writeLocalPreset(remote.preset)
      return { ...remote, available: true }
    },

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    setEnabledFor(sessionId: string | null, next: boolean): void {
      // 先写本地镜像，服务不可用/写入被拒时仍能保持开关可用。
      writeLocalEnabled(sessionId, next)
      const current = face
      if (current !== null && typeof current.set === 'function') {
        try {
          if (sessionId === null) {
            settle(current.set('enabled', next), 'enabled')
          } else {
            // 逐会话字段是整张 dict：读改写，只动当前会话那一格。
            let snap: any = null
            try {
              snap = current.getSnapshot()
            } catch (error) {
              warn('读取逐会话表失败，仅写入本地', error)
            }
            const value = snap?.value ?? {}
            const map: Record<string, boolean> =
              value.sessions !== null && typeof value.sessions === 'object' ? { ...value.sessions } : {}
            map[sessionId] = next
            settle(current.set('sessions', map), 'sessions')
          }
        } catch (error) {
          warn('settings 写入开关抛错，已保留本地值', error)
        }
      }
      refresh()
    },

    setPreset(next: StampPreset): void {
      const value = normalizePreset(next)
      writeLocalPreset(value)
      const current = face
      if (current !== null && typeof current.set === 'function') {
        try {
          settle(current.set('preset', value), 'preset')
        } catch (error) {
          warn('settings 写入预设抛错，已保留本地值', error)
        }
      }
      refresh()
    },

    attach,

    dispose() {
      listeners.clear()
      if (faceUnsubscribe !== null) {
        try {
          faceUnsubscribe()
        } catch (error) {
          warn('取消 settings 订阅失败', error)
        }
        faceUnsubscribe = null
      }
      face = null
      void ctx
    },
  }
}
