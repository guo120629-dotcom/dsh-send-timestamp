/**
 * 纯函数层：格式化 / 追加 / 去重 / 斜杠命令判定。
 *
 * 这里刻意不 import 任何 dsh 内部包、也不触碰 DOM —— host 与 client 两侧
 * 都要复用同一套判定，一旦依赖运行时环境就会在其中一侧失效。
 */

export type StampPreset = 'time' | 'monthday' | 'datetime'

/** 与 Host 端 Config 的字段形状一致；client 侧从设置快照里读到同样的两个字段。 */
export interface SendTimestampConfig {
  enabled: boolean
  preset: StampPreset
}

/** 默认预设：月-日 + 时:分:秒（方括号包裹）。 */
export const DEFAULT_PRESET: StampPreset = 'monthday'

/** 内置预设。`datetime` 按需求**不带**方括号，另两个带。 */
export const PRESETS: readonly StampPreset[] = ['time', 'monthday', 'datetime']

const pad2 = (value: number): string => String(value).padStart(2, '0')

/** 非法/缺省值一律归一化到默认预设，避免设置里写坏一个字符串就打不出时间戳。 */
export function normalizePreset(value: unknown): StampPreset {
  return value === 'time' || value === 'monthday' || value === 'datetime' ? value : DEFAULT_PRESET
}

/**
 * 本地时间格式化；各字段补零。
 * - `time`     → `[HH:mm:ss]`
 * - `monthday` → `[MM-DD HH:mm:ss]`（默认）
 * - `datetime` → `YYYY-MM-DD HH:mm:ss`（按需求不带方括号）
 */
export function formatStamp(now: Date, preset: StampPreset): string {
  const clock = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
  const monthDay = `${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  if (preset === 'datetime') return `${now.getFullYear()}-${monthDay} ${clock}`
  if (preset === 'monthday') return `[${monthDay} ${clock}]`
  return `[${clock}]`
}

/**
 * 判定「末尾已经是当前预设同格式的时间戳」用的正则；每次调用重新构造，避免 lastIndex 状态泄漏。
 *
 * 三个预设互不误判：`time` 要求 `[` 紧邻时分秒，`monthday` 要求方括号内先有月-日，
 * `datetime` 要求结尾就是完整年月日（无方括号）。
 */
export function trailingStampRe(preset: StampPreset): RegExp {
  if (preset === 'datetime') return /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
  if (preset === 'monthday') return /\[\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]$/
  return /\[\d{2}:\d{2}:\d{2}\]$/
}

export function hasTrailingStamp(text: string, preset: StampPreset): boolean {
  return trailingStampRe(preset).test(text)
}

/** 先 trimStart 再判定，前导空白的 `/` 同样是斜杠命令（业务规则 5）。 */
export function isSlashCommand(text: string): boolean {
  return text.trimStart().startsWith('/')
}

/** 拼接 content 数组里所有 text 片段的文本；非 text 片段（图片等）忽略。 */
export function textOf(content: readonly any[]): string {
  if (!Array.isArray(content)) return ''
  let out = ''
  for (const part of content) {
    if (part && part.type === 'text' && typeof part.text === 'string') out += part.text
  }
  return out
}

/**
 * 返回应追加的时间戳文本；若应跳过则返回 null。
 * 调用方负责在发送前一刻传入 `new Date()`，本函数不自己取时间。
 */
export function stampFor(text: string, now: Date, preset: StampPreset): string | null {
  // 纯附件消息没有 text 片段；空白文本追加时间戳没有意义。
  if (text.trim() === '') return null
  if (isSlashCommand(text)) return null
  if (hasTrailingStamp(text, preset)) return null
  return formatStamp(now, preset)
}
