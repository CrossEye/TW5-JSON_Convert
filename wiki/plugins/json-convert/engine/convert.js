const { prepareSource } = require('./prepare.js')
const { parsePath, resolvePath, renderPathSegments } = require('./path.js')
const { defaultTransforms, formatTwDate } = require('./transforms.js')
const { validateProfile } = require('./validate.js')
const { walkTemplate, parseToken, parseTransform } = require('./template.js')

const coerce = (v) =>
  typeof v === 'string' ? v
  : v === null || v === undefined ? ''
  : String(v)

// Resolve a token's path against the current record + ancestor stack.
// Leading `..` segments walk back through `ancestors` (innermost first);
// remaining segments resolve normally against the chosen scope.
// Returns the resolved value, or undefined if anything along the way
// is missing or the `..` count exceeds the available depth.
const resolveTokenPath = (segments, record, ancestors, context = {}) => {
  if (segments.length > 0 && segments[0].type === 'context') {
    const name = segments[0].name
    if (name === 'now') return context.now
    if (name === 'counter') return context.counter
    if (name === 'record') {
      const rest = segments.slice(1)
      return rest.length ? resolvePath(record, rest) : JSON.stringify(record)
    }
    return undefined
  }
  let i = 0
  let scope = record
  while (i < segments.length && segments[i].type === 'parent') {
    const upIdx = i  // 0 → ancestors[0] (innermost parent)
    if (upIdx >= ancestors.length) return undefined
    scope = ancestors[upIdx]
    i++
  }
  const remaining = segments.slice(i)
  if (remaining.length === 0) return scope
  return resolvePath(scope, remaining)
}

const interpolate = (
  template, record, recordIndex, transforms, ancestors = [], context = {}
) => {
  const warnings = []
  const out = []
  walkTemplate(template,
    () => {}, // malformed templates are caught by validate
    (text) => out.push(text),
    (content) => {
      const { path, transforms: tokenTransforms } = parseToken(content)
      const segments = parsePath(path)
      if (!segments) { out.push(''); return }
      let v = resolveTokenPath(segments, record, ancestors, context)
      if (v === undefined) {
        warnings.push({
          code: 'path-missing',
          message: `path "${path}" missing`,
          path,
          recordIndex
        })
        // Transforms still run, with an undefined value: that is how
        // `default[…]` supplies one, and the built-ins treat undefined
        // as empty.
        if (tokenTransforms.length === 0) {
          out.push('')
          return
        }
      }
      for (const spec of tokenTransforms) {
        const { name, params } = parseTransform(spec)
        const fn = transforms && transforms[name]
        // The validator has already checked the name is registered.
        if (fn) v = fn(v, params, { ...context, record })
      }
      out.push(coerce(v))
    }
  )
  return { value: out.join(''), warnings }
}

const evaluateBinding = (
  binding, record, recordIndex, transforms, ancestors = [], context = {}
) =>
  interpolate(binding, record, recordIndex, transforms, ancestors, context)

// Plain-language descriptions for diagnostics: what a value is, and
// where a records path stops matching the document.
const KEY_LIMIT = 12

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const describeValue = (v) => {
  if (v === undefined) return 'missing'
  if (v === null) return 'null'
  if (Array.isArray(v)) {
    return `an array of ${v.length} element${v.length === 1 ? '' : 's'}`
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v)
    if (keys.length === 0) return 'an empty object'
    const shown = keys.slice(0, KEY_LIMIT).join(', ')
    const more = keys.length > KEY_LIMIT
      ? ` and ${keys.length - KEY_LIMIT} more`
      : ''
    return `an object with keys ${shown}${more}`
  }
  return `a ${typeof v}`
}

const describeKeys = (v) => {
  if (!isPlainObject(v)) return ''
  const keys = Object.keys(v)
  const shown = keys.slice(0, KEY_LIMIT).join(', ')
  return keys.length > KEY_LIMIT
    ? `${shown} and ${keys.length - KEY_LIMIT} more`
    : shown
}

const excerptOf = (v, limit = 160) => {
  let text
  try { text = JSON.stringify(v) } catch (_) { text = String(v) }
  if (text === undefined) text = String(v)
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

// Walk a records path through the document and explain the first step
// that fails.  Returns null when every step resolves (the path is fine
// and merely empty).
const locateFailure = (root, segments) => {
  let node = root
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const at = i === 0 ? 'the document' : `"${renderPathSegments(segments.slice(0, i))}"`
    if (seg.type === 'key') {
      if (!isPlainObject(node) || !(seg.key in node)) {
        return isPlainObject(node)
          ? `${at} has no key "${seg.key}" (it is ${describeValue(node)})`
          : `${at} is ${describeValue(node)}, so it has no key "${seg.key}"`
      }
      node = node[seg.key]
    } else if (seg.type === 'index') {
      if (!Array.isArray(node) || seg.index >= node.length) {
        return `${at} is ${describeValue(node)}, so it has no element ${seg.index}`
      }
      node = node[seg.index]
    } else if (seg.type === 'star') {
      if (!Array.isArray(node)) {
        return `${at} is ${describeValue(node)}, not an array`
      }
      if (node.length === 0) return `${at} is an empty array`
      node = node[0]
    }
  }
  return null
}

const extractRecordsToken = (recordsPath) => {
  let path = null
  walkTemplate(recordsPath,
    () => {},
    () => {},
    (content) => { path = parseToken(content).path }
  )
  return path
}

