const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { convert } = require(
  '../wiki/tiddlers/plugins/crosseye/json-convert/engine/convert.js'
)

const fixture = (name) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8')

const moodleProfile = {
  iteration: 'questions[*]',
  'tw-fields': {
    title: { template: '{course}/{name}-{id}' },
    text:  { path: 'questionText' },
    tags:  { path: 'category', transform: 'split-csv' },
    type:  { literal: 'text/vnd.tiddlywiki' }
  },
  'custom-fields': {
    'moodle-id': { path: 'id', transform: 'to-string' }
  }
}

const itemNameProfile = {
  iteration: 'items[*]',
  'tw-fields': {
    title: { path: 'name' }
  }
}

test('happy path: produces expected tiddlers with no errors', () => {
  const r = convert(fixture('happy-path.json'), moodleProfile, new Set())
  assert.equal(r.errors.length, 0)
  assert.equal(r.tiddlers.length, 2)
  assert.equal(r.tiddlers[0].title, 'CS101/q1-1')
  assert.equal(r.tiddlers[0].text, '<p>What is 2+2?</p>')
  assert.equal(r.tiddlers[0].tags, 'algebra [[basic math]]')
  assert.equal(r.tiddlers[0].type, 'text/vnd.tiddlywiki')
  assert.equal(r.tiddlers[0]['moodle-id'], '1')
  assert.equal(r.tiddlers[1].title, 'CS101/q2-2')
  assert.equal(r.collisions.size, 0)
})

test('numeric coercion: to-string transform produces strings', () => {
  const profile = {
    iteration: 'items[*]',
    'tw-fields': {
      title:  { path: 'name' },
      'item-id': { path: 'id', transform: 'to-string' },
      active: { path: 'active', transform: 'to-string' }
    }
  }
  const r = convert(fixture('numeric-coercion.json'), profile, new Set())
  assert.equal(r.errors.length, 0)
  assert.equal(r.tiddlers.length, 2)
  assert.equal(r.tiddlers[0]['item-id'], '541563')
  assert.equal(r.tiddlers[0].active, 'true')
  assert.equal(r.tiddlers[1].active, 'false')
})

test('missing path: emits path-missing warning, leaves field empty', () => {
  const profile = {
    iteration: 'items[*]',
    'tw-fields': {
      title:    { path: 'name' },
      missing:  { path: 'nope' }
    }
  }
  const r = convert(fixture('missing-path.json'), profile, new Set())
  assert.equal(r.errors.length, 0)
  assert.equal(r.tiddlers.length, 1)
  assert.equal(r.tiddlers[0].missing, '')
  assert.equal(r.warnings.length, 1)
  assert.equal(r.warnings[0].code, 'path-missing')
  assert.equal(r.warnings[0].path, 'nope')
  assert.equal(r.warnings[0].recordIndex, 0)
})

test('missing title: emits missing-title error, skips record', () => {
  const r = convert(fixture('missing-title.json'), itemNameProfile, new Set())
  assert.equal(r.tiddlers.length, 0)
  assert.equal(r.errors.length, 1)
  assert.equal(r.errors[0].code, 'missing-title')
  assert.equal(r.errors[0].recordIndex, 0)
})

test('iteration-not-array: returns iteration-not-array error', () => {
  const profile = {
    iteration: 'questions',
    'tw-fields': { title: { path: 'x' } }
  }
  const r = convert(fixture('iteration-not-array.json'), profile, new Set())
  assert.equal(r.tiddlers.length, 0)
  assert.equal(r.errors.length, 1)
  assert.equal(r.errors[0].code, 'iteration-not-array')
  assert.equal(r.errors[0].path, 'questions')
})

test('within-batch collision: second duplicate is skipped with error', () => {
  const r = convert(
    fixture('within-batch-collision.json'),
    itemNameProfile,
    new Set()
  )
  assert.equal(r.tiddlers.length, 2)
  assert.equal(r.tiddlers[0].title, 'duplicate')
  assert.equal(r.tiddlers[1].title, 'different')
  assert.equal(r.errors.length, 1)
  assert.equal(r.errors[0].code, 'duplicate-title')
  assert.equal(r.errors[0].recordIndex, 2)
})

test('existing title collision: title added to collisions set', () => {
  const r = convert(
    fixture('existing-title-collision.json'),
    itemNameProfile,
    new Set(['Already Here'])
  )
  assert.equal(r.tiddlers.length, 2)
  assert.equal(r.errors.length, 0)
  assert.equal(r.collisions.size, 1)
  assert.ok(r.collisions.has('Already Here'))
  assert.equal(r.collisions.has('Brand New'), false)
})

test('malformed-recoverable: parses with parse-recovered warning', () => {
  const r = convert(
    fixture('malformed-recoverable.txt'),
    itemNameProfile,
    new Set()
  )
  assert.equal(r.errors.length, 0)
  assert.equal(r.tiddlers.length, 1)
  assert.equal(r.tiddlers[0].title, 'alpha')
  assert.ok(r.warnings.some((w) => w.code === 'parse-recovered'))
})

test('malformed-unrecoverable: returns parse-failed error, no tiddlers', () => {
  const r = convert(
    fixture('malformed-unrecoverable.txt'),
    itemNameProfile,
    new Set()
  )
  assert.equal(r.tiddlers.length, 0)
  assert.equal(r.errors.length, 1)
  assert.equal(r.errors[0].code, 'parse-failed')
})

test('iteration-empty: empty array emits iteration-empty warning', () => {
  const r = convert('{"items":[]}', itemNameProfile, new Set())
  assert.equal(r.tiddlers.length, 0)
  assert.equal(r.errors.length, 0)
  assert.ok(r.warnings.some((w) => w.code === 'iteration-empty'))
})
