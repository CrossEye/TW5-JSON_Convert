const { parsePath, hasStar } = require('./path.js')
const { defaultTransforms } = require('./transforms.js')
const { walkTemplate, parseToken } = require('./template.js')

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const validateToken = (content, location, transformNames) => {
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
  } else if (hasStar(segs)) {
    errors.push({
      code: 'binding-token-star',
      message: `${location}: [*] is not allowed in template tokens`,
      location,
      path
    })
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

const validateTemplate = (template, location, transformNames) => {
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
      errors.push(...validateToken(content, location, transformNames))
    }
  )
  return errors
}

const validateIteration = (iteration) => {
  if (typeof iteration !== 'string' || iteration === '') {
    return [{
      code: 'missing-iteration',
      message: 'profile.iteration must be a non-empty string'
    }]
  }
  let hasText = false
  let tokenCount = 0
  let tokenContent = null
  let walkErr = null
  walkTemplate(iteration,
    (err) => { walkErr = err },
    () => { hasText = true },
    (content) => { tokenCount++; tokenContent = content }
  )
  if (walkErr) {
    return [{
      code: 'bad-iteration-path',
      message:
        `profile.iteration: unterminated "{{" at position ${walkErr.pos}`,
      path: iteration
    }]
  }
  if (tokenCount !== 1 || hasText) {
    return [{
      code: 'bad-iteration-path',
      message:
        `profile.iteration "${iteration}" must be a single template ` +
        `token like "{{path}}" with no surrounding text`,
      path: iteration
    }]
  }
  const { path, transforms } = parseToken(tokenContent)
  if (transforms.length > 0) {
    return [{
      code: 'bad-iteration-path',
      message:
        `profile.iteration "${iteration}" cannot contain transforms`,
      path: iteration
    }]
  }
  if (parsePath(path) === null) {
    return [{
      code: 'bad-iteration-path',
      message:
        `profile.iteration token "{{${tokenContent}}}" is not a valid path`,
      path
    }]
  }
  return []
}

const validateBinding = (binding, location, transformNames) => {
  if (typeof binding !== 'string') {
    return [{
      code: 'binding-bad-shape',
      message: `${location} must be a string`,
      location
    }]
  }
  return validateTemplate(binding, location, transformNames)
}

const validateCustomFields = (customFields, twFields, transformNames) => {
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
    errors.push(...validateBinding(binding, location, transformNames))
  }
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

  errors.push(...validateIteration(profile.iteration))

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
        ...validateBinding(binding, `tw-fields.${field}`, transformNames)
      )
    }
  }

  if ('custom-fields' in profile) {
    errors.push(
      ...validateCustomFields(
        profile['custom-fields'], twFields, transformNames
      )
    )
  }

  return errors
}

exports.validateProfile = validateProfile
exports.validateBinding = validateBinding
exports.validateTemplate = validateTemplate
