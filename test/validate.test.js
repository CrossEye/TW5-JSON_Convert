const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validateProfile, validateBinding } = require(
  '../wiki/tiddlers/plugins/crosseye/json-convert/engine/validate.js'
)

const validProfile = {
  iteration: 'questions[*]',
  bindings: {
    title: { template: '{course}/{name}-{id}' },
    text:  { path: 'questionText', transform: 'html-to-wikitext' },
    tags:  { path: 'category', transform: 'split-csv' },
    type:  { literal: 'text/vnd.tiddlywiki' }
  },
  extras: [
    { field: 'moodle-id', path: 'id', transform: 'to-string' }
  ]
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

test('missing bindings entirely', () => {
  const p = { iteration: 'items[*]' }
  assert.ok(codes(validateProfile(p)).includes('missing-title-binding'))
})

test('missing title binding', () => {
  const p = {
    iteration: 'items[*]',
    bindings: { text: { path: 'body' } }
  }
  assert.ok(codes(validateProfile(p)).includes('missing-title-binding'))
})

test('binding with no form', () => {
  const p = {
    iteration: 'items[*]',
    bindings: { title: { transform: 'to-string' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-missing-form'))
})

test('binding with multiple forms', () => {
  const p = {
    iteration: 'items[*]',
    bindings: { title: { path: 'name', literal: 'oops' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-multiple-forms'))
})

test('unknown transform name', () => {
  const p = {
    iteration: 'items[*]',
    bindings: { title: { path: 'name', transform: 'no-such' } }
  }
  assert.ok(codes(validateProfile(p)).includes('unknown-transform'))
})

test('[*] in binding path is rejected', () => {
  const p = {
    iteration: 'items[*]',
    bindings: { title: { path: 'tags[*]' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-star-not-allowed'))
})

test('[*] in template token is rejected', () => {
  const p = {
    iteration: 'items[*]',
    bindings: { title: { template: 'x-{tags[*]}' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-template-star'))
})

test('bad path syntax in binding', () => {
  const p = {
    iteration: 'items[*]',
    bindings: { title: { path: 'foo..bar' } }
  }
  assert.ok(codes(validateProfile(p)).includes('binding-bad-path'))
})

test('extras missing field', () => {
  const p = {
    iteration: 'items[*]',
    bindings: { title: { path: 'name' } },
    extras: [{ path: 'id' }]
  }
  assert.ok(codes(validateProfile(p)).includes('extra-missing-field'))
})

test('extras not an array', () => {
  const p = {
    iteration: 'items[*]',
    bindings: { title: { path: 'name' } },
    extras: { wrong: 'shape' }
  }
  assert.ok(codes(validateProfile(p)).includes('extras-not-array'))
})

test('extras entry validates its binding form too', () => {
  const p = {
    iteration: 'items[*]',
    bindings: { title: { path: 'name' } },
    extras: [{ field: 'x', path: 'a', literal: 'b' }]
  }
  assert.ok(codes(validateProfile(p)).includes('binding-multiple-forms'))
})

test('returns ALL errors at once for editor live feedback', () => {
  const p = {
    bindings: { foo: { transform: 'no-such' } },
    extras: [{ path: 'id' }]
  }
  const errs = codes(validateProfile(p))
  assert.ok(errs.includes('missing-iteration'))
  assert.ok(errs.includes('missing-title-binding'))
  assert.ok(errs.includes('binding-missing-form'))
  assert.ok(errs.includes('unknown-transform'))
  assert.ok(errs.includes('extra-missing-field'))
})

test('custom transforms registry overrides defaults', () => {
  const p = {
    iteration: 'items[*]',
    bindings: { title: { path: 'name', transform: 'shout' } }
  }
  const customs = { shout: (s) => String(s).toUpperCase() }
  assert.deepEqual(validateProfile(p, customs), [])
  assert.ok(codes(validateProfile(p)).includes('unknown-transform'))
})

test('validateBinding: standalone usage', () => {
  const errs = validateBinding(
    { path: 'foo', literal: 'bar' },
    'bindings.title',
    new Set(['to-string'])
  )
  assert.equal(errs[0].code, 'binding-multiple-forms')
  assert.equal(errs[0].location, 'bindings.title')
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
