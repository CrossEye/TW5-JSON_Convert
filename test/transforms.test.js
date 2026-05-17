const { test } = require('node:test')
const assert = require('node:assert/strict')
const { defaultTransforms: T, formatTwDate } = require(
  '../wiki/plugins/json-convert/engine/transforms.js'
)

test('html-to-wikitext: passthrough placeholder', () => {
  const html = '<p>Hello <b>world</b></p>'
  assert.equal(T['html-to-wikitext'](html), html)
})

test('split-commas: simple comma-separated string', () => {
  assert.equal(T['split-commas']('foo, bar, baz'), 'foo bar baz')
})

test('split-commas: items containing whitespace get [[ ]] quoting', () => {
  assert.equal(
    T['split-commas']('algebra, linear algebra, geometry'),
    'algebra [[linear algebra]] geometry'
  )
})

test('split-commas: array input', () => {
  assert.equal(
    T['split-commas'](['x', 'y z', '', 'q']),
    'x [[y z]] q'
  )
})

test('split-commas: empty entries are dropped', () => {
  assert.equal(T['split-commas']('a,,b,'), 'a b')
})

test('split-to-titles: every item is wrapped in [[ ]]', () => {
  assert.equal(
    T['split-to-titles']('Scooby Doo, Wilma Flintstone, Yogi Bear'),
    '[[Scooby Doo]] [[Wilma Flintstone]] [[Yogi Bear]]'
  )
})

test('split-to-titles: single-word items also get [[ ]]', () => {
  assert.equal(
    T['split-to-titles']('Bender, Fry, Leela'),
    '[[Bender]] [[Fry]] [[Leela]]'
  )
})

test('split-to-titles: array input', () => {
  assert.equal(
    T['split-to-titles'](['x', 'y z', '', 'q']),
    '[[x]] [[y z]] [[q]]'
  )
})

test('split-to-titles: empty entries are dropped', () => {
  assert.equal(T['split-to-titles']('a,,b,'), '[[a]] [[b]]')
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

test('iso-to-date: basic ISO 8601 with Z', () => {
  assert.equal(T['iso-to-date']('2026-05-17T21:36:24Z'), '20260517213624000')
})

test('iso-to-date: ISO 8601 with sub-second precision', () => {
  assert.equal(
    T['iso-to-date']('2026-05-17T21:36:24.000000Z'),
    '20260517213624000'
  )
})

test('iso-to-date: ISO 8601 with timezone offset converts to UTC', () => {
  assert.equal(T['iso-to-date']('2026-05-17T17:36:24-04:00'), '20260517213624000')
})

test('iso-to-date: empty / null / undefined returns empty', () => {
  assert.equal(T['iso-to-date'](''), '')
  assert.equal(T['iso-to-date'](null), '')
  assert.equal(T['iso-to-date'](undefined), '')
})

test('iso-to-date: unparseable string returns empty', () => {
  assert.equal(T['iso-to-date']('not a date'), '')
})

test('formatTwDate: pads zeroes correctly', () => {
  const d = new Date(Date.UTC(2024, 0, 5, 3, 4, 5, 6))
  assert.equal(formatTwDate(d), '20240105030405006')
})
