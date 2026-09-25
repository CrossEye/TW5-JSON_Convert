const { test } = require('node:test')
const assert = require('node:assert/strict')
const { mergeRecordShapes } = require(
  '../wiki/plugins/json-convert/engine/shape.js'
)
const {
  serializeShape, compareShapes, isMismatch, topLevelFields
} = require('../wiki/plugins/json-convert/engine/shape-diff.js')

const shapeOf = (records) => serializeShape(mergeRecordShapes(records))

const expected = shapeOf([
  { title: 'Dune', author: 'Herbert', year: 1965, tags: ['sf'],
    publisher: { name: 'Chilton', city: 'Philadelphia' } }
])

test('serializeShape: JSON-safe, types as sorted arrays, no sample values', () => {
  assert.deepEqual(expected.children.year, {
    kind: 'leaf', presence: 'all', types: ['number']
  })
  assert.equal(expected.children.tags.kind, 'array')
  assert.deepEqual(expected.children.tags.element.types, ['string'])
  assert.equal(JSON.stringify(expected).includes('sampleValue'), false)
  assert.deepEqual(JSON.parse(JSON.stringify(expected)), expected)
  assert.equal(serializeShape(null), null)
})

test('compareShapes: identical shapes produce an empty diff', () => {
  const diff = compareShapes(expected, expected)
  assert.deepEqual(diff, { missing: [], added: [], changed: [] })
  assert.equal(isMismatch(diff), false)
})

test('compareShapes: missing, added and nested paths', () => {
  const actual = shapeOf([
    { title: 'Dune', year: 1965, tags: ['sf'], isbn: 'x',
      publisher: { name: 'Chilton' } }
  ])
  const diff = compareShapes(expected, actual)
  assert.deepEqual(diff.missing, ['author', 'publisher.city'])
  assert.deepEqual(diff.added, ['isbn'])
  assert.deepEqual(diff.changed, [])
  assert.equal(isMismatch(diff), true)
})

test('compareShapes: a leaf whose type changed', () => {
  const actual = shapeOf([
    { title: 'Dune', author: 'Herbert', year: '1965', tags: ['sf'],
      publisher: { name: 'Chilton', city: 'Philadelphia' } }
  ])
  const diff = compareShapes(expected, actual)
  assert.deepEqual(diff.changed, [
    { path: 'year', expected: 'number', actual: 'string' }
  ])
})

test('compareShapes: null values and extra-but-compatible types are tolerated', () => {
  const actual = shapeOf([
    { title: 'Dune', author: null, year: 1965, tags: ['sf'],
      publisher: { name: 'Chilton', city: 'Philadelphia' } }
  ])
  assert.equal(isMismatch(compareShapes(expected, actual)), false)
})

test('compareShapes: kind change is reported, mixed is not', () => {
  const actual = shapeOf([
    { title: 'Dune', author: 'Herbert', year: 1965, tags: 'sf',
      publisher: 'Chilton' }
  ])
  const diff = compareShapes(expected, actual)
  assert.deepEqual(diff.changed, [
    { path: 'tags', expected: 'array', actual: 'leaf' },
    { path: 'publisher', expected: 'object', actual: 'leaf' }
  ])
  const mixed = shapeOf([{ title: 'a', author: 'b', year: 1, tags: ['x'], publisher: 'p' },
                         { title: 'c', author: 'd', year: 2, tags: ['y'], publisher: { name: 'q', city: 'r' } }])
  assert.equal(mixed.children.publisher.kind, 'mixed')
  assert.deepEqual(compareShapes(expected, mixed).changed, [])
})

test('compareShapes: array elements are compared under [*]', () => {
  const e = shapeOf([{ rows: [{ id: 1, name: 'a' }] }])
  const a = shapeOf([{ rows: [{ id: 1 }] }])
  assert.deepEqual(compareShapes(e, a).missing, ['rows[*].name'])
})

test('topLevelFields lists the keys of an object shape', () => {
  assert.deepEqual(topLevelFields(expected), ['title', 'author', 'year', 'tags', 'publisher'])
  assert.deepEqual(topLevelFields(null), [])
  assert.deepEqual(topLevelFields(shapeOf([1, 2])), [])
})
