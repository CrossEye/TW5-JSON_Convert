const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validateProfile, validateBinding } = require(
  '../wiki/plugins/json-convert/engine/validate.js'
)

const validProfile = {
  records: '{{questions[*]}}',
  'tw-fields': {
    title: '{{course}}/{{name}}-{{id}}',
    text:  '{{questionText|html-to-wikitext}}',
    tags:  '{{category|split-commas}}',
    type:  'text/vnd.tiddlywiki'
  },
  'custom-fields': {
    'moodle-id': '{{id}}'
  }
}

const codes = (errors) => errors.map((e) => e.code)

test('valid profile produces no errors', () => {
  assert.deepEqual(validateProfile(validProfile), [])
})

test('non-object profile fails fast', () => {
  assert.equal(validateProfile(null)[0].code, 'profile-not-object')
  assert.equal(validateProfile([])[0].code, 'profile-not-object')
  assert.equal(validateProfile('hi')[0].code, 'profile-not-object')
})

test('missing records', () => {
  const p = { ...validProfile }
  delete p.records
  assert.ok(codes(validateProfile(p)).includes('missing-records'))
})

test('empty records string', () => {
  const p = { ...validProfile, records: '' }
  assert.ok(codes(validateProfile(p)).includes('missing-records'))
})

test('records with bad path syntax', () => {
  const p = { ...validProfile, records: 'foo..bar' }
  assert.ok(codes(validateProfile(p)).includes('bad-records-path'))
})

test('missing tw-fields entirely', () => {
  const p = { records: '{{items[*]}}' }
  assert.ok(codes(validateProfile(p)).includes('missing-title-binding'))
})

test('missing title in tw-fields', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { text: '{{body}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('missing-title-binding'))
})

test('tw-fields not an object', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': []
  }
  assert.ok(codes(validateProfile(p)).includes('tw-fields-not-object'))
})

test('binding-bad-shape: not a string', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: 42 }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-shape'))
})

test('binding-bad-shape: object form is no longer accepted', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: { value: '{{name}}', transform: 'split-commas' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-shape'))
})

test('unknown transform name in per-token transform', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: '{{name|no-such}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('unknown-transform'))
})

test('per-token transform: chained transforms validated individually', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: '{{name|split-commas|no-such}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('unknown-transform'))
})

test('per-token transform: empty transform name rejected', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: '{{name|}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-token'))
})

test('binding-bad-token: empty path with transform', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: '{{|split-commas}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-token'))
})

test('records path cannot contain transforms', () => {
  const p = {
    records: '{{items[*]|split-commas}}',
    'tw-fields': { title: '{{name}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('bad-records-path'))
})

test('records path cannot use .. ancestor refs', () => {
  const p = {
    records: '{{../items[*]}}',
    'tw-fields': { title: '{{name}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('bad-records-path'))
})

test('binding may use .. up to records depth', () => {
  const p = {
    records: '{{groups[*].items[*]}}',
    'tw-fields': {
      title: '{{name}}',
      group: '{{../group-name}}',
      doc:   '{{../../meta}}'
    }
  }
  assert.deepEqual(validateProfile(p), [])
})

test('binding-parent-too-deep: .. exceeds records depth', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': {
      title: '{{name}}',
      bad:   '{{../../foo}}'
    }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-parent-too-deep'))
})

test('binding-token-star: [*] in template token is rejected', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: '{{tags[*]}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-token-star'))
})

test('binding-token-star: [*] still rejected when transforms present', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: 'x-{{tags[*]|split-commas}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-token-star'))
})

test('binding-bad-token: invalid path syntax in template token', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: '{{foo..bar}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-token'))
})

test('binding-bad-token: unterminated open brace pair', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: 'oops {{name' }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-token'))
})

test('single braces are literal (not token delimiters)', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: 'Cost: {USD} for {{count}} items' }
  }
  assert.deepEqual(validateProfile(p), [])
})

test('plain literal string (no tokens) is accepted', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: 'just a literal' }
  }
  assert.deepEqual(validateProfile(p), [])
})

test('custom-fields not an object', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: '{{name}}' },
    'custom-fields': [{ field: 'x' }]
  }
  assert.ok(codes(validateProfile(p)).includes('custom-fields-not-object'))
})

test('custom-fields entry validates its binding too', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: '{{name}}' },
    'custom-fields': { x: 42 }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-shape'))
})

test('returns ALL errors at once for editor live feedback', () => {
  const p = {
    'tw-fields': { foo: '{{x|no-such}}' },
    'custom-fields': { bar: 42 }
  }
  const errs = codes(validateProfile(p))
  assert.ok(errs.includes('missing-records'))
  assert.ok(errs.includes('missing-title-binding'))
  assert.ok(errs.includes('unknown-transform'))
  assert.ok(errs.includes('binding-bad-shape'))
})

test('custom transforms extend (do not replace) the default registry', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: '{{name|shout}}' }
  }
  const customs = { shout: (s) => String(s).toUpperCase() }
  assert.deepEqual(validateProfile(p, customs), [])
  assert.ok(codes(validateProfile(p)).includes('unknown-transform'))

  const usingDefault = {
    records: '{{items[*]}}',
    'tw-fields': {
      title: '{{name|shout}}',
      tags:  '{{cat|split-commas}}'
    }
  }
  assert.deepEqual(validateProfile(usingDefault, customs), [])
})

test('field-redefined: custom-fields key collides with tw-fields key', () => {
  const p = {
    records: '{{items[*]}}',
    'tw-fields': { title: '{{name}}' },
    'custom-fields': { title: 'oops' }
  }
  const errs = validateProfile(p)
  const collision = errs.find((e) => e.code === 'field-redefined')
  assert.ok(collision, 'expected a field-redefined error')
  assert.equal(collision.field, 'title')
  assert.equal(collision.location, 'custom-fields.title')
})

test('validateBinding: standalone usage with string binding', () => {
  assert.deepEqual(
    validateBinding('hello {name}', 'tw-fields.title', new Set()),
    []
  )
})

test('validateBinding: standalone usage with bad token', () => {
  const errs = validateBinding(
    '{{foo..bar}}', 'tw-fields.title', new Set()
  )
  assert.equal(errs[0].code, 'binding-bad-token')
  assert.equal(errs[0].location, 'tw-fields.title')
})

test('convert(): refuses to run on invalid profile', () => {
  const { convert } = require(
    '../wiki/plugins/json-convert/engine/convert.js'
  )
  const r = convert('{"x":1}', { records: '' }, new Set())
  assert.equal(r.tiddlers.length, 0)
  assert.ok(r.errors.length > 0)
  assert.ok(r.errors.some((e) => e.code === 'missing-records'))
})
