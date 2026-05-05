const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parsePath, resolvePath, hasStar } = require(
  '../wiki/tiddlers/plugins/crosseye/json-convert/engine/path.js'
)

const data = {
  questions: [
    { id: 1, name: 'q1', answers: [{ text: 'a' }, { text: 'b' }] },
    { id: 2, name: 'q2', answers: [{ text: 'c' }] }
  ],
  tags: ['x', 'y', 'z'],
  meta: { course: 'CS101' }
}

test('resolvePath: simple key access', () => {
  assert.equal(resolvePath(data, 'meta.course'), 'CS101')
})

test('resolvePath: numeric index access', () => {
  assert.equal(resolvePath(data, 'questions[0].name'), 'q1')
})

test('resolvePath: star at end returns whole array', () => {
  assert.equal(resolvePath(data, 'tags[*]').length, 3)
})

test('resolvePath: mixed star and index', () => {
  assert.deepEqual(
    resolvePath(data, 'questions[*].answers[0].text'),
    ['a', 'c']
  )
})

test('resolvePath: double star flattens', () => {
  assert.deepEqual(
    resolvePath(data, 'questions[*].answers[*].text'),
    ['a', 'b', 'c']
  )
})

test('resolvePath: missing key returns undefined', () => {
  assert.equal(resolvePath(data, 'meta.nope'), undefined)
})

test('resolvePath: missing root key returns undefined', () => {
  assert.equal(resolvePath(data, 'nope.deep'), undefined)
})

test('resolvePath: index out of range returns undefined', () => {
  assert.equal(resolvePath(data, 'questions[5].name'), undefined)
})

test('resolvePath: key on array returns undefined', () => {
  assert.equal(resolvePath(data, 'tags.foo'), undefined)
})

test('resolvePath: index on object returns undefined', () => {
  assert.equal(resolvePath(data, 'meta[0]'), undefined)
})

test('resolvePath: empty path returns identity', () => {
  assert.equal(resolvePath(data, ''), data)
})

test('resolvePath: never throws on bad input', () => {
  assert.doesNotThrow(() => resolvePath(null, 'a.b.c'))
  assert.doesNotThrow(() => resolvePath(undefined, 'a.b.c'))
  assert.doesNotThrow(() => resolvePath(42, 'a.b.c'))
})

test('parsePath: rejects double dots', () => {
  assert.equal(parsePath('foo..bar'), null)
})

test('parsePath: rejects leading dot', () => {
  assert.equal(parsePath('.lead'), null)
})

test('parsePath: rejects index without leading key segment', () => {
  assert.equal(parsePath('[0]bad'), null)
})

test('parsePath: rejects non-numeric non-star index', () => {
  assert.equal(parsePath('foo[abc]'), null)
})

test('parsePath: rejects unclosed bracket', () => {
  assert.equal(parsePath('foo['), null)
  assert.equal(parsePath('foo[*'), null)
})

test('hasStar: detects star segment', () => {
  assert.equal(hasStar(parsePath('questions[*].id')), true)
  assert.equal(hasStar(parsePath('meta.course')), false)
  assert.equal(hasStar(parsePath('items[0]')), false)
})