// Walk the records path, branching at every `[*]`, and emit one
// {record, ancestors} per leaf reached.  ancestors[0] is the innermost
// parent scope (one `[*]` back); the deepest ancestor is the document
// root.  For records paths with no `[*]`, the resolved value (which
// must be an array) is iterated and each element is paired with
// ancestors=[root] for a consistent ancestry model.
const expandRecords = (root, recordsPath) => {
  const tokenPath = extractRecordsToken(recordsPath)
  const segments = parsePath(tokenPath)
  if (!segments) {
    return {
      records: null,
      error: {
        code: 'records-not-array',
        message:
          `records path "${recordsPath}" is not a valid path`,
        path: recordsPath
      }
    }
  }

  const hasAnyStar = segments.some((s) => s.type === 'star')
  if (!hasAnyStar) {
    const value = resolvePath(root, segments)
    if (!Array.isArray(value)) {
      const detail = locateFailure(root, segments) ||
        `it is ${describeValue(value)}`
      return {
        records: null,
        error: {
          code: 'records-not-array',
          message:
            `records path "${recordsPath}" did not resolve to an array: ` +
            detail,
          path: recordsPath,
          detail,
          document: describeValue(root)
        }
      }
    }
    return {
      records: value.map((r) => ({ record: r, ancestors: [root] })),
      error: null
    }
  }

  const records = []
  const walk = (node, i, recordStack) => {
    if (i >= segments.length) {
      const record = recordStack[recordStack.length - 1]
      const ancestors = recordStack.slice(0, -1).reverse()
      records.push({ record, ancestors })
      return
    }
    const seg = segments[i]
    if (seg.type === 'star') {
      if (!Array.isArray(node)) return
      for (const item of node) walk(item, i + 1, [...recordStack, item])
    } else if (seg.type === 'index') {
      if (!Array.isArray(node)) return
      walk(node[seg.index], i + 1, recordStack)
    } else if (seg.type === 'key') {
      if (typeof node !== 'object' || Array.isArray(node) || node === null) return
      walk(node[seg.key], i + 1, recordStack)
    }
  }
  walk(root, 0, [root])

  const detail = records.length === 0
    ? locateFailure(root, segments) || 'every array along it is empty'
    : null
  return { records, error: null, detail, document: describeValue(root) }
}

const convert = (jsonText, profile, existingTitles, options) => {
  const transforms = { ...defaultTransforms, ...options?.transforms }
  const existing = existingTitles || new Set()
  // Import-time context, the same for every record except the counter.
  // `options.now` lets a caller (or a test) fix the clock.
  const now = formatTwDate(options?.now || new Date())

  const profileErrors = validateProfile(profile, transforms)
  if (profileErrors.length > 0) {
    return {
      tiddlers: [],
      errors: profileErrors,
      warnings: [],
      collisions: new Set()
    }
  }

  const parsed = prepareSource(jsonText, profile.normalize)
  if (parsed.errors.length > 0) {
    return {
      tiddlers: [],
      errors: parsed.errors,
      warnings: parsed.warnings,
      collisions: new Set()
    }
  }
  const expanded = expandRecords(parsed.value, profile.records)
  if (expanded.error) {
    return {
      tiddlers: [],
      errors: [expanded.error],
      warnings: parsed.warnings,
      collisions: new Set()
    }
  }

  const warnings = parsed.warnings.slice()
  const errors = []
  const tiddlers = []
  const collisions = new Set()
  const seen = new Set()

  if (expanded.records.length === 0) {
    warnings.push({
      code: 'records-empty',
      message:
        `records path "${profile.records}" matched nothing: ` +
        expanded.detail +
        (expanded.detail.startsWith('the document')
          ? ''
          : `; the document is ${expanded.document}`),
      path: profile.records,
      detail: expanded.detail,
      document: expanded.document
    })
  }

  const titleBinding = typeof profile['tw-fields']?.title === 'string'
    ? profile['tw-fields'].title
    : typeof profile['custom-fields']?.title === 'string'
      ? profile['custom-fields'].title
      : ''

  expanded.records.forEach(({ record, ancestors }, recordIndex) => {
    const context = { now, counter: recordIndex + 1 }
    const fields = {}
    for (const [field, binding] of Object.entries(profile['tw-fields'] || {})) {
      const r = evaluateBinding(
        binding, record, recordIndex, transforms, ancestors, context
      )
      fields[field] = r.value
      warnings.push(...r.warnings)
    }
    for (const [field, binding] of Object.entries(profile['custom-fields'] || {})) {
      const r = evaluateBinding(
        binding, record, recordIndex, transforms, ancestors, context
      )
      fields[field] = r.value
      warnings.push(...r.warnings)
    }

    if (!fields.title) {
      const keys = describeKeys(record)
      errors.push({
        code: 'missing-title',
        message:
          `record ${recordIndex + 1} produced an empty title from ` +
          `"${titleBinding}"; the record ` +
          (keys ? `has keys ${keys}` : `is ${describeValue(record)}`),
        recordIndex,
        binding: titleBinding,
        keys,
        excerpt: excerptOf(record)
      })
      return
    }
    if (seen.has(fields.title)) {
      errors.push({
        code: 'duplicate-title',
        message: `title "${fields.title}" already produced in this batch`,
        recordIndex,
        title: fields.title
      })
      return
    }
    seen.add(fields.title)
    if (existing.has(fields.title)) {
      collisions.add(fields.title)
    }
    tiddlers.push(fields)
  })

  return { tiddlers, errors, warnings, collisions }
}

exports.interpolate = interpolate
exports.describeValue = describeValue
exports.locateFailure = locateFailure
exports.evaluateBinding = evaluateBinding
exports.expandRecords = expandRecords
exports.convert = convert
