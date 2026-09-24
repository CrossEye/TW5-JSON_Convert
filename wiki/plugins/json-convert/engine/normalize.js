const { parsePath } = require('./path.js')

// Source normalization: reshape the parsed document *before* records
// expansion, so that inputs whose structure encodes what should be
// key/value pairs can be mapped with ordinary bindings.
//
// One step type exists, `pivot`.  It turns an array of entry-objects
//
//   [ {"key": "date", "value": "9/16/26"},
//     {"key": "total", "value": "42"} ]
//
// into the object those entries describe
//
//   {"date": "9/16/26", "total": "42"}
//
// In auto mode (no `at`) every array in the document that looks like
// entries is rewritten; `at` scopes the rewrite to one subtree.
// Values are carried over untouched — no stringification — so
// transforms still see numbers, booleans and nested structure.

const DEFAULT_KEY_FIELD = 'key'
const DEFAULT_VALUE_FIELD = 'value'
const STEP_NAMES = ['pivot']
const PIVOT_OPTIONS = ['key', 'value', 'at']

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const mapValues = (obj, fn) => {
  const out = {}
  for (const [k, v] of Object.entries(obj)) out[k] = fn(v)
  return out
}

// An entry carries a non-empty string key and *has* the value field.
// `vf in v` rather than a truthiness test: a null or empty value is
// still a field the source meant to report.
const isEntry = (v, kf, vf) =>
  isPlainObject(v) && typeof v[kf] === 'string' && v[kf] !== '' && vf in v

const isEntryArray = (v, kf, vf) =>
  Array.isArray(v) && v.length > 0 && v.every((e) => isEntry(e, kf, vf))

const pivotEntries = (arr, kf, vf, ctx) => {
  const out = {}
  for (const entry of arr) {
    if (entry[kf] in out) ctx.duplicates.add(entry[kf])
    out[entry[kf]] = entry[vf]
  }
  ctx.count++
  return out
}

// Rewrite everything at or below this node.  A pivoted result is
// walked again so nested reified structures collapse too.
const walk = (node, kf, vf, ctx) =>
  Array.isArray(node)
    ? isEntryArray(node, kf, vf)
      ? mapValues(pivotEntries(node, kf, vf, ctx), (v) => walk(v, kf, vf, ctx))
      : node.map((e) => walk(e, kf, vf, ctx))
    : isPlainObject(node)
      ? mapValues(node, (v) => walk(v, kf, vf, ctx))
      : node

// Descend along `at` without touching anything off the path; once the
// segments run out, hand the subtree to the auto walker.
const scoped = (node, segs, i, kf, vf, ctx) => {
  if (i >= segs.length) return walk(node, kf, vf, ctx)
  const seg = segs[i]
  const next = (child) => scoped(child, segs, i + 1, kf, vf, ctx)
  return seg.type === 'key'
    ? isPlainObject(node) && seg.key in node
      ? { ...node, [seg.key]: next(node[seg.key]) }
      : node
    : seg.type === 'index'
      ? Array.isArray(node) && seg.index < node.length
        ? node.map((e, j) => (j === seg.index ? next(e) : e))
        : node
      : seg.type === 'star'
        ? Array.isArray(node) ? node.map(next) : node
        : node // `..` is meaningless at document scope; validator rejects it
}

const quoteList = (items) => items.map((k) => `"${k}"`).join(', ')

const stepWarnings = (ctx, kf, vf) => {
  const warnings = []
  if (ctx.count === 0) {
    warnings.push({
      code: 'normalize-no-effect',
      message:
        'normalize: pivot found no key/value pair arrays to flatten ' +
        `(looking for objects with "${kf}" and "${vf}")`
    })
  }
  if (ctx.duplicates.size > 0) {
    warnings.push({
      code: 'normalize-duplicate-key',
      message:
        'normalize: pivot found repeated key(s) ' +
        `${quoteList([...ctx.duplicates])} within one group; ` +
        'the last value wins'
    })
  }
  return warnings
}

const applyStep = (doc, step, warnings) => {
  if (!isPlainObject(step) || !('pivot' in step)) return doc
  const opts = isPlainObject(step.pivot) ? step.pivot : {}
  const kf = typeof opts.key === 'string' && opts.key !== ''
    ? opts.key
    : DEFAULT_KEY_FIELD
  const vf = typeof opts.value === 'string' && opts.value !== ''
    ? opts.value
    : DEFAULT_VALUE_FIELD
  const segs = typeof opts.at === 'string' && opts.at !== ''
    ? parsePath(opts.at)
    : []
  if (segs === null) return doc // unparseable `at`; validator reports it
  const ctx = { count: 0, duplicates: new Set() }
  const value = scoped(doc, segs, 0, kf, vf, ctx)
  warnings.push(...stepWarnings(ctx, kf, vf))
  return value
}

// A spec arrives either as the profile's parsed `normalize` array or,
// from a widget attribute, as the JSON text of one.  Anything
// unrecognized normalizes to "do nothing" — validateProfile is what
// reports malformed specs to the user.
const parseSpec = (spec) => {
  if (Array.isArray(spec)) return spec.filter(isPlainObject)
  if (typeof spec !== 'string' || spec.trim() === '') return []
  try {
    const parsed = JSON.parse(spec)
    return Array.isArray(parsed) ? parsed.filter(isPlainObject) : []
  } catch (_) {
    return []
  }
}

const normalizeDoc = (doc, spec) => {
  const steps = parseSpec(spec)
  if (steps.length === 0) return { value: doc, warnings: [] }
  const warnings = []
  const value = steps.reduce(
    (acc, step) => applyStep(acc, step, warnings), doc
  )
  return { value, warnings }
}

// The spec the UI toggle writes: auto-detect, default field names.
const AUTO_PIVOT_SPEC = [{ pivot: {} }]

exports.normalizeDoc = normalizeDoc
exports.parseSpec = parseSpec
exports.isEntryArray = isEntryArray
exports.AUTO_PIVOT_SPEC = AUTO_PIVOT_SPEC
exports.DEFAULT_KEY_FIELD = DEFAULT_KEY_FIELD
exports.DEFAULT_VALUE_FIELD = DEFAULT_VALUE_FIELD
exports.STEP_NAMES = STEP_NAMES
exports.PIVOT_OPTIONS = PIVOT_OPTIONS
