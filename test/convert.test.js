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
  iteration: '{{questions[*]}}',
  'tw-fields': {
    title: '{{course}}/{{name}}-{{id}}',
    text:  '{{questionText}}',
    tags:  '{{category|split-csv}}',
    type:  'text/vnd.tiddlywiki'
  },
  'custom-fields': {
    'moodle-id': '{{id}}'
  }
}

const itemNameProfile = {
  iteration: '{{items[*]}}',
  'tw-fields': {
    title: '{{name}}'
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

test('numeric coercion: tokens auto-stringify values', () => {
  const profile = {
    iteration: '{{items[*]}}',
    'tw-fields': {
      title:    '{{name}}',
      'item-id': '{{id}}',
      active:   '{{active}}'
    }
  }
  const r = convert(fixture('numeric-coercion.json'), profile, new Set())
  assert.equal(r.errors.length, 0)
  assert.equal(r.tiddlers.length, 2)
  assert.equal(r.tiddlers[0]['item-id'], '541563')
  assert.equal(r.tiddlers[0].active, 'true')
  assert.equal(r.tiddlers[1].active, 'false')
})

test('per-token transforms: chained transforms apply left-to-right', () => {
  const profile = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: '{{name|trim|shout}}' }
  }
  const transforms = {
    trim: (s) => String(s).trim(),
    shout: (s) => String(s).toUpperCase()
  }
  const r = convert(
    '{"items":[{"name":"  hello  "}]}',
    profile,
    new Set(),
    { transforms }
  )
  assert.equal(r.errors.length, 0)
  assert.equal(r.tiddlers[0].title, 'HELLO')
})

test('per-token transforms: mixed tokens in one template', () => {
  const profile = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: '{{a}}-{{b}}' }
  }
  const r = convert(
    '{"items":[{"a":42,"b":"x"}]}',
    profile,
    new Set()
  )
  assert.equal(r.errors.length, 0)
  assert.equal(r.tiddlers[0].title, '42-x')
})

test('missing path: emits path-missing warning, leaves field empty', () => {
  const profile = {
    iteration: '{{items[*]}}',
    'tw-fields': {
      title:   '{{name}}',
      missing: '{{nope}}'
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
    iteration: '{{questions}}',
    'tw-fields': { title: '{{x}}' }
  }
  const r = convert(fixture('iteration-not-array.json'), profile, new Set())
  assert.equal(r.tiddlers.length, 0)
  assert.equal(r.errors.length, 1)
  assert.equal(r.errors[0].code, 'iteration-not-array')
  assert.equal(r.errors[0].path, '{{questions}}')
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

test('multi-[*] iteration: ancestors accessible via ..', () => {
  const profile = {
    iteration: '{{groups[*].subgroups[*].items[*]}}',
    'tw-fields': {
      title: '{{../../group-name}}/{{../subgroup-name}}/{{item-name}}'
    }
  }
  const data = {
    groups: [
      { 'group-name': 'A', subgroups: [
        { 'subgroup-name': 'A1', items: [{ 'item-name': 'A1a' }, { 'item-name': 'A1b' }] },
        { 'subgroup-name': 'A2', items: [{ 'item-name': 'A2a' }] }
      ]},
      { 'group-name': 'B', subgroups: [
        { 'subgroup-name': 'B1', items: [{ 'item-name': 'B1a' }] }
      ]}
    ]
  }
  const r = convert(JSON.stringify(data), profile, new Set())
  assert.equal(r.errors.length, 0)
  assert.equal(r.tiddlers.length, 4)
  assert.deepEqual(r.tiddlers.map((t) => t.title), [
    'A/A1/A1a', 'A/A1/A1b', 'A/A2/A2a', 'B/B1/B1a'
  ])
})

test('top-level [*] iteration: produces records with root as ancestor', () => {
  const profile = {
    iteration: '{{[*]}}',
    'tw-fields': { title: '{{name}}' }
  }
  const r = convert(
    '[{"name":"alpha"},{"name":"beta"}]',
    profile,
    new Set()
  )
  assert.equal(r.errors.length, 0)
  assert.equal(r.tiddlers.length, 2)
  assert.equal(r.tiddlers[0].title, 'alpha')
  assert.equal(r.tiddlers[1].title, 'beta')
})

test('ancestor ref beyond depth: emits path-missing warning', () => {
  // iteration provides 1 ancestor (root); binding asks for 2 ups
  const profile = {
    iteration: '{{items[*]}}',
    'tw-fields': {
      title: '{{name}}',
      bad:   '{{../../foo}}'
    }
  }
  // Validator should reject this profile; convert returns the profile errors
  const r = convert('{"items":[{"name":"x"}]}', profile, new Set())
  assert.ok(r.errors.some((e) => e.code === 'binding-parent-too-deep'))
})

test('iteration with no [*]: backward compat, .. is root', () => {
  const profile = {
    iteration: '{{questions}}',
    'tw-fields': {
      title:  '{{name}}',
      course: '{{../meta.course}}'
    }
  }
  const r = convert(
    '{"meta":{"course":"CS101"},"questions":[{"name":"q1"},{"name":"q2"}]}',
    profile,
    new Set()
  )
  assert.equal(r.errors.length, 0)
  assert.equal(r.tiddlers.length, 2)
  assert.equal(r.tiddlers[0].course, 'CS101')
  assert.equal(r.tiddlers[1].course, 'CS101')
})
