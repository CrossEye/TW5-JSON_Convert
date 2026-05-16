const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')
const { convert } = require(
  '../wiki/plugins/json-convert/engine/convert.js'
)
const { validateProfile } = require(
  '../wiki/plugins/json-convert/engine/validate.js'
)

// Plugin-shipped wikitext transforms (loaded at runtime by
// collectUserTransforms but invisible to the headless engine).  Stub
// them in for validation so profiles that reference them validate clean.
const SHIPPED_WIKITEXT_TRANSFORMS = {
  'slugify':       (v) => v,
  'to-lower-case': (v) => v,
  'to-title-case': (v) => v,
  'to-upper-case': (v) => v
}

const PROFILES_DIR = join(
  __dirname, '..', 'wiki', 'tiddlers', 'profiles'
)

const readTidBody = (relPath) => {
  const content = readFileSync(join(PROFILES_DIR, relPath), 'utf8')
  const m = /\r?\n\r?\n/.exec(content)
  return m ? content.slice(m.index + m[0].length) : ''
}

// Pair every Example-X.json.tid profile with its Example-X-Data.json.tid
// data file (or with explicit overrides for many-to-many cases).
const PAIRS = [
  { profile: 'Example-Moodle-Quiz.json.tid',
    data:    'Example-Moodle-Quiz-Data.json.tid' },
  { profile: 'Example-Moodle-Forum.json.tid',
    data:    'Example-Moodle-Forum-Data.json.tid' },
  { profile: 'Example-Moodle-Forum.json.tid',
    data:    'Moodle-Forum-Data-with-junk.tid' },
  { profile: 'Example-Music-Library.json.tid',
    data:    'Example-Music-Library-Data.json.tid' },
  { profile: 'Example-Music-Library-by-Album.json.tid',
    data:    'Example-Music-Library-Data.json.tid' },
  { profile: 'Example-Reading-List.json.tid',
    data:    'Example-Reading-List-Data.json.tid' },
  { profile: 'Example-Trip-Itinerary.json.tid',
    data:    'Example-Trip-Itinerary-Data.json.tid' },
  { profile: 'Example-Moodle-Gradebook.tid',
    data:    'Example-Moodle-Gradebook-Data.json.tid' }
]

const profileFiles = readdirSync(PROFILES_DIR)
  .filter((f) => f.startsWith('Example-') &&
    (f.endsWith('.json.tid') || f.endsWith('.tid')) &&
    !f.includes('-Data') &&
    !f.includes('-with-junk'))

test('every Example-* profile validates clean', () => {
  for (const f of profileFiles) {
    const profile = JSON.parse(readTidBody(f))
    const errs = validateProfile(profile, SHIPPED_WIKITEXT_TRANSFORMS)
    assert.deepEqual(
      errs, [],
      `Profile ${f} has errors: ${JSON.stringify(errs)}`
    )
  }
})

for (const { profile, data } of PAIRS) {
  test(`${profile} + ${data} converts without errors`, () => {
    const profileObj = JSON.parse(readTidBody(profile))
    const sample = readTidBody(data)
    const r = convert(sample, profileObj, new Set(),
      { transforms: SHIPPED_WIKITEXT_TRANSFORMS })
    assert.equal(
      r.errors.length, 0,
      `Errors: ${JSON.stringify(r.errors)}`
    )
    assert.ok(r.tiddlers.length > 0, 'expected at least one tiddler')
  })
}

test('starter Moodle Quiz: spot-check first record', () => {
  const profile = JSON.parse(readTidBody('Example-Moodle-Quiz.json.tid'))
  const sample = readTidBody('Example-Moodle-Quiz-Data.json.tid')
  const r = convert(sample, profile, new Set())
  const first = r.tiddlers[0]
  assert.equal(first.title, 'MATH101/addition-basics-541563')
  assert.equal(first.text, '<p>What is <b>2 + 2</b>?</p>')
  assert.equal(first.tags, 'algebra [[basic math]] arithmetic')
  assert.equal(first.type, 'text/vnd.tiddlywiki')
  assert.equal(first['moodle-id'], '541563')
})
