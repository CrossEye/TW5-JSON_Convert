const { test } = require('node:test')
const assert = require('node:assert/strict')
const { flattenPath, splitPath, slugify } = require(
  '../wiki/plugins/json-convert/engine/field-name.js'
)

test('slugify: lowercase + non-alnum runs to dashes + trim', () => {
  assert.equal(slugify('Hello, World!'), 'hello-world')
  assert.equal(slugify('  spaced  '), 'spaced')
  assert.equal(slugify('AlreadyClean'), 'alreadyclean')
  assert.equal(slugify('---'), '')
})

test('splitPath: dotted', () => {
  assert.deepEqual(splitPath('author.name'), ['author', 'name'])
})

test('splitPath: bracketed indices stripped', () => {
  assert.deepEqual(splitPath('answers[0].text'), ['answers', 'text'])
})

test('splitPath: [*] stripped', () => {
  assert.deepEqual(splitPath('tracks[*].minutes'), ['tracks', 'minutes'])
})

test('splitPath: deep nest', () => {
  assert.deepEqual(splitPath('a.b[0].c.d'), ['a', 'b', 'c', 'd'])
})

test('flattenPath: simple leaf returns last segment slug', () => {
  assert.equal(flattenPath('title', new Set()), 'title')
  assert.equal(flattenPath('customer_id', new Set()), 'customer-id')
})

test('flattenPath: dotted, last segment unique', () => {
  assert.equal(flattenPath('author.name', new Set()), 'name')
})

test('flattenPath: dotted, last segment taken → join with parent', () => {
  assert.equal(flattenPath('author.name', new Set(['name'])), 'author-name')
})

test('flattenPath: deep nest, walk back to root', () => {
  const taken = new Set(['email', 'contact-email', 'author-contact-email'])
  assert.equal(flattenPath('record.author.contact.email', taken),
    'record-author-contact-email')
})

test('flattenPath: brackets ignored as segments', () => {
  assert.equal(flattenPath('answers[0].text', new Set()), 'text')
  assert.equal(flattenPath('answers[0].text', new Set(['text'])),
    'answers-text')
})

test('flattenPath: [*] ignored as segments', () => {
  assert.equal(flattenPath('tracks[*].minutes', new Set()), 'minutes')
})

test('flattenPath: hostile keys slugified', () => {
  assert.equal(flattenPath('!!!weird key!!!', new Set()), 'weird-key')
})

test('flattenPath: empty after slug + no usable parent → field-N', () => {
  assert.equal(flattenPath('!!!', new Set()), 'field')
  assert.equal(flattenPath('---', new Set(['field'])), 'field-2')
})

test('flattenPath: root-level collision after full join → numeric suffix', () => {
  assert.equal(flattenPath('foo.bar', new Set(['bar', 'foo-bar'])),
    'foo-bar-2')
})

test('flattenPath: takenNames accepts array too', () => {
  assert.equal(flattenPath('author.name', ['name']), 'author-name')
})
