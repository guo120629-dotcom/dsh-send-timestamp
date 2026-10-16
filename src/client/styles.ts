/**
 * 按钮样式。只用本机 theme 表中**确有定义**的 `--dsw-alias-*` token（浅色/深色双主题
 * 均有定义），并且每个 token 都带兜底值 —— token 改名只会掉色，不会坏渲染。
 *
 * 刻意避开两个参考插件用过、但在本机 theme 表中定义数为 0 的名字：
 * `--dsw-alias-state-focus-ring` 与 `--dsw-alias-fill-secondary`。
 */
import type { CSSProperties } from 'react'

export const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  fontSize: 12,
  lineHeight: '18px',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  border: '1px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.35))',
  background: 'var(--dsw-alias-button-tool-bar-fill, transparent)',
  color: 'var(--dsw-alias-label-primary, inherit)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/** 开启态：用 toolbar hover 底色拉开与关闭态的差别，文字色不变以贴合宿主控件。 */
export const activeStyle: CSSProperties = {
  background: 'var(--dsw-alias-button-tool-bar-hover, var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.16)))',
  borderColor: 'var(--dsw-alias-border-l4, rgba(128, 128, 128, 0.5))',
}

/** 关闭态文字略淡，弱化存在感。 */
export const inactiveStyle: CSSProperties = {
  color: 'var(--dsw-alias-label-secondary, inherit)',
}

export const focusRing = 'var(--dsw-focus-ring-color, #4f7cf7)'
