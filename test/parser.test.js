const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { parse } = require(
  '../wiki/tiddlers/plugins/json-convert/engine/parser.js'
)

const fixture = (name) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8')

test('parse: valid object returns value with no errors or warnings', () => {
  const r = parse('{"a":1}')
  assert.deepEqual(r.value, { a: 1 })
  assert.equal(r.errors.length, 0)
  assert.equal(r.warnings.length, 0)
})

test('parse: valid array returns value', () => {
  const r = parse('[1,2,3]')
  assert.deepEqual(r.value, [1, 2, 3])
  assert.equal(r.errors.length, 0)
})

test('parse: strips BOM and emits recovery warning', () => {
  const r = parse('﻿{"a":1}')
  assert.deepEqual(r.value, { a: 1 })
  assert.equal(r.errors.length, 0)
  assert.equal(r.warnings.length, 1)
  assert.equal(r.warnings[0].code, 'parse-recovered')
  assert.match(r.warnings[0].message, /BOM/)
})

test('parse: trims leading non-JSON noise', () => {
  const r = parse('garbage{"a":1}')
  assert.deepEqual(r.value, { a: 1 })
  assert.equal(r.warnings[0].code, 'parse-recovered')
  assert.match(r.warnings[0].message, /wrapper/)
})

test('parse: trims trailing non-JSON noise', () => {
  const r = parse('{"a":1}garbage')
  assert.deepEqual(r.value, { a: 1 })
  assert.equal(r.warnings[0].code, 'parse-recovered')
})

test('parse: respects brackets inside strings', () => {
  const r = parse('{"s":"with } and ] in string"}')
  assert.deepEqual(r.value, { s: 'with } and ] in string' })
  assert.equal(r.warnings.length, 0)
})

test('parse: nested arrays and objects', () => {
  const r = parse('[{"x":[1,2]},{"y":"a]b"}]')
  assert.deepEqual(r.value, [{ x: [1, 2] }, { y: 'a]b' }])
})

test('parse: malformed-recoverable fixture (BOM + wrappers)', () => {
  const r = parse(fixture('malformed-recoverable.txt'))
  assert.deepEqual(r.value, { items: [{ name: 'alpha' }] })
  assert.equal(r.errors.length, 0)
  assert.equal(r.warnings.length, 1)
  assert.equal(r.warnings[0].code, 'parse-recovered')
  assert.match(r.warnings[0].message, /BOM/)
  assert.match(r.warnings[0].message, /wrapper/)
})

test('parse: malformed-unrecoverable fixture returns parse-failed', () => {
  const r = parse(fixture('malformed-unrecoverable.txt'))
  assert.equal(r.value, undefined)
  assert.equal(r.errors.length, 1)
  assert.equal(r.errors[0].code, 'parse-failed')
})

test('parse: half-broken JSON returns parse-failed', () => {
  const r = parse('{"a":}')
  assert.equal(r.errors.length, 1)
  assert.equal(r.errors[0].code, 'parse-failed')
})
