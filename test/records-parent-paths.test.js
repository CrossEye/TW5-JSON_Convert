const { test } = require('node:test')
const assert = require('node:assert/strict')

// The filter file uses `$:/plugins/...` requires for sibling modules.
// Map those to the on-disk paths so the test runner can load it.
const Module = require('node:module')
const origResolve = Module._resolve_filename || Module._resolveFilename
Module._resolveFilename = function(request, parent, ...rest) {
  if (request.startsWith('$:/plugins/crosseye/json-convert/')) {
    const tail = request.slice('$:/plugins/crosseye/json-convert/'.length)
    return require.resolve('../wiki/plugins/json-convert/' + tail)
  }
  return origResolve.call(this, request, parent, ...rest)
}

const mod = require(
  '../wiki/plugins/json-convert/filters/records-parent-paths.js'
)
const filter = mod['jc-records-parent-paths']
const stripBraces = mod['jc-strip-template-braces']
const hideKey = mod['jc-records-hide-key']

const opOf = (operand) => ({ operand })

const mockSource = (titles) => (cb) => {
  for (const t of titles) cb(null, t)
}

test('records-parent-paths: 0 stars emits nothing', () => {
  assert.deepEqual(filter(mockSource(['{{a.b.c}}'])), [])
})

test('records-parent-paths: 1 star emits root scope only', () => {
  assert.deepEqual(filter(mockSource(['{{results[*]}}'])), [''])
})

test('records-parent-paths: 2 stars emits inner parent then root', () => {
  assert.deepEqual(
    filter(mockSource(['{{days[*].activities[*]}}'])),
    ['{{days[*]}}', '']
  )
})

test('records-parent-paths: 3 stars emits two intermediates then root', () => {
  assert.deepEqual(
    filter(mockSource(['{{[*].subgroups[*].items[*]}}'])),
    ['{{[*].subgroups[*]}}', '{{[*]}}', '']
  )
})

test('records-parent-paths: bare-array root works the same', () => {
  assert.deepEqual(
    filter(mockSource(['{{[*].pages[*]}}'])),
    ['{{[*]}}', '']
  )
})

test('records-parent-paths: malformed token paths produce nothing', () => {
  assert.deepEqual(filter(mockSource(['{{[unterminated'])), [])
})

test('strip-template-braces: removes {{ … }} wrap', () => {
  assert.deepEqual(
    stripBraces(mockSource(['{{days[*].activities[*]}}'])),
    ['days[*].activities[*]']
  )
})

test('strip-template-braces: leaves non-template strings alone', () => {
  assert.deepEqual(stripBraces(mockSource(['plain'])), ['plain'])
})

test('strip-template-braces: empty string passes through', () => {
  assert.deepEqual(stripBraces(mockSource([''])), [''])
})

test('strip-template-braces: degenerate {{}} strips to empty', () => {
  assert.deepEqual(stripBraces(mockSource(['{{}}'])), [''])
})

test('strip-template-braces: too-short to be a wrap passes through', () => {
  assert.deepEqual(stripBraces(mockSource(['{}'])), ['{}'])
})

test('hide-key: 1-star records, depth=1 returns the records key', () => {
  assert.deepEqual(
    hideKey(mockSource(['{{results[*]}}']), opOf('1')),
    ['results']
  )
})

test('hide-key: 2-star records, depth=1 returns innermost-array key', () => {
  assert.deepEqual(
    hideKey(mockSource(['{{days[*].activities[*]}}']), opOf('1')),
    ['activities']
  )
})

test('hide-key: 2-star records, depth=2 returns outer-array key', () => {
  assert.deepEqual(
    hideKey(mockSource(['{{days[*].activities[*]}}']), opOf('2')),
    ['days']
  )
})

test('hide-key: bare-array root has no key to hide at the root depth', () => {
  assert.deepEqual(
    hideKey(mockSource(['{{[*].subgroups[*]}}']), opOf('2')),
    ['']
  )
})

test('hide-key: out-of-range depth returns empty', () => {
  assert.deepEqual(
    hideKey(mockSource(['{{results[*]}}']), opOf('2')),
    ['']
  )
  assert.deepEqual(
    hideKey(mockSource(['{{results[*]}}']), opOf('0')),
    ['']
  )
})

test('hide-key: malformed depth returns empty', () => {
  assert.deepEqual(
    hideKey(mockSource(['{{results[*]}}']), opOf('not a number')),
    ['']
  )
})
