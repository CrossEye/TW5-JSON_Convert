const { test } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

// The pack builder requires engine modules by their TiddlyWiki titles.
const origResolve = Module._resolveFilename
Module._resolveFilename = function(request, parent, ...rest) {
  const m = /^\$:\/plugins\/crosseye\/(json-convert(?:-studio)?)\/(.*)$/
    .exec(request)
  if (m) return require.resolve(`../wiki/plugins/${m[1]}/${m[2]}`)
  return origResolve.call(this, request, parent, ...rest)
}

const {
  buildPack, fingerprint, referencedTransforms, packTitleFor,
  compareVersions, bumpPatch
} = require('../wiki/plugins/json-convert-studio/pack/build.js')

const profileText = JSON.stringify({
  records: '{{books[*]}}',
  'tw-fields': {
    title: '{{author|year-bucket}}: {{title}}',
    tags: 'Book {{genre|split-commas}}'
  },
  'custom-fields': { year: '{{year|to-upper-case}}' }
})

const sampleText = JSON.stringify({
  books: [
    { title: 'Dune', author: 'Frank Herbert', year: 1965, genre: 'sf' },
    { title: 'Kindred', author: 'Octavia Butler', year: 1979, genre: 'sf' }
  ]
})

const transforms = {
  'year-bucket': {
    title: 'Year Bucket',
    fields: {
      title: 'Year Bucket',
      type: 'application/javascript',
      tags: '$:/tags/json-convert/transform',
      text: 'return String(value)'
    },
    builtin: false
  },
  'to-upper-case': {
    title: '$:/plugins/crosseye/json-convert/transforms/to-upper-case',
    fields: {
      title: '$:/plugins/crosseye/json-convert/transforms/to-upper-case',
      type: 'text/vnd.tiddlywiki',
      text: '<$text text={{{ [<value>uppercase[]] }}}/>'
    },
    builtin: true
  }
}

const form = {
  profile: 'Example Reading List',
  publisher: 'acme',
  slug: 'reading-list-importer',
  name: 'Reading List Importer',
  description: '',
  author: 'Ann Author',
  version: '0.1.0',
  caption: 'Import Reading List',
  panelDescription: 'Paste the export here.',
  convertLabel: 'Stage books',
  applyLabel: '',
  collisions: 'overwrite',
  studioUrl: 'https://example.org/studio/'
}

const input = (overrides = {}) => ({
  form,
  profile: { title: form.profile, text: profileText, fields: {} },
  transforms,
  sample: { title: 'Sample', text: sampleText },
  runtime: {
    title: '$:/plugins/crosseye/json-convert',
    version: '0.11.0',
    coreVersion: '>=5.4.0'
  },
  installed: null,
  now: '20260924120000000',
  ...overrides
})

const innerTiddlers = (pack) => JSON.parse(pack.text).tiddlers

