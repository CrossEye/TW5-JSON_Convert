const { parsePath, hasStar } = require('./path.js')
const { defaultTransforms } = require('./transforms.js')

const FORM_KEYS = ['path', 'template', 'literal']

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const validateBinding = (binding, location, transformNames) => {
  if (!isPlainObject(binding)) {
    return [{
      code: 'binding-not-object',
      message: `${location} must be an object`,
      location
    }]
  }

  const errors = []
  const forms = FORM_KEYS.filter((k) => k in binding)
  if (forms.length === 0) {
    errors.push({
      code: 'binding-missing-form',
      message: `${location} must have one of path, template, or literal`,
      location
    })
  } else if (forms.length > 1) {
    errors.push({
      code: 'binding-multiple-forms',
      message:
        `${location} has multiple forms: ${forms.join(', ')}; pick one`,
      location
    })
  }

  if ('path' in binding) {
    if (typeof binding.path !== 'string') {
      errors.push({
        code: 'binding-path-not-string',
        message: `${location}.path must be a string`,
        location
      })
    } else {
      const segs = parsePath(binding.path)
      if (segs === null) {
        errors.push({
          code: 'binding-bad-path',
          message: `${location} has invalid path "${binding.path}"`,
          location,
          path: binding.path
        })
      } else if (hasStar(segs)) {
        errors.push({
          code: 'binding-star-not-allowed',
          message: `[*] is not allowed in binding paths (${location})`,
          location,
          path: binding.path
        })
      }
    }
  }

  if ('template' in binding) {
    if (typeof binding.template !== 'string') {
      errors.push({
        code: 'binding-template-not-string',
        message: `${location}.template must be a string`,
        location
      })
    } else {
      for (const m of binding.template.matchAll(/\{([^}]*)\}/g)) {
        const expr = m[1]
        const segs = parsePath(expr)
        if (segs === null) {
          errors.push({
            code: 'binding-bad-template-path',
            message:
              `${location} template token "{${expr}}" is not a valid path`,
            location,
            path: expr
          })
        } else if (hasStar(segs)) {
          errors.push({
            code: 'binding-template-star',
            message: `[*] is not allowed in template paths (${location})`,
            location,
            path: expr
          })
        }
      }
    }
  }

  if ('literal' in binding && typeof binding.literal !== 'string') {
    errors.push({
      code: 'binding-literal-not-string',
      message: `${location}.literal must be a string`,
      location
    })
  }

  if (binding.transform !== undefined) {
    if (typeof binding.transform !== 'string') {
      errors.push({
        code: 'binding-transform-not-string',
        message: `${location}.transform must be a string`,
        location
      })
    } else if (!transformNames.has(binding.transform)) {
      errors.push({
        code: 'unknown-transform',
        message:
          `unknown transform "${binding.transform}" at ${location}`,
        location,
        transform: binding.transform
      })
    }
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
    Object.keys(transforms || defaultTransforms)
  )

  if (typeof profile.iteration !== 'string' || profile.iteration === '') {
    errors.push({
      code: 'missing-iteration',
      message: 'profile.iteration must be a non-empty string'
    })
  } else if (parsePath(profile.iteration) === null) {
    errors.push({
      code: 'bad-iteration-path',
      message:
        `profile.iteration "${profile.iteration}" is not a valid path`,
      path: profile.iteration
    })
  }

  const bindings = profile.bindings
  if (bindings === undefined) {
    errors.push({
      code: 'missing-title-binding',
      message: 'profile.bindings must include "title"'
    })
  } else if (!isPlainObject(bindings)) {
    errors.push({
      code: 'bindings-not-object',
      message: 'profile.bindings must be an object'
    })
  } else {
    if (!('title' in bindings)) {
      errors.push({
        code: 'missing-title-binding',
        message: 'profile.bindings must include "title"'
      })
    }
    for (const [field, binding] of Object.entries(bindings)) {
      errors.push(
        ...validateBinding(binding, `bindings.${field}`, transformNames)
      )
    }
  }

  if ('extras' in profile) {
    if (!Array.isArray(profile.extras)) {
      errors.push({
        code: 'extras-not-array',
        message: 'profile.extras must be an array'
      })
    } else {
      profile.extras.forEach((extra, i) => {
        const location = `extras[${i}]`
        if (!isPlainObject(extra)) {
          errors.push({
            code: 'extra-not-object',
            message: `${location} must be an object`,
            location
          })
          return
        }
        if (typeof extra.field !== 'string' || extra.field === '') {
          errors.push({
            code: 'extra-missing-field',
            message: `${location} missing "field"`,
            location
          })
        }
        const { field, ...rest } = extra
        errors.push(...validateBinding(rest, location, transformNames))
      })
    }
  }

  return errors
}

exports.validateProfile = validateProfile
exports.validateBinding = validateBinding
