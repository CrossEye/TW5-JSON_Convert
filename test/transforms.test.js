const { test } = require('node:test')
const assert = require('node:assert/strict')
const { defaultTransforms: T, formatTwDate } = require(
  '../wiki/plugins/json-convert/engine/transforms.js'
)

test('html-to-wikitext: passthrough placeholder', () => {
  const html = '<p>Hello <b>world</b></p>'
  assert.equal(T['html-to-wikitext'](html), html)
})

test('split-csv: simple CSV', () => {
  assert.equal(T['split-csv']('foo, bar, baz'), 'foo bar baz')
})

test('split-csv: items containing whitespace get [[ ]] quoting', () => {
  assert.equal(
    T['split-csv']('algebra, linear algebra, geometry'),
    'algebra [[linear algebra]] geometry'
  )
})

test('split-csv: array input', () => {
  assert.equal(
    T['split-csv'](['x', 'y z', '', 'q']),
    'x [[y z]] q'
  )
})

test('split-csv: empty entries are dropped', () => {
  assert.equal(T['split-csv']('a,,b,'), 'a b')
})

test('timestamp-to-date: seconds', () => {
  assert.equal(T['timestamp-to-date'](1700000000), '20231114221320000')
})

test('timestamp-to-date: milliseconds', () => {
  assert.equal(T['timestamp-to-date'](1700000000000), '20231114221320000')
})

test('timestamp-to-date: numeric string accepted', () => {
  assert.equal(T['timestamp-to-date']('1700000000'), '20231114221320000')
})

test('timestamp-to-date: non-numeric returns empty', () => {
  assert.equal(T['timestamp-to-date']('not a number'), '')
})

test('formatTwDate: pads zeroes correctly', () => {
  const d = new Date(Date.UTC(2024, 0, 5, 3, 4, 5, 6))
  assert.equal(formatTwDate(d), '20240105030405006')
})
