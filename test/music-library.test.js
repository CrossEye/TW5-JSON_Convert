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

const PROFILES_DIR = join(__dirname, '..', 'wiki', 'tiddlers', 'profiles')

const readTidBody = (relPath) => {
  const content = readFileSync(join(PROFILES_DIR, relPath), 'utf8')
  const m = /\r?\n\r?\n/.exec(content)
  return m ? content.slice(m.index + m[0].length) : ''
}

const profile = JSON.parse(readTidBody('Example-Music-Library.json.tid'))
const sample = readTidBody('Example-Music-Library-Data.json.tid')

test('music-library profile validates clean', () => {
  assert.deepEqual(validateProfile(profile), [])
})

test('music-library: 2 artists × 2 albums × 3 tracks → 12 tiddlers', () => {
  const r = convert(sample, profile, new Set())
  assert.equal(r.errors.length, 0)
  assert.equal(r.tiddlers.length, 12)
  assert.equal(r.collisions.size, 0)

  const first = r.tiddlers[0]
  assert.equal(first.title, 'The Velvet Forks / Gravel and Honey / Old Engine')
  assert.equal(first.artist, 'The Velvet Forks')
  assert.equal(first.album, 'Gravel and Honey')
  assert.equal(first.year, '2019')
  assert.equal(first.label, 'Stonecut')
  assert.equal(first.country, 'US')
  assert.equal(first.duration, '3.5')
  assert.equal(
    first.tags,
    'Music [[The Velvet Forks]] [[Gravel and Honey]]'
  )

  // Spot-check a tiddler from the second artist
  const last = r.tiddlers[11]
  assert.equal(last.title, 'Mara Holloway / Riverwork / Bow Gate')
  assert.equal(last.country, 'UK')
})
