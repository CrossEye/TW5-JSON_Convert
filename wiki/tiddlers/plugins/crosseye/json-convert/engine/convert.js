const { parse } = require('./parser.js')
const { parsePath, resolvePath } = require('./path.js')
const { defaultTransforms } = require('./transforms.js')
const { validateProfile } = require('./validate.js')
const { walkTemplate, parseToken } = require('./template.js')

const coerce = (v) =>
  typeof v === 'string' ? v
  : v === null || v === undefined ? ''
  : String(v)

// Resolve a token's path against the current record + ancestor stack.
// Leading `..` segments walk back through `ancestors` (innermost first);
// remaining segments resolve normally against the chosen scope.
// Returns the resolved value, or undefined if anything along the way
// is missing or the `..` count exceeds the available depth.
const resolveTokenPath = (segments, record, ancestors) => {
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
  template, record, recordIndex, transforms, ancestors = []
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
      let v = resolveTokenPath(segments, record, ancestors)
      if (v === undefined) {
        warnings.push({
          code: 'path-missing',
          message: `path "${path}" missing`,
          path,
          recordIndex
        })
        out.push('')
        return
      }
      for (const name of tokenTransforms) {
        const fn = transforms && transforms[name]
        if (fn) v = fn(v) // validator has already checked it's registered
      }
      out.push(coerce(v))
    }
  )
  return { value: out.join(''), warnings }
}

const evaluateBinding = (
  binding, record, recordIndex, transforms, ancestors = []
) =>
  interpolate(binding, record, recordIndex, transforms, ancestors)

const extractIterationToken = (iteration) => {
  let path = null
  walkTemplate(iteration,
    () => {},
    () => {},
    (content) => { path = parseToken(content).path }
  )
  return path
}

// Walk the iteration path, branching at every `[*]`, and emit one
// {record, ancestors} per leaf reached.  ancestors[0] is the innermost
// parent scope (one `[*]` back); the deepest ancestor is the document
// root.  For iteration paths with no `[*]`, the resolved value (which
// must be an array) is iterated and each element is paired with
// ancestors=[root] for a consistent ancestry model.
const expandIteration = (root, iteration) => {
  const tokenPath = extractIterationToken(iteration)
  const segments = parsePath(tokenPath)
  if (!segments) {
    return {
      records: null,
      error: {
        code: 'iteration-not-array',
        message:
          `iteration "${iteration}" is not a valid path`,
        path: iteration
      }
    }
  }

  const hasAnyStar = segments.some((s) => s.type === 'star')
  if (!hasAnyStar) {
    const value = resolvePath(root, segments)
    if (!Array.isArray(value)) {
      return {
        records: null,
        error: {
          code: 'iteration-not-array',
          message:
            `iteration "${iteration}" did not resolve to an array`,
          path: iteration
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

  return { records, error: null }
}

const convert = (jsonText, profile, existingTitles, options) => {
  const transforms = { ...defaultTransforms, ...options?.transforms }
  const existing = existingTitles || new Set()

  const profileErrors = validateProfile(profile, transforms)
  if (profileErrors.length > 0) {
    return {
      tiddlers: [],
      errors: profileErrors,
      warnings: [],
      collisions: new Set()
    }
  }

  const parsed = parse(jsonText)
  if (parsed.errors.length > 0) {
    return {
      tiddlers: [],
      errors: parsed.errors,
      warnings: parsed.warnings,
      collisions: new Set()
    }
  }
  const expanded = expandIteration(parsed.value, profile.iteration)
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
      code: 'iteration-empty',
      message:
        `iteration path "${profile.iteration}" resolved to empty array`,
      path: profile.iteration
    })
  }

  expanded.records.forEach(({ record, ancestors }, recordIndex) => {
    const fields = {}
    for (const [field, binding] of Object.entries(profile['tw-fields'] || {})) {
      const r = evaluateBinding(
        binding, record, recordIndex, transforms, ancestors
      )
      fields[field] = r.value
      warnings.push(...r.warnings)
    }
    for (const [field, binding] of Object.entries(profile['custom-fields'] || {})) {
      const r = evaluateBinding(
        binding, record, recordIndex, transforms, ancestors
      )
      fields[field] = r.value
      warnings.push(...r.warnings)
    }

    if (!fields.title) {
      errors.push({
        code: 'missing-title',
        message: 'evaluated title was empty',
        recordIndex
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
exports.evaluateBinding = evaluateBinding
exports.expandIteration = expandIteration
exports.convert = convert
