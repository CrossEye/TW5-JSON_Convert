const { walkTemplate, parseToken } = require('./template.js')
const { parsePath, renderPathSegments } = require('./path.js')

// Shapes as engine/shape.js merges them, made JSON-safe and comparable.
// A pack records the serialized shape of the sample it was built
// against; at run time the same serialization of the recipient's
// records is compared with it, so the panel can say which fields the
// importer expected and did not find.

const serializeShape = (node) => {
  if (!node) return null
  const out = { kind: node.kind }
  if (node.presence) out.presence = node.presence
  if (node.kind === 'leaf') {
    out.types = [...(node.types || [])].sort()
  } else if (node.kind === 'object') {
    out.children = {}
    for (const key of Object.keys(node.children || {})) {
      out.children[key] = serializeShape(node.children[key])
    }
  } else if (node.kind === 'array' && node.element) {
    out.element = serializeShape(node.element)
  }
  return out
}

const join = (path, key) => (path ? `${path}.${key}` : key)

// missing: paths the expected shape has that the actual one lacks.
// added:   paths the actual shape has that the expected one lacks.
// changed: paths present in both whose kind or leaf type differs.
// A null value in the actual data never counts as a type change.
const compareShapes = (expected, actual) => {
  const diff = { missing: [], added: [], changed: [] }
  const walk = (e, a, path) => {
    if (!e || !a) return
    if (e.kind !== a.kind) {
      if (e.kind !== 'mixed' && a.kind !== 'mixed') {
        diff.changed.push({ path, expected: e.kind, actual: a.kind })
      }
      return
    }
    if (e.kind === 'leaf') {
      // A field that was null throughout the sample says nothing about
      // its type, so it cannot be contradicted.
      const et = (e.types || []).filter((t) => t !== 'null')
      const at = a.types || []
      const unexpected = at.filter((t) => t !== 'null' && !et.includes(t))
      if (et.length > 0 && unexpected.length > 0) {
        diff.changed.push({
          path, expected: et.join(' or '), actual: at.join(' or ')
        })
      }
      return
    }
    if (e.kind === 'object') {
      const ec = e.children || {}
      const ac = a.children || {}
      for (const key of Object.keys(ec)) {
        if (!(key in ac)) diff.missing.push(join(path, key))
        else walk(ec[key], ac[key], join(path, key))
      }
      for (const key of Object.keys(ac)) {
        if (!(key in ec)) diff.added.push(join(path, key))
      }
      return
    }
    if (e.kind === 'array' && e.element && a.element) {
      walk(e.element, a.element, `${path}[*]`)
    }
  }
  walk(expected, actual, '')
  return diff
}

const isMismatch = (diff) =>
  diff.missing.length > 0 || diff.changed.length > 0

// The record-relative paths a profile reads: every token path in its
// bindings, minus ancestor paths (`../x`, which are not in the record)
// and context paths other than `@record.x`, which is the record.
const profilePaths = (profile) => {
  const paths = new Set()
  const scan = (template) => {
    if (typeof template !== 'string') return
    walkTemplate(template, () => {}, () => {}, (content) => {
      const segs = parsePath(parseToken(content).path)
      if (!segs || segs.length === 0) return
      if (segs[0].type === 'parent') return
      if (segs[0].type === 'context') {
        if (segs[0].name !== 'record' || segs.length === 1) return
        paths.add(renderPathSegments(segs.slice(1)))
        return
      }
      paths.add(renderPathSegments(segs))
    })
  }
  for (const group of ['tw-fields', 'custom-fields']) {
    const bindings = profile && profile[group]
    if (bindings && typeof bindings === 'object') {
      Object.values(bindings).forEach(scan)
    }
  }
  return paths
}

// Keep only the differences that can affect the profile: a missing or
// changed path that some binding reads, or that a binding reads
// through.  Additions are kept as they are, being informational.
const relevantDiff = (diff, usedPaths) => {
  const used = [...usedPaths]
  const touches = (path) => used.some((u) =>
    u === path || u.startsWith(`${path}.`) || u.startsWith(`${path}[`)
  )
  return {
    missing: diff.missing.filter(touches),
    added: diff.added,
    changed: diff.changed.filter((c) => touches(c.path))
  }
}

// The field names at the top of a record shape, for messages.
const topLevelFields = (shape) =>
  shape && shape.kind === 'object' ? Object.keys(shape.children || {}) : []

exports.serializeShape = serializeShape
exports.compareShapes = compareShapes
exports.isMismatch = isMismatch
exports.profilePaths = profilePaths
exports.relevantDiff = relevantDiff
exports.topLevelFields = topLevelFields
