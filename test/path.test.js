const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parsePath, resolvePath, hasStar, hasParent, parentCount } = require(
  '../wiki/plugins/json-convert/engine/path.js'
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

test('parsePath: leading .. segment alone', () => {
  assert.deepEqual(parsePath('..'), [{ type: 'parent' }])
})

test('parsePath: leading ../foo descends after going up', () => {
  assert.deepEqual(parsePath('../foo'), [
    { type: 'parent' },
    { type: 'key', key: 'foo' }
  ])
})

test('parsePath: chained ../../foo.bar', () => {
  assert.deepEqual(parsePath('../../foo.bar'), [
    { type: 'parent' },
    { type: 'parent' },
    { type: 'key', key: 'foo' },
    { type: 'key', key: 'bar' }
  ])
})

test('parsePath: ../foo[0] mixes up + index', () => {
  assert.deepEqual(parsePath('../foo[0]'), [
    { type: 'parent' },
    { type: 'key', key: 'foo' },
    { type: 'index', index: 0 }
  ])
})

test('parsePath: rejects ..foo (missing slash separator)', () => {
  assert.equal(parsePath('..foo'), null)
})

test('parsePath: rejects trailing slash after ..', () => {
  assert.equal(parsePath('../'), null)
})

test('hasParent + parentCount', () => {
  assert.equal(hasParent(parsePath('foo')), false)
  assert.equal(parentCount(parsePath('foo')), 0)
  assert.equal(hasParent(parsePath('../foo')), true)
  assert.equal(parentCount(parsePath('../foo')), 1)
  assert.equal(parentCount(parsePath('../../../foo')), 3)
  assert.equal(parentCount(parsePath('..')), 1)
})
