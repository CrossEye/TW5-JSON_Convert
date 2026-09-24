const { parsePath, hasStar, hasParent, parentCount } = require('./path.js')
const { STEP_NAMES, PIVOT_OPTIONS } = require('./normalize.js')
const { defaultTransforms } = require('./transforms.js')
const { walkTemplate, parseToken } = require('./template.js')

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const validateToken = (content, location, transformNames, recordsDepth) => {
  const errors = []
  const { path, transforms } = parseToken(content)
  if (path === '') {
    errors.push({
      code: 'binding-bad-token',
      message: `${location}: token "{{${content}}}" has empty path`,
      location
    })
    return errors
  }
  const segs = parsePath(path)
  if (segs === null) {
    errors.push({
      code: 'binding-bad-token',
      message: `${location}: token "{{${content}}}" is not a valid path`,
      location,
      path
    })
  } else {
    if (hasStar(segs)) {
      errors.push({
        code: 'binding-token-star',
        message: `${location}: [*] is not allowed in template tokens`,
        location,
        path
      })
    }
    const parents = parentCount(segs)
    if (parents > recordsDepth) {
      errors.push({
        code: 'binding-parent-too-deep',
        message:
          `${location}: token "{{${content}}}" steps up ${parents} ` +
          `ancestor(s), but the records path only provides ${recordsDepth}`,
        location,
        path
      })
    }
  }
  for (const name of transforms) {
    if (name === '') {
      errors.push({
        code: 'binding-bad-token',
        message:
          `${location}: token "{{${content}}}" has empty transform name`,
        location
      })
    } else if (!transformNames.has(name)) {
      errors.push({
        code: 'unknown-transform',
        message: `unknown transform "${name}" at ${location}`,
        location,
        transform: name
      })
    }
  }
  return errors
}

const validateTemplate = (template, location, transformNames, recordsDepth) => {
  const errors = []
  walkTemplate(template,
    (err) => {
      errors.push({
        code: 'binding-bad-token',
        message:
          `${location}: unterminated "{{" at position ${err.pos}`,
        location
      })
    },
    () => {},
    (content) => {
      errors.push(...validateToken(
        content, location, transformNames, recordsDepth
      ))
    }
  )
  return errors
}

const validateRecords = (records) => {
  if (typeof records !== 'string' || records === '') {
    return [{
      code: 'missing-records',
      message: 'profile.records must be a non-empty string'
    }]
  }
  let hasText = false
  let tokenCount = 0
  let tokenContent = null
  let walkErr = null
  walkTemplate(records,
    (err) => { walkErr = err },
    () => { hasText = true },
    (content) => { tokenCount++; tokenContent = content }
  )
  if (walkErr) {
    return [{
      code: 'bad-records-path',
      message:
        `profile.records: unterminated "{{" at position ${walkErr.pos}`,
      path: records
    }]
  }
  if (tokenCount !== 1 || hasText) {
    return [{
      code: 'bad-records-path',
      message:
        `profile.records "${records}" must be a single template ` +
        `token like "{{path}}" with no surrounding text`,
      path: records
    }]
  }
  const { path, transforms } = parseToken(tokenContent)
  if (transforms.length > 0) {
    return [{
      code: 'bad-records-path',
      message:
        `profile.records "${records}" cannot contain transforms`,
      path: records
    }]
  }
  const segs = parsePath(path)
  if (segs === null) {
    return [{
      code: 'bad-records-path',
      message:
        `profile.records token "{{${tokenContent}}}" is not a valid path`,
      path
    }]
  }
  if (hasParent(segs)) {
    return [{
      code: 'bad-records-path',
      message:
        `profile.records "${records}" cannot use ".." (ancestor scopes are only valid in bindings)`,
      path
    }]
  }
  return []
}

// How many ancestor scopes does this records path provide to its
// bindings?  Each `[*]` adds one level; paths with no `[*]` still
// expose the document root (1 level).
const computeRecordsDepth = (records) => {
  if (typeof records !== 'string') return 1
  let count = 0
  let walkErr = null
  walkTemplate(records,
    (err) => { walkErr = err },
    () => {},
    (content) => {
      const segs = parsePath(parseToken(content).path)
      if (segs) for (const s of segs) if (s.type === 'star') count++
    }
  )
  if (walkErr) return 1
  return Math.max(count, 1)
}

const validateBinding = (binding, location, transformNames, recordsDepth) => {
  if (typeof binding !== 'string') {
    return [{
      code: 'binding-bad-shape',
      message: `${location} must be a string`,
      location
    }]
  }
  return validateTemplate(
    binding, location, transformNames,
    recordsDepth === undefined ? Infinity : recordsDepth
  )
}

