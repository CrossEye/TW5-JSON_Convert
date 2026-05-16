const { test } = require('node:test')
const assert = require('node:assert/strict')
const { passThroughPath } = require(
  '../wiki/plugins/json-convert/engine/field-name.js'
)

const leaves = (...paths) => new Set(paths)

test('plain pass-through recognized', () => {
  assert.equal(passThroughPath('{{foo}}', 'foo', leaves('foo')), 'foo')
})

test('with transform → not a pass-through', () => {
  assert.equal(passThroughPath('{{foo|slugify}}', 'foo', leaves('foo')), null)
})

test('two tokens → not a pass-through', () => {
  assert.equal(
    passThroughPath('{{foo}}{{bar}}', 'foo', leaves('foo', 'bar')),
    null
  )
})

test('token plus literal → not a pass-through', () => {
  assert.equal(
    passThroughPath('{{foo}} literal', 'foo', leaves('foo')),
    null
  )
})

test('path not in known leaves → not a pass-through', () => {
  assert.equal(passThroughPath('{{foo}}', 'foo', leaves('bar')), null)
})

test('dotted path with last-segment name', () => {
  assert.equal(
    passThroughPath('{{author.name}}', 'name', leaves('author.name')),
    'author.name'
  )
})

test('dotted path with full-prefix name', () => {
  assert.equal(
    passThroughPath('{{author.name}}', 'author-name', leaves('author.name')),
    'author.name'
  )
})

test('dotted path with random name → not a pass-through', () => {
  assert.equal(
    passThroughPath('{{author.name}}', 'something-else', leaves('author.name')),
    null
  )
})

test('numeric-suffix variant of full-prefix recognized', () => {
  assert.equal(
    passThroughPath('{{author.name}}', 'author-name-2', leaves('author.name')),
    'author.name'
  )
})

test('hostile path with `field` fallback name', () => {
  assert.equal(
    passThroughPath('{{!!!}}', 'field', leaves('!!!')),
    '!!!'
  )
  assert.equal(
    passThroughPath('{{!!!}}', 'field-3', leaves('!!!')),
    '!!!'
  )
})

test('hostile path with random name → not a pass-through', () => {
  assert.equal(
    passThroughPath('{{!!!}}', 'whatever', leaves('!!!')),
    null
  )
})

test('empty/garbage values → not a pass-through', () => {
  assert.equal(passThroughPath('', 'x', leaves('x')), null)
  assert.equal(passThroughPath(null, 'x', leaves('x')), null)
  assert.equal(passThroughPath('not a token', 'x', leaves('x')), null)
  assert.equal(passThroughPath('{foo}', 'foo', leaves('foo')), null)
  assert.equal(passThroughPath('{{foo', 'foo', leaves('foo')), null)
})

test('takenNames-style array also accepted for leafPaths', () => {
  assert.equal(passThroughPath('{{foo}}', 'foo', ['foo']), 'foo')
})

test('bracket paths', () => {
  assert.equal(
    passThroughPath('{{answers[0].text}}', 'text', leaves('answers[0].text')),
    'answers[0].text'
  )
  assert.equal(
    passThroughPath('{{answers[0].text}}', 'answers-text', leaves('answers[0].text')),
    'answers[0].text'
  )
})
