const { test } = require('node:test')
const assert = require('node:assert/strict')
const { initialPickerState, diffPicker, collectLeafPaths } = require(
  '../wiki/plugins/json-convert/engine/picker.js'
)
const { mergeRecordShapes } = require(
  '../wiki/plugins/json-convert/engine/shape.js'
)

// ---- collectLeafPaths ----

test('collectLeafPaths: top-level fields', () => {
  const shape = mergeRecordShapes([{ id: 1, name: 'a' }, { id: 2, name: 'b' }])
  assert.deepEqual(collectLeafPaths(shape).sort(), ['id', 'name'])
})

test('collectLeafPaths: nested object fields', () => {
  const shape = mergeRecordShapes([
    { id: 1, author: { name: 'a', email: 'a@x' } },
    { id: 2, author: { name: 'b', email: 'b@x' } }
  ])
  assert.deepEqual(collectLeafPaths(shape).sort(),
    ['author.email', 'author.name', 'id'])
})

test('collectLeafPaths: in-array leaves are skipped', () => {
  // Pass-through bindings can't use `[*]` (validator rejects).  The
  // picker omits in-array leaves entirely; users still have the
  // regular Browse modal to bind into nested arrays.
  const shape = mergeRecordShapes([
    { id: 1, tags: [{ label: 'x' }, { label: 'y' }] },
    { id: 2, tags: [{ label: 'z' }] }
  ])
  assert.deepEqual(collectLeafPaths(shape).sort(), ['id'])
})

test('collectLeafPaths: empty input', () => {
  assert.deepEqual(collectLeafPaths(mergeRecordShapes([{}])), [])
})

// ---- initialPickerState ----

test('init: untouched profile yields empty state', () => {
  const state = initialPickerState({
    leafPaths: ['title', 'author.name'],
    twFields: { title: '{{author}}: {{title}}' },
    customFields: {}
  })
  assert.deepEqual(state, {})
})

test('init: existing pass-through is captured', () => {
  const state = initialPickerState({
    leafPaths: ['title', 'year'],
    twFields: { title: '{{title}}' },
    customFields: { year: '{{year}}' }
  })
  assert.deepEqual(state, { title: 'title', year: 'year' })
})

test('init: customized binding is not captured', () => {
  const state = initialPickerState({
    leafPaths: ['title'],
    twFields: { title: '{{title|slugify}}' },
    customFields: {}
  })
  assert.deepEqual(state, {})
})

test('init: bracketed path captured by its canonical [0] form', () => {
  const state = initialPickerState({
    leafPaths: ['answers[0].text'],
    twFields: {},
    customFields: { 'answers-text': '{{answers[0].text}}' }
  })
  assert.deepEqual(state, { 'answers[0].text': 'answers-text' })
})

test('init: empty inputs produce empty state', () => {
  assert.deepEqual(initialPickerState({
    leafPaths: [],
    twFields: {},
    customFields: {}
  }), {})
})

test('init: name renamed by user but value still pass-through is captured', () => {
  // The recognizer accepts any name that's a possible flattening of
  // the path, so a user-renamed binding still counts.
  const state = initialPickerState({
    leafPaths: ['author.name'],
    twFields: {},
    customFields: { 'author-name': '{{author.name}}' }
  })
  assert.deepEqual(state, { 'author.name': 'author-name' })
})

// ---- diffPicker ----

test('diff: no changes → empty add and remove', () => {
  const state = { foo: 'foo' }
  const r = diffPicker({
    oldState: state,
    newState: state,
    customFields: { foo: '{{foo}}' },
    leafPaths: ['foo']
  })
  assert.deepEqual(r, { add: [], remove: [] })
})

test('diff: tick a previously-unticked path → add', () => {
  const r = diffPicker({
    oldState: {},
    newState: { foo: 'foo' },
    customFields: {},
    leafPaths: ['foo']
  })
  assert.deepEqual(r, { add: [{ name: 'foo', path: 'foo' }], remove: [] })
})

test('diff: untick an existing pass-through → remove', () => {
  const r = diffPicker({
    oldState: { foo: 'foo' },
    newState: {},
    customFields: { foo: '{{foo}}' },
    leafPaths: ['foo']
  })
  assert.deepEqual(r, { add: [], remove: ['foo'] })
})

test('diff: untick a now-customized binding → no remove', () => {
  // Between session open and apply, user customized the binding.
  // Picker shouldn't delete it.
  const r = diffPicker({
    oldState: { foo: 'foo' },
    newState: {},
    customFields: { foo: '{{foo|slugify}}' },
    leafPaths: ['foo']
  })
  assert.deepEqual(r, { add: [], remove: [] })
})

test('diff: rename → remove old + add new', () => {
  const r = diffPicker({
    oldState: { 'author.name': 'name' },
    newState: { 'author.name': 'author-name' },
    customFields: { name: '{{author.name}}' },
    leafPaths: ['author.name']
  })
  assert.deepEqual(r, {
    add: [{ name: 'author-name', path: 'author.name' }],
    remove: ['name']
  })
})

test('diff: tick multiple new paths → all added', () => {
  const r = diffPicker({
    oldState: {},
    newState: { a: 'a', c: 'c' },
    customFields: {},
    leafPaths: ['a', 'b', 'c']
  })
  assert.deepEqual(r, {
    add: [{ name: 'a', path: 'a' }, { name: 'c', path: 'c' }],
    remove: []
  })
})

test('diff: re-tick a path whose binding is missing → add (heals deletion)', () => {
  const r = diffPicker({
    oldState: { foo: 'foo' },
    newState: { foo: 'foo' },
    customFields: {},
    leafPaths: ['foo']
  })
  assert.deepEqual(r, {
    add: [{ name: 'foo', path: 'foo' }],
    remove: []
  })
})
