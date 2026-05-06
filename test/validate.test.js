const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validateProfile, validateBinding } = require(
  '../wiki/tiddlers/plugins/crosseye/json-convert/engine/validate.js'
)

const validProfile = {
  iteration: 'questions[*]',
  'tw-fields': {
    title: { template: '{course}/{name}-{id}' },
    text:  { path: 'questionText', transform: 'html-to-wikitext' },
    tags:  { path: 'category', transform: 'split-csv' },
    type:  { literal: 'text/vnd.tiddlywiki' }
  },
  'custom-fields': {
    'moodle-id': { path: 'id', transform: 'to-string' }
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
  const p = { iteration: 'items[*]' }
  assert.ok(codes(validateProfile(p)).includes('missing-title-binding'))
})

test('missing title in tw-fields', () => {
  const p = {
    iteration: 'items[*]',
    'tw-fields': { text: { path: 'body' } }
  }
  assert.ok(codes(validateProfile(p)).includes('missing-title-binding'))
})

test('tw-fields not an object', () => {
  const p = {
    iteration: 'items[*]',
    'tw-fields': []
  }
  assert.ok(codes(validateProfile(p)).includes('tw-fields-not-object'))
})

test('binding with no form', () => {
  const p = {
    iteration: 'items[*]',
    'tw-fields': { title: { transform: 'to-string' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-missing-form'))
})

test('binding with multiple forms', () => {
  const p = {
    iteration: 'items[*]',
    'tw-fields': { title: { path: 'name', literal: 'oops' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-multiple-forms'))
})

test('unknown transform name', () => {
  const p = {
    iteration: 'items[*]',
    'tw-fields': { title: { path: 'name', transform: 'no-such' } }
  }
  assert.ok(codes(validateProfile(p)).includes('unknown-transform'))
})

test('[*] in binding path is rejected', () => {
  const p = {
    iteration: 'items[*]',
    'tw-fields': { title: { path: 'tags[*]' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-star-not-allowed'))
})

test('[*] in template token is rejected', () => {
  const p = {
    iteration: 'items[*]',
    'tw-fields': { title: { template: 'x-{tags[*]}' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-template-star'))
})

test('bad path syntax in binding', () => {
  const p = {
    iteration: 'items[*]',
    'tw-fields': { title: { path: 'foo..bar' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-path'))
})

test('custom-fields not an object', () => {
  const p = {
    iteration: 'items[*]',
    'tw-fields': { title: { path: 'name' } },
    'custom-fields': [{ field: 'x', path: 'y' }]
  }
  assert.ok(codes(validateProfile(p)).includes('custom-fields-not-object'))
})

test('custom-fields entry validates its binding form too', () => {
  const p = {
    iteration: 'items[*]',
    'tw-fields': { title: { path: 'name' } },
    'custom-fields': { x: { path: 'a', literal: 'b' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-multiple-forms'))
})

test('returns ALL errors at once for editor live feedback', () => {
  const p = {
    'tw-fields': { foo: { transform: 'no-such' } },
    'custom-fields': { bar: {} }
  }
  const errs = codes(validateProfile(p))
  assert.ok(errs.includes('missing-iteration'))
  assert.ok(errs.includes('missing-title-binding'))
  assert.ok(errs.includes('binding-missing-form'))
  assert.ok(errs.includes('unknown-transform'))
})

test('custom transforms extend (do not replace) the default registry', () => {
  const p = {
    iteration: 'items[*]',
    'tw-fields': { title: { path: 'name', transform: 'shout' } }
  }
  const customs = { shout: (s) => String(s).toUpperCase() }
  assert.deepEqual(validateProfile(p, customs), [])
  assert.ok(codes(validateProfile(p)).includes('unknown-transform'))

  const usingDefault = {
    iteration: 'items[*]',
    'tw-fields': {
      title: { path: 'name', transform: 'shout' },
      tags:  { path: 'cat',  transform: 'split-csv' }
    }
  }
  assert.deepEqual(validateProfile(usingDefault, customs), [])
})

test('field-redefined: custom-fields key collides with tw-fields key', () => {
  const p = {
    iteration: 'items[*]',
    'tw-fields': { title: { path: 'name' } },
    'custom-fields': { title: { literal: 'oops' } }
  }
  const errs = validateProfile(p)
  const collision = errs.find((e) => e.code === 'field-redefined')
  assert.ok(collision, 'expected a field-redefined error')
  assert.equal(collision.field, 'title')
  assert.equal(collision.location, 'custom-fields.title')
})

test('validateBinding: standalone usage', () => {
  const errs = validateBinding(
    { path: 'foo', literal: 'bar' },
    'tw-fields.title',
    new Set(['to-string'])
  )
  assert.equal(errs[0].code, 'binding-multiple-forms')
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
