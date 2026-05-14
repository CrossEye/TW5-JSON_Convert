const { test } = require('node:test')
const assert = require('node:assert/strict')
const { mergeRecordShapes } = require(
  '../wiki/plugins/json-convert/engine/shape.js'
)

const repeat = (record, n) => Array.from({ length: n }, () => structuredClone(record))

test('returns null for empty record list', () => {
  assert.equal(mergeRecordShapes([]), null)
})

test('returns null for non-array input', () => {
  assert.equal(mergeRecordShapes(null), null)
  assert.equal(mergeRecordShapes(undefined), null)
  assert.equal(mergeRecordShapes({}), null)
})

test('single record produces shape with all "all" presence', () => {
  const result = mergeRecordShapes([{ id: 1, name: 'a' }])
  assert.equal(result.kind, 'object')
  assert.equal(result.presence, 'all')
  assert.equal(result.children.id.kind, 'leaf')
  assert.equal(result.children.id.presence, 'all')
  assert.equal(result.children.name.presence, 'all')
})

test('uniform records below threshold: all presence is "all"', () => {
  const records = repeat({ id: 1, name: 'a' }, 5)
  const result = mergeRecordShapes(records)
  assert.equal(result.children.id.presence, 'all')
  assert.equal(result.children.name.presence, 'all')
})

test('below-threshold heterogeneous keys still report "all"', () => {
  // 5 records < default threshold of 10 → no presence tracking,
  // bucketing collapses to "all" everywhere.
  const records = [
    { id: 1, name: 'a' },
    { id: 2 },
    { id: 3 },
    { id: 4 },
    { id: 5 }
  ]
  const result = mergeRecordShapes(records)
  assert.equal(result.children.id.presence, 'all')
  assert.equal(result.children.name.presence, 'all')
})

test('above-threshold uniform records: all presence is "all"', () => {
  const records = repeat({ id: 1, name: 'a' }, 10)
  const result = mergeRecordShapes(records)
  assert.equal(result.children.id.presence, 'all')
  assert.equal(result.children.name.presence, 'all')
})

test('above-threshold partial presence: "most"', () => {
  const records = [
    ...repeat({ id: 1, name: 'a' }, 7),
    ...repeat({ id: 1 }, 3)
  ]
  const result = mergeRecordShapes(records)
  assert.equal(result.children.id.presence, 'all')
  assert.equal(result.children.name.presence, 'most')
})

test('above-threshold rare presence: "some"', () => {
  const records = [
    ...repeat({ id: 1, name: 'a' }, 2),
    ...repeat({ id: 1 }, 8)
  ]
  const result = mergeRecordShapes(records)
  assert.equal(result.children.name.presence, 'some')
})

test('above-threshold single occurrence: "one"', () => {
  const records = [
    { id: 1, name: 'a' },
    ...repeat({ id: 1 }, 9)
  ]
  const result = mergeRecordShapes(records)
  assert.equal(result.children.name.presence, 'one')
})

test('"one" beats "most" when count is 1 even if 1 >= total/2', () => {
  // total = 2, count = 1 → 1 >= 1 → would be "most" without the
  // single-occurrence override.
  const records = [{ id: 1, name: 'a' }, { id: 1 }]
  const result = mergeRecordShapes(records, { threshold: 1 })
  assert.equal(result.children.name.presence, 'one')
})

test('child presence is relative to parent reach', () => {
  // 10 records total. `meta` appears in 6 of them, but in those 6
  // it always has both `course` and `year`. So:
  //   meta:        6/10 → "most"
  //   meta.course: 6/6  → "all"
  //   meta.year:   6/6  → "all"
  const records = [
    ...repeat({ meta: { course: 'CS', year: 2026 } }, 6),
    ...repeat({}, 4)
  ]
  const result = mergeRecordShapes(records)
  assert.equal(result.children.meta.presence, 'most')
  assert.equal(result.children.meta.children.course.presence, 'all')
  assert.equal(result.children.meta.children.year.presence, 'all')
})

test('mixed kind at same path produces "mixed" node', () => {
  const records = repeat({ foo: { x: 1 } }, 5)
    .concat(repeat({ foo: [1, 2, 3] }, 5))
  const result = mergeRecordShapes(records)
  assert.equal(result.children.foo.kind, 'mixed')
  assert.equal(result.children.foo.presence, 'all')
})