const validateCustomFields = (
  customFields, twFields, transformNames, recordsDepth
) => {
  if (!isPlainObject(customFields)) {
    return [{
      code: 'custom-fields-not-object',
      message: 'profile.custom-fields must be an object'
    }]
  }
  const errors = []
  const twKeys = isPlainObject(twFields)
    ? new Set(Object.keys(twFields))
    : new Set()
  for (const [field, binding] of Object.entries(customFields)) {
    const location = `custom-fields.${field}`
    if (twKeys.has(field)) {
      errors.push({
        code: 'field-redefined',
        message: `${location} is already defined in tw-fields`,
        location,
        field
      })
    }
    errors.push(...validateBinding(
      binding, location, transformNames, recordsDepth
    ))
  }
  return errors
}

// profile.normalize is an optional list of reshaping steps applied to
// the source document before records expansion.  One step type is
// recognized: {"pivot": {key?, value?, at?}}.
const validatePivot = (opts, location) => {
  if (!isPlainObject(opts)) {
    return [{
      code: 'normalize-bad-step',
      message: `${location}: "pivot" must be an object`,
      location
    }]
  }
  const errors = []
  for (const name of Object.keys(opts)) {
    if (!PIVOT_OPTIONS.includes(name)) {
      errors.push({
        code: 'normalize-bad-step',
        message:
          `${location}: unknown pivot option "${name}" ` +
          `(expected ${PIVOT_OPTIONS.join(', ')})`,
        location
      })
    } else if (typeof opts[name] !== 'string') {
      errors.push({
        code: 'normalize-bad-step',
        message: `${location}: pivot "${name}" must be a string`,
        location
      })
    }
  }
  if (typeof opts.at === 'string' && opts.at !== '') {
    const segs = parsePath(opts.at)
    if (segs === null) {
      errors.push({
        code: 'normalize-bad-step',
        message: `${location}: pivot "at" is not a valid path`,
        location,
        path: opts.at
      })
    } else if (hasParent(segs)) {
      errors.push({
        code: 'normalize-bad-step',
        message:
          `${location}: pivot "at" cannot use ".." — it is resolved ` +
          'against the whole document',
        location,
        path: opts.at
      })
    }
  }
  return errors
}

const validateNormalize = (normalize) => {
  if (normalize === undefined) return []
  if (!Array.isArray(normalize)) {
    return [{
      code: 'normalize-not-array',
      message: 'profile.normalize must be an array of steps'
    }]
  }
  const errors = []
  normalize.forEach((step, i) => {
    const location = `normalize[${i}]`
    if (!isPlainObject(step)) {
      errors.push({
        code: 'unknown-normalize-step',
        message: `${location} must be an object like {"pivot": {}}`,
        location
      })
      return
    }
    const names = Object.keys(step)
    if (names.length !== 1 || !STEP_NAMES.includes(names[0])) {
      errors.push({
        code: 'unknown-normalize-step',
        message:
          `${location}: expected exactly one of ${STEP_NAMES.join(', ')}, ` +
          `got ${names.length === 0 ? '{}' : names.map((n) => `"${n}"`).join(', ')}`,
        location
      })
      return
    }
    errors.push(...validatePivot(step.pivot, location))
  })
  return errors
}

const validateProfile = (profile, transforms) => {
  if (!isPlainObject(profile)) {
    return [{
      code: 'profile-not-object',
      message: 'profile must be an object'
    }]
  }

  const errors = []
  const transformNames = new Set(
    Object.keys({ ...defaultTransforms, ...transforms })
  )

  errors.push(...validateRecords(profile.records))
  errors.push(...validateNormalize(profile.normalize))

  const recordsDepth = computeRecordsDepth(profile.records)

  const twFields = profile['tw-fields']
  if (twFields === undefined) {
    errors.push({
      code: 'missing-title-binding',
      message: 'profile.tw-fields must include "title"'
    })
  } else if (!isPlainObject(twFields)) {
    errors.push({
      code: 'tw-fields-not-object',
      message: 'profile.tw-fields must be an object'
    })
  } else {
    if (!('title' in twFields)) {
      errors.push({
        code: 'missing-title-binding',
        message: 'profile.tw-fields must include "title"'
      })
    }
    for (const [field, binding] of Object.entries(twFields)) {
      errors.push(
        ...validateBinding(
          binding, `tw-fields.${field}`, transformNames, recordsDepth
        )
      )
    }
  }

  if ('custom-fields' in profile) {
    errors.push(
      ...validateCustomFields(
        profile['custom-fields'], twFields, transformNames, recordsDepth
      )
    )
  }

  return errors
}

exports.validateProfile = validateProfile
exports.validateNormalize = validateNormalize
exports.validateBinding = validateBinding
exports.validateTemplate = validateTemplate
