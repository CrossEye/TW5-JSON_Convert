const { test } = require('node:test')
const assert = require('node:assert/strict')
const { classifyDrop, droppedTiddlerFields, PROFILE_TAG } = require(
  '../wiki/plugins/json-convert/engine/drop.js'
)

const dataTransfer = (map) => ({
  getData: (type) => map[type] || ''
})

test('drop: a profile already in the wiki gets selected', () => {
  const out = classifyDrop(
    { title: 'Example Reified Output', tags: PROFILE_TAG, text: '{}' }, true
  )
  assert.deepEqual(out, {
    action: 'select-profile', title: 'Example Reified Output'
  })
})

test('drop: a profile from another wiki explains itself', () => {
  const out = classifyDrop(
    { title: 'Example Reified Output', tags: PROFILE_TAG, text: '{}' }, false
  )
  assert.equal(out.action, 'note')
  assert.match(out.note, /another wiki/)
  assert.match(out.note, /import it first/)
})

test('drop: any other tiddler loads its text as source', () => {
  const out = classifyDrop(
    { title: 'Example Reified Output Data', tags: 'Sample', text: '{"a":1}' },
    true
  )
  assert.deepEqual(out, {
    action: 'load-source', text: '{"a":1}', title: 'Example Reified Output Data'
  })
})

test('drop: tags arriving as an array are understood', () => {
  const out = classifyDrop(
    { title: 'P', tags: [PROFILE_TAG, 'Other'], text: '{}' }, true
  )
  assert.equal(out.action, 'select-profile')
})

test('drop: an empty tiddler says so rather than silently doing nothing', () => {
  const out = classifyDrop({ title: 'Empty', tags: '', text: '   ' }, true)
  assert.equal(out.action, 'note')
  assert.match(out.note, /no text/)
})

test('drop: junk payloads are ignored', () => {
  assert.deepEqual(classifyDrop(null, false), { action: 'ignore' })
  assert.deepEqual(classifyDrop({}, false), { action: 'ignore' })
})

test('drop: nothing ever routes back into the source box as a title', () => {
  // The original bug: the title, bracketed, spliced into the JSON.
  for (const fields of [
    { title: 'Example Reified Output', tags: PROFILE_TAG, text: '{}' },
    { title: 'Plain', tags: '', text: 'hello' },
    { title: 'Empty', tags: '', text: '' }
  ]) {
    const out = classifyDrop(fields, true)
    const written = out.text || ''
    assert.ok(!written.includes(`[[${fields.title}]]`),
      'a dropped title must never become source text')
  }
})

test('payload: reads TiddlyWikis native tiddler type', () => {
  const fields = droppedTiddlerFields(dataTransfer({
    'text/vnd.tiddler': JSON.stringify({ title: 'A', text: 'x' })
  }))
  assert.equal(fields.title, 'A')
})

test('payload: falls back to the data: URL form', () => {
  const json = JSON.stringify({ title: 'B', text: 'y' })
  const fields = droppedTiddlerFields(dataTransfer({
    URL: 'data:text/vnd.tiddler,' + encodeURIComponent(json)
  }))
  assert.equal(fields.title, 'B')
})

test('payload: a multi-tiddler drag takes the first', () => {
  const fields = droppedTiddlerFields(dataTransfer({
    'text/vnd.tiddler': JSON.stringify([{ title: 'first' }, { title: 'second' }])
  }))
  assert.equal(fields.title, 'first')
})

test('payload: plain text and nonsense yield nothing', () => {
  assert.equal(droppedTiddlerFields(dataTransfer({ 'text/plain': 'hi' })), null)
  assert.equal(droppedTiddlerFields(dataTransfer({ 'text/vnd.tiddler': 'nope' })), null)
  assert.equal(droppedTiddlerFields(null), null)
})
