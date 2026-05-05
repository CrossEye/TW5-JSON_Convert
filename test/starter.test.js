const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { convert } = require(
  '../wiki/tiddlers/plugins/crosseye/json-convert/engine/convert.js'
)
const { validateProfile } = require(
  '../wiki/tiddlers/plugins/crosseye/json-convert/engine/validate.js'
)

const PROFILES_DIR = join(
  __dirname, '..', 'wiki', 'tiddlers', 'profiles'
)

const readTidBody = (relPath) => {
  const content = readFileSync(join(PROFILES_DIR, relPath), 'utf8')
  const m = /\r?\n\r?\n/.exec(content)
  return m ? content.slice(m.index + m[0].length) : ''
}

const profile = JSON.parse(readTidBody('Example-Moodle-Quiz.json.tid'))
const sample = readTidBody('Example-Moodle-Quiz-Data.json.tid')

test('starter profile validates clean', () => {
  assert.deepEqual(validateProfile(profile), [])
})

test('starter profile + sample data converts end-to-end', () => {
  const r = convert(sample, profile, new Set())
  assert.equal(r.errors.length, 0)
  assert.equal(r.warnings.length, 0)
  assert.equal(r.tiddlers.length, 3)
  assert.equal(r.collisions.size, 0)

  const first = r.tiddlers[0]
  assert.equal(first.title, 'MATH101/addition-basics-541563')
  assert.equal(first.text, '<p>What is <b>2 + 2</b>?</p>')
  assert.equal(first.tags, 'algebra [[basic math]] arithmetic')
  assert.equal(first.type, 'text/vnd.tiddlywiki')
  assert.equal(first['moodle-id'], '541563')
})
