/**
 * 单元测试：直接跑构建产物 lib/timestamp.js。
 * 全部断言都传入固定 Date —— 绝不用 new Date() 参与断言。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatStamp,
  hasTrailingStamp,
  isSlashCommand,
  normalizePreset,
  stampFor,
  textOf,
  trailingStampRe,
} from '../lib/timestamp.js'

// 2024-01-02 09:05:07 本地时间
const AT = new Date(2024, 0, 2, 9, 5, 7)
/** time 预设产出的时间戳（带方括号）。 */
const T = '[09:05:07]'
/** monthday 预设产出的时间戳（当前默认预设，带方括号）。 */
const MD = '[01-02 09:05:07]'
/** datetime 预设产出的时间戳（不带方括号）。 */
const DT = '2024-01-02 09:05:07'

test('formatStamp: time 预设为 [HH:mm:ss] 24 小时制并补零', () => {
  assert.equal(formatStamp(AT, 'time'), T)
  assert.equal(formatStamp(new Date(2024, 11, 31, 23, 59, 59), 'time'), '[23:59:59]')
  assert.equal(formatStamp(new Date(2024, 0, 2, 0, 0, 0), 'time'), '[00:00:00]')
})

test('formatStamp: monthday 预设（默认）为 [MM-DD HH:mm:ss]', () => {
  assert.equal(formatStamp(AT, 'monthday'), MD)
  assert.equal(formatStamp(new Date(2024, 11, 31, 23, 59, 59), 'monthday'), '[12-31 23:59:59]')
  assert.equal(formatStamp(new Date(2024, 0, 2, 0, 0, 0), 'monthday'), '[01-02 00:00:00]')
})

test('normalizePreset: 未知值与缺省都回落到默认预设 monthday', () => {
  assert.equal(normalizePreset('time'), 'time')
  assert.equal(normalizePreset('monthday'), 'monthday')
  assert.equal(normalizePreset('datetime'), 'datetime')
  assert.equal(normalizePreset('nonsense'), 'monthday')
  assert.equal(normalizePreset(undefined), 'monthday')
})

test('formatStamp: datetime 预设为 YYYY-MM-DD HH:mm:ss（明确不带方括号）', () => {
  assert.equal(formatStamp(AT, 'datetime'), DT)
  assert.ok(!formatStamp(AT, 'datetime').includes('['), 'datetime 预设不应带方括号')
  assert.ok(!formatStamp(AT, 'datetime').includes(']'), 'datetime 预设不应带方括号')
})

test('trailingStampRe / hasTrailingStamp: 只认当前预设的同格式时间戳', () => {
  assert.ok(trailingStampRe('time').test(`你好 ${T}`))
  assert.ok(!trailingStampRe('time').test(`你好 ${DT}`))
  assert.ok(trailingStampRe('datetime').test(`你好 ${DT}`))
  assert.ok(!trailingStampRe('datetime').test(`你好 ${T}`))
  assert.ok(hasTrailingStamp(`末尾 ${T}`, 'time'))
  assert.ok(!hasTrailingStamp(`${T} 在前面`, 'time'))
  // monthday 与另两个预设必须互不误判
  assert.ok(trailingStampRe('monthday').test(`你好 ${MD}`))
  assert.ok(!trailingStampRe('monthday').test(`你好 ${T}`))
  assert.ok(!trailingStampRe('monthday').test(`你好 ${DT}`))
  assert.ok(!trailingStampRe('time').test(`你好 ${MD}`), 'monthday 不应被 time 正则误判')
  assert.ok(!trailingStampRe('datetime').test(`你好 ${MD}`), 'monthday 不应被 datetime 正则误判')
})

test('stampFor: 普通文本返回应追加的时间戳', () => {
  assert.equal(stampFor('你好', AT, 'time'), T)
  assert.equal(stampFor('你好', AT, 'monthday'), MD)
  assert.equal(stampFor('你好', AT, 'datetime'), DT)
})

test('stampFor: 末尾已是同格式时间戳时不重复追加', () => {
  assert.equal(stampFor(`你好 ${T}`, AT, 'time'), null)
  assert.equal(stampFor(`你好 ${DT}`, AT, 'datetime'), null)
})

test('stampFor: 末尾是另一种格式的时间戳时仍会追加', () => {
  assert.equal(stampFor(`你好 ${DT}`, AT, 'time'), T)
  assert.equal(stampFor(`你好 ${T}`, AT, 'datetime'), DT)
  assert.equal(stampFor(`你好 ${T}`, AT, 'monthday'), MD)
  assert.equal(stampFor(`你好 ${MD}`, AT, 'time'), T)
})

test('stampFor: / 开头（含前导空白）不追加', () => {
  assert.equal(isSlashCommand('/help'), true)
  assert.equal(isSlashCommand('   /help'), true)
  assert.equal(isSlashCommand('\n\t/help'), true)
  assert.equal(isSlashCommand('你好 /help'), false)
  assert.equal(stampFor('/help', AT, 'time'), null)
  assert.equal(stampFor('   /help', AT, 'time'), null)
  assert.equal(stampFor('\n/help args', AT, 'time'), null)
})

test('stampFor: 空文本与纯空白不追加', () => {
  assert.equal(stampFor('', AT, 'time'), null)
  assert.equal(stampFor('   ', AT, 'time'), null)
  assert.equal(stampFor('\n\n', AT, 'datetime'), null)
})

test('stampFor: 多行文本照样返回时间戳（落点由 host 决定，不再改写正文）', () => {
  assert.equal(stampFor('第一行\n第二行', AT, 'time'), T)
  assert.equal(stampFor('第一行\n第二行', AT, 'monthday'), MD)
})

test('textOf: 只拼接 text 片段', () => {
  assert.equal(
    textOf([
      { type: 'text', text: 'a' },
      { type: 'image', data: 'x' },
      { type: 'text', text: 'b' },
    ]),
    'ab',
  )
  assert.equal(textOf([]), '')
  assert.equal(textOf(undefined), '')
})
