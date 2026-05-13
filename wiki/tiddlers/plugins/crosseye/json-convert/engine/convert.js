const { parse } = require('./parser.js')
const { parsePath, resolvePath } = require('./path.js')
const { defaultTransforms } = require('./transforms.js')
const { validateProfile } = require('./validate.js')
const { walkTemplate, parseToken } = require('./template.js')

const coerce = (v) =>
  typeof v === 'string' ? v
  : v === null || v === undefined ? ''
  : String(v)

const interpolate = (template, record, recordIndex, transforms) => {
  const warnings = []
  const out = []
  walkTemplate(template,
    () => {}, // malformed templates are caught by validate
    (text) => out.push(text),
    (content) => {
      const { path, transforms: tokenTransforms } = parseToken(content)
      const segments = parsePath(path)
      if (!segments) { out.push(''); return }
      let v = resolvePath(record, segments)
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

const evaluateBinding = (binding, record, recordIndex, transforms) =>
  interpolate(binding, record, recordIndex, transforms)

const extractIterationToken = (iteration) => {
  let path = null
  walkTemplate(iteration,
    () => {},
    () => {},
    (content) => { path = parseToken(content).path }
  )
  return path
}

const expandIteration = (root, iteration) => {
  const path = extractIterationToken(iteration)
  const value = resolvePath(root, path)
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
  return { records: value, error: null }
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

  expanded.records.forEach((record, recordIndex) => {
    const fields = {}
    for (const [field, binding] of Object.entries(profile['tw-fields'] || {})) {
      const r = evaluateBinding(binding, record, recordIndex, transforms)
      fields[field] = r.value
      warnings.push(...r.warnings)
    }
    for (const [field, binding] of Object.entries(profile['custom-fields'] || {})) {
      const r = evaluateBinding(binding, record, recordIndex, transforms)
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
