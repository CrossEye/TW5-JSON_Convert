const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { normalizeDoc, parseSpec, isEntryArray } = require(
  '../wiki/plugins/json-convert/engine/normalize.js'
)
const { prepareSource } = require(
  '../wiki/plugins/json-convert/engine/prepare.js'
)
const { convert } = require(
  '../wiki/plugins/json-convert/engine/convert.js'
)
const { validateProfile } = require(
  '../wiki/plugins/json-convert/engine/validate.js'
)
const { setNormalizeEnabled, normalizeEnabled } = require(
  '../wiki/plugins/json-convert/engine/profile-format.js'
)

const fixture = (name) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8')

const AUTO = [{ pivot: {} }]

const entry = (key, value) => ({
  key, name: key, value, type: 'string', array: false
})

const codes = (list) => list.map((w) => w.code)

// ---- pivot basics ----

test('pivot: flattens an array of entry objects', () => {
  const doc = { records: [[entry('date', '9/16/26'), entry('total', '42')]] }
  const { value, warnings } = normalizeDoc(doc, AUTO)
  assert.deepEqual(value.records[0], { date: '9/16/26', total: '42' })
  assert.equal(warnings.length, 0)
})

test('pivot: absent or empty spec is the identity', () => {
  const doc = { records: [[entry('date', '9/16/26')]] }
  for (const spec of [undefined, null, '', '   ', []]) {
    const { value, warnings } = normalizeDoc(doc, spec)
    assert.equal(value, doc, `spec ${JSON.stringify(spec)} should not copy`)
    assert.equal(warnings.length, 0)
  }
})

test('pivot: does not stringify values', () => {
  const doc = [{ key: 'n', value: 7 }, { key: 'ok', value: true },
    { key: 'nothing', value: null }]
  const { value } = normalizeDoc(doc, AUTO)
  assert.equal(value.n, 7)
  assert.equal(value.ok, true)
  assert.equal(value.nothing, null)
})

test('pivot: an entry whose value is a list keeps the list', () => {
  const doc = [{ key: 'tags', value: ['a', 'b'], array: true }]
  const { value } = normalizeDoc(doc, AUTO)
  assert.deepEqual(value.tags, ['a', 'b'])
})

test('pivot: nested reified structures collapse too', () => {
  const doc = [
    { key: 'name', value: 'Ada' },
    { key: 'address', value: [{ key: 'city', value: 'London' }] }
  ]
  const { value } = normalizeDoc(doc, AUTO)
  assert.deepEqual(value, { name: 'Ada', address: { city: 'London' } })
})

test('pivot: leaves ordinary arrays alone', () => {
  const doc = {
    items: [{ name: 'a' }, { name: 'b' }],
    strings: ['x', 'y'],
    mixed: [{ key: 'a', value: 1 }, { name: 'b' }]
  }
  const { value, warnings } = normalizeDoc(doc, AUTO)
  assert.deepEqual(value, doc)
  assert.deepEqual(codes(warnings), ['normalize-no-effect'])
})

test('pivot: an empty array is left as an array', () => {
  const { value } = normalizeDoc({ rows: [] }, AUTO)
  assert.deepEqual(value.rows, [])
})

test('pivot: an entry missing the value field is not an entry', () => {
  const doc = [{ key: 'a' }, { key: 'b', value: 1 }]
  const { value } = normalizeDoc(doc, AUTO)
  assert.ok(Array.isArray(value))
})

test('pivot: a null or empty value still counts as an entry', () => {
  const doc = [{ key: 'a', value: null }, { key: 'b', value: '' }]
  const { value } = normalizeDoc(doc, AUTO)
  assert.deepEqual(value, { a: null, b: '' })
})

test('pivot: duplicate keys — last wins, with a warning', () => {
  const doc = [entry('date', 'first'), entry('date', 'second')]
  const { value, warnings } = normalizeDoc(doc, AUTO)
  assert.equal(value.date, 'second')
  assert.deepEqual(codes(warnings), ['normalize-duplicate-key'])
  assert.match(warnings[0].message, /"date"/)
})

test('pivot: the source document is not mutated', () => {
  const doc = { rows: [[entry('a', '1')]] }
  const before = JSON.stringify(doc)
  normalizeDoc(doc, AUTO)
  assert.equal(JSON.stringify(doc), before)
})

// ---- options ----

test('pivot: key/value field names are configurable', () => {
  const doc = [{ name: 'date', val: '9/16/26' }]
  const { value } = normalizeDoc(doc, [{ pivot: { key: 'name', value: 'val' } }])
  assert.deepEqual(value, { date: '9/16/26' })
})

