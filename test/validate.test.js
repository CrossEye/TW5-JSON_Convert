const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validateProfile, validateBinding } = require(
  '../wiki/tiddlers/plugins/crosseye/json-convert/engine/validate.js'
)

const validProfile = {
  iteration: '{{questions[*]}}',
  'tw-fields': {
    title: '{{course}}/{{name}}-{{id}}',
    text:  { value: '{{questionText}}', transform: 'html-to-wikitext' },
    tags:  { value: '{{category}}',     transform: 'split-csv' },
    type:  'text/vnd.tiddlywiki'
  },
  'custom-fields': {
    'moodle-id': { value: '{{id}}', transform: 'to-string' }
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

test('missing iteration', () => {
  const p = { ...validProfile }
  delete p.iteration
  assert.ok(codes(validateProfile(p)).includes('missing-iteration'))
})

test('empty iteration string', () => {
  const p = { ...validProfile, iteration: '' }
  assert.ok(codes(validateProfile(p)).includes('missing-iteration'))
})

test('iteration with bad path syntax', () => {
  const p = { ...validProfile, iteration: 'foo..bar' }
  assert.ok(codes(validateProfile(p)).includes('bad-iteration-path'))
})

test('missing tw-fields entirely', () => {
  const p = { iteration: '{{items[*]}}' }
  assert.ok(codes(validateProfile(p)).includes('missing-title-binding'))
})

test('missing title in tw-fields', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { text: '{{body}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('missing-title-binding'))
})

test('tw-fields not an object', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': []
  }
  assert.ok(codes(validateProfile(p)).includes('tw-fields-not-object'))
})

test('binding-bad-shape: not a string or object', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: 42 }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-shape'))
})

test('binding-value-not-string: object form missing value', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: { transform: 'to-string' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-value-not-string'))
})

test('unknown transform name', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: { value: '{{name}}', transform: 'no-such' } }
  }
  assert.ok(codes(validateProfile(p)).includes('unknown-transform'))
})

test('binding-token-star: [*] in template token is rejected', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: '{{tags[*]}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-token-star'))
})

test('binding-token-star also in object-form value', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: { value: 'x-{{tags[*]}}' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-token-star'))
})

test('binding-bad-token: invalid path syntax in template token', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: '{{foo..bar}}' }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-token'))
})

test('binding-bad-token: unterminated open brace pair', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: 'oops {{name' }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-token'))
})

test('single braces are literal (not token delimiters)', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: 'Cost: {USD} for {{count}} items' }
  }
  assert.deepEqual(validateProfile(p), [])
})

test('plain literal string (no tokens) is accepted', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: 'just a literal' }
  }
  assert.deepEqual(validateProfile(p), [])
})

test('custom-fields not an object', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: '{{name}}' },
    'custom-fields': [{ field: 'x' }]
  }
  assert.ok(codes(validateProfile(p)).includes('custom-fields-not-object'))
})

test('custom-fields entry validates its binding too', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: '{{name}}' },
    'custom-fields': { x: 42 }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-shape'))
})

test('returns ALL errors at once for editor live feedback', () => {
  const p = {
    'tw-fields': { foo: { value: '{{x}}', transform: 'no-such' } },
    'custom-fields': { bar: 42 }
  }
  const errs = codes(validateProfile(p))
  assert.ok(errs.includes('missing-iteration'))
  assert.ok(errs.includes('missing-title-binding'))
  assert.ok(errs.includes('unknown-transform'))
  assert.ok(errs.includes('binding-bad-shape'))
})

test('custom transforms extend (do not replace) the default registry', () => {
  const p = {
    iteration: '{{items[*]}}',
    'tw-fields': { title: { value: '{{name}}', transform: 'shout' } }
  }
  const customs = { shout: (s) => String(s).toUpperCase() }
  assert.deepEqual(validateProfile(p, customs), [])
  assert.ok(codes(validateProfile(p)).includes('unknown-transform'))

  const usingDefault = {
    iteration: '{{items[*]}}',
    'tw-fields': {
      title: { value: '{{name}}', transform: 'shout' },
      tags:  { value: '{{cat}}',  transform: 'split-csv' }
    }
  }
  assert.deepEqual(validateProfile(usingDefault, customs), [])
})

test('field-redefined: custom-fields key collides with tw-fields key', () => {
  const p = {
    iteration: '{{items[*]}}',
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
    '../wiki/tiddlers/plugins/crosseye/json-convert/engine/convert.js'
  )
  const r = convert('{"x":1}', { iteration: '' }, new Set())
  assert.equal(r.tiddlers.length, 0)
  assert.ok(r.errors.length > 0)
  assert.ok(r.errors.some((e) => e.code === 'missing-iteration'))
})