test('leaf type set unions across records', () => {
  const records = [
    { v: 'hi' },
    { v: 42 },
    { v: null },
    { v: true }
  ]
  const result = mergeRecordShapes(records)
  const types = result.children.v.types
  assert.ok(types.has('string'))
  assert.ok(types.has('number'))
  assert.ok(types.has('null'))
  assert.ok(types.has('boolean'))
})

test('leaf sample value is first non-undefined seen', () => {
  const records = [{ v: 'hello' }, { v: 'world' }]
  const result = mergeRecordShapes(records)
  assert.equal(result.children.v.sampleValue, 'hello')
})

test('array of leaves: element is leaf with merged types', () => {
  const records = [
    { tags: ['a', 'b'] },
    { tags: ['c'] }
  ]
  const result = mergeRecordShapes(records)
  assert.equal(result.children.tags.kind, 'array')
  assert.equal(result.children.tags.element.kind, 'leaf')
  assert.equal(result.children.tags.element.inArray, true)
  assert.ok(result.children.tags.element.types.has('string'))
})

test('array elements have inArray true; presence is undefined', () => {
  const records = [{ tags: ['a'] }]
  const result = mergeRecordShapes(records)
  assert.equal(result.children.tags.element.inArray, true)
  assert.equal(result.children.tags.element.presence, undefined)
})

test('array of objects: element keys union across records and elements', () => {
  const records = [
    { answers: [{ name: 'a', text: 'hi' }, { name: 'b' }] },
    { answers: [{ text: 'bye', weight: 1 }] }
  ]
  const result = mergeRecordShapes(records)
  const el = result.children.answers.element
  assert.equal(el.kind, 'object')
  assert.equal(el.inArray, true)
  assert.ok('name' in el.children)
  assert.ok('text' in el.children)
  assert.ok('weight' in el.children)
  // Inside an array, presence is undefined.
  assert.equal(el.children.weight.presence, undefined)
})

test('empty arrays everywhere: array node has no element', () => {
  const records = [{ tags: [] }, { tags: [] }]
  const result = mergeRecordShapes(records)
  assert.equal(result.children.tags.kind, 'array')
  assert.equal(result.children.tags.element, undefined)
})

test('arrays of arrays: nested element propagates inArray', () => {
  const records = [
    { matrix: [[1, 2], [3]] },
    { matrix: [[4]] }
  ]
  const result = mergeRecordShapes(records)
  const outer = result.children.matrix
  assert.equal(outer.kind, 'array')
  assert.equal(outer.inArray, false)
  const inner = outer.element
  assert.equal(inner.kind, 'array')
  assert.equal(inner.inArray, true)
  const leaf = inner.element
  assert.equal(leaf.kind, 'leaf')
  assert.equal(leaf.inArray, true)
  assert.ok(leaf.types.has('number'))
})

test('threshold can be overridden', () => {
  // 3 records, threshold 2 → presence tracking enabled.
  const records = [
    { id: 1, name: 'a' },
    { id: 2 },
    { id: 3 }
  ]
  const result = mergeRecordShapes(records, { threshold: 2 })
  assert.equal(result.children.id.presence, 'all')
  // 1 of 3 → "one"
  assert.equal(result.children.name.presence, 'one')
})

test('mixed inside array: element is "mixed"', () => {
  const records = [
    { items: [1, 'two', null, { nested: true }] }
  ]
  const result = mergeRecordShapes(records)
  assert.equal(result.children.items.kind, 'array')
  assert.equal(result.children.items.element.kind, 'mixed')
  assert.equal(result.children.items.element.inArray, true)
})

test('Moodle-shaped sample: heterogeneous question types', () => {
  // Mimics Moodle exports where multichoice has answers[] and
  // essay doesn't.  10 records: 6 multichoice, 4 essay.
  const records = [
    ...repeat({
      type: 'multichoice',
      text: 'Q?',
      answers: [{ name: 'a', text: 'A' }]
    }, 6),
    ...repeat({
      type: 'essay',
      text: 'Q?',
      responseformat: 'html'
    }, 4)
  ]
  const result = mergeRecordShapes(records)
  assert.equal(result.children.type.presence, 'all')
  assert.equal(result.children.text.presence, 'all')
  assert.equal(result.children.answers.presence, 'most')   // 6/10
  assert.equal(result.children.responseformat.presence, 'some')   // 4/10
})
