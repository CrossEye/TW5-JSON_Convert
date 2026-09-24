const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { parse } = require('../wiki/plugins/json-convert/engine/parser.js')

const fixture = (name) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8')

// The failure that started this: a tiddler dragged onto the source box
// left its title behind as a wikilink, a dozen lines from where the eye
// looks for trouble.
const NL = String.fromCharCode(10)

const withWikilink = () => fixture('reified.json')
  .replace(`    {${NL}      "fields"`,
    `    {[[Example Reified Output]]${NL}      "fields"`)

test('parse error: reports line, column and the offending line', () => {
  const r = parse(withWikilink())
  assert.equal(r.errors.length, 1)
  const e = r.errors[0]
  assert.equal(e.code, 'parse-failed')
  assert.equal(typeof e.line, 'number')
  assert.equal(typeof e.column, 'number')
  assert.ok(e.excerpt.includes('[[Example Reified Output]]'),
    'excerpt should show the line that broke')
})

test('parse error: message names the place, not a raw offset', () => {
  const e = parse('{\n  "a": 1,\n  bad\n}').errors[0]
  assert.match(e.message, /^Malformed JSON at line 3, column \d+: /)
  assert.ok(!/position \d+/.test(e.message),
    'the raw character offset belongs in a field, not the message')
})

test('parse error: line and column point at the real spot', () => {
  const e = parse('{\n  "a": 1,\n  oops: 2\n}').errors[0]
  assert.equal(e.line, 3)
  assert.equal(e.excerpt, '  oops: 2')
  // The column should land on the offending character within that line.
  assert.equal(e.excerpt[e.column - 1], 'o')
})

test('parse error: the raw offset is kept for callers that want it', () => {
  const e = parse('{\n  "a": 1,\n  oops: 2\n}').errors[0]
  assert.equal(typeof e.position, 'number')
})

test('parse error: an engine reporting no location still reads well', () => {
  // Not every engine (or every Node error) carries a position.
  const e = parse('{"a":}').errors[0]
  assert.equal(e.message, "Malformed JSON: Unexpected token '}'")
  assert.equal(e.line, undefined)
  assert.equal(e.excerpt, undefined)
})

test('parse error: a locationless failure still produces a message', () => {
  const e = parse('').errors[0]
  assert.equal(e.code, 'parse-failed')
  assert.ok(e.message.startsWith('Malformed JSON'))
})

test('recoverable junk stays a warning, not an error', () => {
  const r = parse('noise before {"a": 1} noise after')
  assert.equal(r.errors.length, 0)
  assert.equal(r.warnings[0].code, 'parse-recovered')
  assert.deepEqual(r.value, { a: 1 })
})
