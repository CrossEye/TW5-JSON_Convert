const KEY_RE = /^[^.\[\]/]+/

// A path whose first segment is `@name` refers to something about the
// import rather than to the data: the import time, the record's
// 1-based counter, the record itself.  Only the engine's convert step
// knows these; the parser just recognises the segment.
const CONTEXT_RE = /^@([A-Za-z0-9_-]+)/
const CONTEXT_PATHS = ['now', 'counter', 'record']

// A key that the bare syntax cannot express — it contains a reserved
// character, is empty, or starts with `@` (reserved for context paths)
// — is written as a quoted segment: `["first.last"]`, `["@id"]`.
// Inside the quotes `\"` and `\\` are the only escapes.
const keyNeedsQuoting = (key) =>
  key === '' || /[.\[\]/"\\]/.test(key) || key.startsWith('@')

const quoteKey = (key) =>
  `["${key.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`

// Append a key to a path string in whichever form parses back to it.
const appendKey = (path, key) =>
  keyNeedsQuoting(key)
    ? `${path}${quoteKey(key)}`
    : path ? `${path}.${key}` : key

// Read a quoted segment starting at rest[0] === '[', rest[1] === '"'.
// Returns { key, length } or null if unterminated.
const readQuotedSegment = (rest) => {
  let key = ''
  let i = 2
  while (i < rest.length) {
    const c = rest[i]
    if (c === '\\') {
      if (i + 1 >= rest.length) return null
      key += rest[i + 1]
      i += 2
      continue
    }
    if (c === '"') {
      if (rest[i + 1] !== ']') return null
      return { key, length: i + 2 }
    }
    key += c
    i++
  }
  return null
}

// Paths can start with one or more `..` segments separated by `/`,
// each meaning "step up one ancestor scope".  These are valid only in
// binding template tokens, not in `records`.  After the leading
// parents (and a `/` separator if more path follows), the rest uses
// the existing key/index/star syntax.
const parsePath = (path) => {
  if (path === '') return []
  const segments = []
  let rest = path

  // Phase 1: leading parent indicators
  while (rest.startsWith('..')) {
    segments.push({ type: 'parent' })
    rest = rest.slice(2)
    if (rest.length === 0) return segments
    if (rest.startsWith('/')) {
      rest = rest.slice(1)
      if (rest.length === 0) return null
    } else {
      return null // e.g. `..foo` is not allowed; require `../foo`
    }
  }

  // Phase 2: the rest is an ordinary path
  const startCount = segments.length
  while (rest.length > 0) {
    const localCount = segments.length - startCount
    if (localCount === 0 && rest[0] === '@') {
      // A context path stands alone at the start; `../@now` is not a
      // thing, since context is not part of any record.
      if (startCount > 0) return null
      const m = CONTEXT_RE.exec(rest)
      if (!m) return null
      segments.push({ type: 'context', name: m[1] })
      rest = rest.slice(m[0].length)
      continue
    }
    if (rest[0] === '[' && rest[1] === '"') {
      const q = readQuotedSegment(rest)
      if (!q) return null
      segments.push({ type: 'key', key: q.key })
      rest = rest.slice(q.length)
      continue
    }
    if (rest[0] === '[') {
      const end = rest.indexOf(']')
      if (end < 0) return null
      const inner = rest.slice(1, end)
      if (inner === '*') {
        segments.push({ type: 'star' })
      } else if (/^\d+$/.test(inner)) {
        segments.push({ type: 'index', index: Number(inner) })
      } else {
        return null
      }
      rest = rest.slice(end + 1)
      continue
    }
    if (rest[0] === '.') {
      if (localCount === 0) return null
      rest = rest.slice(1)
      const m = KEY_RE.exec(rest)
      if (!m) return null
      segments.push({ type: 'key', key: m[0] })
      rest = rest.slice(m[0].length)
      continue
    }
    if (localCount > 0) return null
    const m = KEY_RE.exec(rest)
    if (!m) return null
    segments.push({ type: 'key', key: m[0] })
    rest = rest.slice(m[0].length)
  }
  return segments
}

const hasStar = (segments) =>
  segments.some((s) => s.type === 'star')

const hasParent = (segments) =>
  segments.some((s) => s.type === 'parent')

const parentCount = (segments) => {
  let n = 0
  for (const s of segments) {
    if (s.type === 'parent') n++
    else break
  }
  return n
}

const resolveAt = (node, segments, i) => {
  if (i >= segments.length) return node
  if (node === null || node === undefined) return undefined
  const head = segments[i]
  if (head.type === 'key') {
    if (typeof node !== 'object' || Array.isArray(node)) return undefined
    return resolveAt(node[head.key], segments, i + 1)
  }
  if (head.type === 'index') {
    if (!Array.isArray(node)) return undefined
    return resolveAt(node[head.index], segments, i + 1)
  }
  if (!Array.isArray(node)) return undefined
  const flatten = segments.slice(i + 1).some((s) => s.type === 'star')
  const results = []
  for (const item of node) {
    const r = resolveAt(item, segments, i + 1)
    if (r === undefined) continue
    if (flatten && Array.isArray(r)) results.push(...r)
    else results.push(r)
  }
  return results
}

const resolvePath = (node, pathOrSegments) => {
  const segments = typeof pathOrSegments === 'string'
    ? parsePath(pathOrSegments)
    : pathOrSegments
  if (!segments) return undefined
  return resolveAt(node, segments, 0)
}

// Reverse of parsePath: turn a segments array back into a string path.
const renderPathSegments = (segments) => {
  let path = ''
  let afterParent = false
  for (const s of segments) {
    if (s.type === 'parent') {
      path = path ? `${path}/..` : '..'
      afterParent = true
      continue
    }
    if (afterParent) {
      // The parser wants `../` before whatever follows, and a bare key
      // there takes no dot.
      path += '/'
      afterParent = false
      if (s.type === 'key') {
        path += keyNeedsQuoting(s.key) ? quoteKey(s.key) : s.key
        continue
      }
    }
    if (s.type === 'star') path += '[*]'
    else if (s.type === 'index') path += `[${s.index}]`
    else if (s.type === 'key') path = appendKey(path, s.key)
    else if (s.type === 'context') path = `@${s.name}`
  }
  return path
}

const hasContext = (segments) =>
  segments.length > 0 && segments[0].type === 'context'

exports.parsePath = parsePath
exports.resolvePath = resolvePath
exports.hasStar = hasStar
exports.hasParent = hasParent
exports.parentCount = parentCount
exports.renderPathSegments = renderPathSegments
exports.hasContext = hasContext
exports.CONTEXT_PATHS = CONTEXT_PATHS
exports.keyNeedsQuoting = keyNeedsQuoting
exports.quoteKey = quoteKey
exports.appendKey = appendKey
