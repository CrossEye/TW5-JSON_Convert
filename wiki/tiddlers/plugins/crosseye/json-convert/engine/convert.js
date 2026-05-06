const { parse } = require('./parser.js')
const { parsePath, resolvePath } = require('./path.js')
const { defaultTransforms } = require('./transforms.js')
const { validateProfile } = require('./validate.js')

const evaluatePath = (pathExpr, record, recordIndex) => {
  const v = resolvePath(record, pathExpr)
  return v === undefined
    ? {
        value: '',
        warnings: [{
          code: 'path-missing',
          message: `path "${pathExpr}" missing`,
          path: pathExpr,
          recordIndex
        }]
      }
    : { value: v, warnings: [] }
}

const interpolate = (template, record, recordIndex) => {
  const warnings = []
  const value = template.replace(/\{([^}]*)\}/g, (_, pathExpr) => {
    const segments = parsePath(pathExpr)
    if (!segments) return ''
    const v = resolvePath(record, segments)
    if (v === undefined) {
      warnings.push({
        code: 'path-missing',
        message: `path "${pathExpr}" missing`,
        path: pathExpr,
        recordIndex
      })
      return ''
    }
    return String(v)
  })
  return { value, warnings }
}

const evaluateBinding = (binding, record, recordIndex, transforms) => {
  const evaluated =
    'path'     in binding ? evaluatePath(binding.path, record, recordIndex)
    : 'template' in binding ? interpolate(binding.template, record, recordIndex)
    : 'literal'  in binding ? { value: binding.literal, warnings: [] }
    :                         { value: '', warnings: [] }

  const fn = binding.transform && transforms && transforms[binding.transform]
  const transformed = fn ? fn(evaluated.value) : evaluated.value

  const value = typeof transformed === 'string' ? transformed
    : transformed === null || transformed === undefined ? ''
    : String(transformed)

  return { value, warnings: evaluated.warnings }
}

const expandIteration = (root, iterationPath) => {
  const value = resolvePath(root, iterationPath)
  if (!Array.isArray(value)) {
    return {
      records: null,
      error: {
        code: 'iteration-not-array',
        message:
          `iteration path "${iterationPath}" did not resolve to an array`,
        path: iterationPath
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

exports.evaluatePath = evaluatePath
exports.interpolate = interpolate
exports.evaluateBinding = evaluateBinding
exports.expandIteration = expandIteration
exports.convert = convert