test('buildPack: a complete pack from a valid profile', () => {
  const result = buildPack(input())
  assert.deepEqual(result.errors, [])
  const { pack } = result
  assert.equal(pack.title, '$:/plugins/acme/reading-list-importer')
  assert.equal(pack['plugin-type'], 'plugin')
  assert.equal(pack.dependents, '$:/plugins/crosseye/json-convert')
  assert.equal(pack.version, '0.1.0')
  assert.equal(pack.description, 'Imports Reading List Importer JSON as tiddlers')
  assert.equal(pack.source, 'https://example.org/studio/')
  assert.equal(pack['json-convert-pack'], 'reading-list-importer')
  assert.equal(pack['source-profile'], 'Example Reading List')

  const inner = innerTiddlers(pack)
  const base = '$:/plugins/acme/reading-list-importer'
  assert.deepEqual(Object.keys(inner).sort(), [
    `${base}/importer`, `${base}/profile`, `${base}/readme`,
    `${base}/sample`, `${base}/shape`, `${base}/transforms/year-bucket`
  ])
  assert.equal(pack.list, 'readme')

  const panel = inner[`${base}/importer`]
  assert.equal(panel.caption, 'Import Reading List')
  assert.equal(panel.tags, undefined)
  assert.equal(panel.slug, 'reading-list-importer')
  assert.equal(panel.profile, `${base}/profile`)
  assert.equal(panel.sample, `${base}/sample`)
  assert.equal(panel.shape, `${base}/shape`)
  assert.equal(panel['convert-label'], 'Stage books')
  assert.equal(panel['apply-label'], 'Apply')
  assert.equal(panel.collisions, 'overwrite')
  assert.equal(panel['runtime-min'], '0.11.0')
  assert.equal(panel['studio-url'], 'https://example.org/studio/')
  assert.equal(panel.author, 'Ann Author')
  assert.equal(panel.description, 'Paste the export here.')
  assert.match(panel.text, /consumer-panel/)
  assert.match(panel.text, /version 0\.11\.0 or newer/)
  assert.match(panel.text, /pack="\$:\/plugins\/acme\/reading-list-importer\/importer"/)
  assert.match(panel.text, /\[\[the \$:\/plugins\/crosseye\/json-convert tiddler\|https:\/\/example\.org\/studio\/#%24%3A%2Fplugins%2Fcrosseye%2Fjson-convert\]\]/)

  const readme = inner[`${base}/readme`]
  assert.equal(readme.type, 'text/vnd.tiddlywiki')
  assert.match(readme.text, /^! Reading List Importer\n/)
  assert.match(readme.text, /\[\[Import Reading List\|\$:\/plugins\/acme\/reading-list-importer\/importer\]\]/)
  assert.match(readme.text, /fields `title`, `author`, `year`, `genre`/)
  assert.match(readme.text, /Version 0\.1\.0, made 2026-09-24 with \[\[JSON Convert Studio\|https:\/\/example\.org\/studio\/\]\]/)
  assert.match(readme.text, /runtime 0\.11\.0 or newer/)

  const profile = JSON.parse(inner[`${base}/profile`].text)
  assert.equal(profile.format, 1)
  assert.equal(profile.records, '{{books[*]}}')
  assert.equal(inner[`${base}/profile`].tags, '$:/tags/json-convert/profile')
  assert.equal(inner[`${base}/profile`].caption, 'Reading List Importer')

  const copied = inner[`${base}/transforms/year-bucket`]
  assert.equal(copied.name, 'year-bucket')
  assert.equal(copied.type, 'application/javascript')
  assert.equal(copied.tags, '$:/tags/json-convert/transform')
  assert.deepEqual(result.transforms, ['year-bucket'])
  assert.equal(result.containsJs, true)

  const shape = JSON.parse(inner[`${base}/shape`].text)
  assert.equal(shape.records, '{{books[*]}}')
  assert.equal(shape.count, 2)
  assert.equal(shape.shape.kind, 'object')
  assert.deepEqual(shape.shape.children.year.types, ['number'])
  assert.equal(JSON.stringify(shape).includes('sampleValue'), false)
})

test('buildPack: no sample means no sample or shape tiddlers', () => {
  const result = buildPack(input({ sample: null }))
  assert.deepEqual(result.errors, [])
  const inner = innerTiddlers(result.pack)
  assert.equal(Object.keys(inner).some((k) => /\/(sample|shape)$/.test(k)), false)
  assert.equal(inner['$:/plugins/acme/reading-list-importer/importer'].sample, undefined)
  assert.equal(inner['$:/plugins/acme/reading-list-importer/importer'].shape, undefined)
  assert.equal(/It expects JSON records/.test(inner['$:/plugins/acme/reading-list-importer/readme'].text), false)
  assert.equal(result.hasSample, false)
})

test('buildPack: form validation', () => {
  const bad = buildPack(input({
    form: { ...form, publisher: 'Acme Inc', slug: '', name: ' ', caption: '',
            version: '1.2', collisions: 'ask' }
  }))
  assert.deepEqual(bad.errors.map((e) => e.code), [
    'bad-publisher', 'bad-slug', 'missing-name', 'missing-caption',
    'bad-version', 'bad-collisions'
  ])
})

test('buildPack: a referenced transform that does not exist is an error', () => {
  const result = buildPack(input({ transforms: { 'to-upper-case': transforms['to-upper-case'] } }))
  assert.deepEqual(result.errors.map((e) => e.code), ['profile-invalid'])
  assert.match(result.errors[0].message, /unknown-transform.*year-bucket/)
})

test('buildPack: invalid or missing profile', () => {
  assert.deepEqual(
    buildPack(input({ profile: null })).errors.map((e) => e.code),
    ['missing-profile']
  )
  assert.deepEqual(
    buildPack(input({ profile: { title: 'P', text: '{oops', fields: {} } }))
      .errors.map((e) => e.code),
    ['profile-not-json']
  )
})

test('buildPack: version must exceed an installed pack', () => {
  const same = buildPack(input({ installed: '0.1.0' }))
  assert.deepEqual(same.errors.map((e) => e.code), ['version-not-newer'])
  assert.match(same.errors[0].message, /use 0\.1\.1 or higher/)
  const newer = buildPack(input({ installed: '0.0.9' }))
  assert.deepEqual(newer.errors, [])
})

test('buildPack: sample that the profile cannot read is an error', () => {
  const result = buildPack(input({ sample: { title: 'S', text: '{"nope": []}' } }))
  assert.deepEqual(result.errors.map((e) => e.code), ['sample-mismatch'])
  const malformed = buildPack(input({ sample: { title: 'S', text: '{"books": [' } }))
  assert.deepEqual(malformed.errors.map((e) => e.code), ['sample-mismatch'])
})

test('referencedTransforms walks both binding groups', () => {
  assert.deepEqual(
    [...referencedTransforms(JSON.parse(profileText))].sort(),
    ['split-commas', 'to-upper-case', 'year-bucket']
  )
})

test('fingerprint records the merged record shape', () => {
  const fp = fingerprint(sampleText, JSON.parse(profileText))
  assert.equal(fp.count, 2)
  assert.deepEqual(Object.keys(fp.shape.children).sort(), ['author', 'genre', 'title', 'year'])
})

test('version helpers', () => {
  assert.equal(packTitleFor('acme', 'x'), '$:/plugins/acme/x')
  assert.equal(compareVersions('0.10.1', '0.9.9'), 1)
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0)
  assert.equal(compareVersions('1.0.0', '1.0.1'), -1)
  assert.equal(bumpPatch('0.10.1'), '0.10.2')
})

test('referencedTransforms strips parameters', () => {
  const names = referencedTransforms({ 'tw-fields': { a: '{{x|year-bucket[10]|zero-pad[3]}}' } })
  assert.deepEqual([...names].sort(), ['year-bucket', 'zero-pad'])
})
