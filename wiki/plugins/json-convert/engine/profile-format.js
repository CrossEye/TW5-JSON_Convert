const { AUTO_PIVOT_SPEC } = require('./normalize.js')

// Serializing a profile back to the JSON text of its tiddler.  Shared
// by the editor (which rebuilds the whole profile from its draft) and
// the console's normalize toggle (which changes one key and leaves
// the rest alone).

const KNOWN_KEYS = ['records', 'normalize', 'tw-fields', 'custom-fields']

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

// One binding per line, colons aligned within each group.
const formatGroupBody = (group) => {
  const entries = Object.entries(group || {})
  if (entries.length === 0) return ''
  const keys = entries.map(([k]) => JSON.stringify(k))
  const maxKeyLen = Math.max(...keys.map((k) => k.length))
  return entries.map(([k, v]) => {
    const key = JSON.stringify(k)
    const pad = ' '.repeat(maxKeyLen - key.length + 1)
    return `    ${key}:${pad}${JSON.stringify(v)}`
  }).join(',\n')
}

const formatGroup = (name, group) => {
  const body = formatGroupBody(group)
  if (!body) return `  ${JSON.stringify(name)}: {}`
  return `  ${JSON.stringify(name)}: {\n${body}\n  }`
}

const formatProfile = (profile) => {
  const parts = [`  "records": ${JSON.stringify(profile.records)}`]
  if (profile.normalize !== undefined) {
    parts.push(`  "normalize": ${JSON.stringify(profile.normalize)}`)
  }
  parts.push(formatGroup('tw-fields', profile['tw-fields']))
  if (profile['custom-fields'] !== undefined) {
    parts.push(formatGroup('custom-fields', profile['custom-fields']))
  }
  // Anything this tool doesn't know about is passed through rather
  // than dropped, so a rewrite never costs the user data.
  for (const [k, v] of Object.entries(profile)) {
    if (!KNOWN_KEYS.includes(k)) {
      parts.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    }
  }
  return `{\n${parts.join(',\n')}\n}`
}

const normalizeEnabled = (profileText) => {
  try {
    const profile = JSON.parse(profileText)
    return isPlainObject(profile) &&
      Array.isArray(profile.normalize) &&
      profile.normalize.length > 0
  } catch (_) {
    return false
  }
}

// Turn the auto-pivot on or off in a profile's JSON text.  Returns
// null when the text isn't a profile object, so callers can leave a
// malformed profile untouched rather than overwrite it.  Turning it
// on preserves an existing hand-written spec; turning it off drops
// the key entirely.
const setNormalizeEnabled = (profileText, enabled) => {
  let profile
  try {
    profile = JSON.parse(profileText)
  } catch (_) {
    return null
  }
  if (!isPlainObject(profile)) return null
  if (!enabled) {
    if (profile.normalize === undefined) return null
    const { normalize, ...rest } = profile
    return formatProfile(rest)
  }
  if (Array.isArray(profile.normalize) && profile.normalize.length > 0) {
    return null
  }
  return formatProfile({ ...profile, normalize: AUTO_PIVOT_SPEC })
}

exports.formatProfile = formatProfile
exports.normalizeEnabled = normalizeEnabled
exports.setNormalizeEnabled = setNormalizeEnabled