test('pivot: "at" scopes the rewrite to one subtree', () => {
  const doc = {
    meta: [entry('source', 'scanner')],
    rows: [[entry('date', '9/16/26')]]
  }
  const { value } = normalizeDoc(doc, [{ pivot: { at: 'rows' } }])
  assert.deepEqual(value.rows[0], { date: '9/16/26' })
  assert.ok(Array.isArray(value.meta), 'meta stays untouched')
})

test('pivot: "at" accepts index and star segments', () => {
  const doc = { rows: [[entry('a', '1')], [entry('b', '2')]] }
  const starred = normalizeDoc(doc, [{ pivot: { at: 'rows[*]' } }]).value
  assert.deepEqual(starred.rows, [{ a: '1' }, { b: '2' }])
  const indexed = normalizeDoc(doc, [{ pivot: { at: 'rows[0]' } }]).value
  assert.deepEqual(indexed.rows[0], { a: '1' })
  assert.ok(Array.isArray(indexed.rows[1]), 'rows[1] untouched')
})

test('pivot: an "at" that does not resolve changes nothing', () => {
  const doc = { rows: [[entry('a', '1')]] }
  const { value, warnings } = normalizeDoc(doc, [{ pivot: { at: 'nope' } }])
  assert.deepEqual(value, doc)
  assert.deepEqual(codes(warnings), ['normalize-no-effect'])
})

test('normalize: steps apply in order', () => {
  const doc = [{ k: 'outer', v: [{ key: 'inner', value: 1 }] }]
  const { value } = normalizeDoc(doc, [
    { pivot: { key: 'k', value: 'v' } },
    { pivot: {} }
  ])
  assert.deepEqual(value, { outer: { inner: 1 } })
})

// ---- spec parsing ----

test('parseSpec: accepts JSON text, arrays, and junk', () => {
  assert.deepEqual(parseSpec('[{"pivot":{}}]'), [{ pivot: {} }])
  assert.deepEqual(parseSpec([{ pivot: {} }]), [{ pivot: {} }])
  assert.deepEqual(parseSpec('not json'), [])
  assert.deepEqual(parseSpec('{"pivot":{}}'), [])
  assert.deepEqual(parseSpec(null), [])
})

test('isEntryArray: recognizes what pivot will rewrite', () => {
  assert.equal(isEntryArray([{ key: 'a', value: 1 }], 'key', 'value'), true)
  assert.equal(isEntryArray([], 'key', 'value'), false)
  assert.equal(isEntryArray([{ key: '', value: 1 }], 'key', 'value'), false)
  assert.equal(isEntryArray('nope', 'key', 'value'), false)
})

// ---- prepareSource ----

test('prepareSource: parses then normalizes, merging warnings', () => {
  const text = 'noise [{"key":"a","value":"1"}] trailing'
  const r = prepareSource(text, AUTO)
  assert.deepEqual(r.value, { a: '1' })
  assert.deepEqual(codes(r.warnings), ['parse-recovered'])
})

test('prepareSource: a parse error skips normalization', () => {
  const r = prepareSource('{ not json', AUTO)
  assert.equal(r.errors.length, 1)
  assert.equal(r.value, undefined)
})

// ---- end to end ----

test('convert: reified fixture maps with ordinary bindings', () => {
  const profile = {
    records: '{{documents[*]}}',
    normalize: AUTO,
    'tw-fields': {
      title: '{{fields.invoice_number}}',
      text:  '{{fields.notes}}',
      tags:  '{{fields.vendor|split-commas}}'
    },
    'custom-fields': {
      'invoice-date': '{{fields.date}}',
      total:          '{{fields.total}}'
    }
  }
  const r = convert(fixture('reified.json'), profile, new Set())
  assert.deepEqual(r.errors, [])
  assert.equal(r.tiddlers.length, 2)
  assert.equal(r.tiddlers[0].title, 'INV-0042')
  assert.equal(r.tiddlers[0].text, 'Net 30, delivered to dock B')
  assert.equal(r.tiddlers[0]['invoice-date'], '9/16/26')
  assert.equal(r.tiddlers[0].total, '128.50')
  assert.equal(r.tiddlers[0].tags, '[[Acme Supply]]')
  assert.equal(r.tiddlers[1].title, 'INV-0043')
})

test('convert: ancestor refs still work across a normalized document', () => {
  const profile = {
    records: '{{documents[*]}}',
    normalize: AUTO,
    'tw-fields': { title: '{{fields.invoice_number}}' },
    'custom-fields': { 'file-name': '{{../file_name}}' }
  }
  const r = convert(fixture('reified.json'), profile, new Set())
  assert.deepEqual(r.errors, [])
  assert.equal(r.tiddlers[0]['file-name'], 'scan-001.pdf')
})

