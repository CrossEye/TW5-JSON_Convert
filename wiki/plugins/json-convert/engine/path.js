const KEY_RE = /^[^.\[\]/]+/

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
  for (const s of segments) {
    if (s.type === 'parent') {
      path = path ? `${path}/..` : '..'
    } else if (s.type === 'star') {
      path += '[*]'
    } else if (s.type === 'index') {
      path += `[${s.index}]`
    } else if (s.type === 'key') {
      path = path ? `${path}.${s.key}` : s.key
    }
  }
  return path
}

exports.parsePath = parsePath
exports.resolvePath = resolvePath
exports.hasStar = hasStar
exports.hasParent = hasParent
exports.parentCount = parentCount
exports.renderPathSegments = renderPathSegments
