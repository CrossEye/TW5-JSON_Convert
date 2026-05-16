const { test } = require('node:test')
const assert = require('node:assert/strict')
const { initialPickerState, diffPicker } = require(
  '../wiki/plugins/json-convert/engine/picker.js'
)

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

test('init: bracketed path captured by its canonical form', () => {
  const state = initialPickerState({
    leafPaths: ['answers[*].text'],
    twFields: {},
    customFields: { 'answers-text': '{{answers[*].text}}' }
  })
  assert.deepEqual(state, { 'answers[*].text': 'answers-text' })
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