test('convert: without normalize the same fixture needs positional paths', () => {
  const profile = {
    records: '{{documents[*]}}',
    'tw-fields': { title: '{{fields[0].value}}' }
  }
  const r = convert(fixture('reified.json'), profile, new Set())
  assert.deepEqual(r.errors, [])
  assert.equal(r.tiddlers[0].title, 'INV-0042')
})

test('convert: normalize warnings reach the result', () => {
  const profile = {
    records: '{{questions[*]}}',
    normalize: AUTO,
    'tw-fields': { title: '{{name}}' }
  }
  const r = convert(fixture('happy-path.json'), profile, new Set())
  assert.ok(codes(r.warnings).includes('normalize-no-effect'))
})

// ---- validation ----

const withNormalize = (normalize) => ({
  records: '{{a[*]}}',
  normalize,
  'tw-fields': { title: '{{x}}' }
})

const validate = (normalize) =>
  codes(validateProfile(withNormalize(normalize), {}))

test('validate: a well-formed spec passes', () => {
  assert.deepEqual(validate([{ pivot: {} }]), [])
  assert.deepEqual(validate([{ pivot: { key: 'name', value: 'val' } }]), [])
  assert.deepEqual(validate([{ pivot: { at: 'rows[*].fields' } }]), [])
  assert.deepEqual(validate([]), [])
})

test('validate: normalize must be an array', () => {
  assert.deepEqual(validate('yes'), ['normalize-not-array'])
  assert.deepEqual(validate({ pivot: {} }), ['normalize-not-array'])
})

test('validate: steps must name exactly one known operation', () => {
  assert.deepEqual(validate([{ flatten: {} }]), ['unknown-normalize-step'])
  assert.deepEqual(validate([{}]), ['unknown-normalize-step'])
  assert.deepEqual(
    validate([{ pivot: {}, extra: {} }]), ['unknown-normalize-step']
  )
  assert.deepEqual(validate(['pivot']), ['unknown-normalize-step'])
})

test('validate: pivot options are checked', () => {
  assert.deepEqual(validate([{ pivot: { keys: 'name' } }]),
    ['normalize-bad-step'])
  assert.deepEqual(validate([{ pivot: { key: 3 } }]), ['normalize-bad-step'])
  assert.deepEqual(validate([{ pivot: 'auto' }]), ['normalize-bad-step'])
  assert.deepEqual(validate([{ pivot: { at: 'a[' } }]), ['normalize-bad-step'])
  assert.deepEqual(validate([{ pivot: { at: '../x' } }]),
    ['normalize-bad-step'])
})

test('validate: an absent normalize key is fine', () => {
  const profile = { records: '{{a[*]}}', 'tw-fields': { title: '{{x}}' } }
  assert.deepEqual(validateProfile(profile, {}), [])
})

// ---- the profile text the toggle writes ----

const EOL = String.fromCharCode(10)

const PLAIN = [
  '{',
  '  "records": "{{a[*]}}",',
  '  "tw-fields": {',
  '    "title": "{{x}}"',
  '  }',
  '}'
].join(EOL)

test('toggle: enabling adds the auto spec after records', () => {
  const text = setNormalizeEnabled(PLAIN, true)
  assert.ok(text.includes('"normalize": [{"pivot":{}}]'))
  assert.ok(
    text.indexOf('"records"') < text.indexOf('"normalize"') &&
    text.indexOf('"normalize"') < text.indexOf('"tw-fields"'),
    'normalize should sit between records and tw-fields'
  )
  assert.equal(normalizeEnabled(text), true)
  assert.deepEqual(validateProfile(JSON.parse(text), {}), [])
})

test('toggle: disabling removes the key', () => {
  const on = setNormalizeEnabled(PLAIN, true)
  const off = setNormalizeEnabled(on, false)
  assert.equal(normalizeEnabled(off), false)
  assert.equal(/normalize/.test(off), false)
})

test('toggle: a hand-written spec is left alone when enabling', () => {
  const hand = '{"records":"{{a[*]}}","normalize":[{"pivot":{"key":"name"}}],' +
    '"tw-fields":{"title":"{{x}}"}}'
  assert.equal(setNormalizeEnabled(hand, true), null)
})

test('toggle: unknown profile keys survive the rewrite', () => {
  const extra = '{"records":"{{a[*]}}","tw-fields":{"title":"{{x}}"},' +
    '"note":"keep me"}'
  assert.match(setNormalizeEnabled(extra, true), /"note": "keep me"/)
})

test('toggle: malformed profile text is left untouched', () => {
  assert.equal(setNormalizeEnabled('not json', true), null)
  assert.equal(setNormalizeEnabled('[1,2]', true), null)
})
