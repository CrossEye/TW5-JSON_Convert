const slugify = (s) => String(s).toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const splitPath = (path) => {
  const out = []
  const re = /([^.[\]]+)|\[([^\]]+)\]/g
  let m
  while ((m = re.exec(path)) !== null) {
    const seg = m[1] != null ? m[1] : m[2]
    if (seg !== '*' && seg !== '' && !/^\d+$/.test(seg)) out.push(seg)
  }
  return out
}

const withSuffix = (name, n) => n <= 1 ? name : `${name}-${n}`

const flattenPath = (path, takenNames) => {
  const segs = splitPath(path).map(slugify).filter((s) => s !== '')
  const taken = takenNames instanceof Set ? takenNames : new Set(takenNames || [])
  if (segs.length === 0) {
    for (let n = 1; n < 1000; n++) {
      const cand = withSuffix('field', n)
      if (!taken.has(cand)) return cand
    }
    return 'field'
  }
  for (let depth = 1; depth <= segs.length; depth++) {
    const base = segs.slice(segs.length - depth).join('-')
    if (!taken.has(base)) return base
  }
  const root = segs.join('-')
  for (let n = 2; n < 1000; n++) {
    const cand = withSuffix(root, n)
    if (!taken.has(cand)) return cand
  }
  return root
}

// Recognize a binding as a pass-through: returns the source path if the
// binding value is exactly `{{<path>}}` (no transforms, no extra text)
// AND <path> exists in the known leaf paths AND the field name is one
// the flattening rule could plausibly have produced for that path.
const passThroughPath = (bindingValue, fieldName, leafPaths) => {
  const m = /^\{\{([^|}]+)\}\}$/.exec(String(bindingValue || ''))
  if (!m) return null
  const path = m[1]
  const known = leafPaths instanceof Set ? leafPaths : new Set(leafPaths || [])
  if (!known.has(path)) return null
  const segs = splitPath(path).map(slugify).filter((s) => s !== '')
  if (segs.length === 0) {
    if (fieldName === 'field' || /^field-\d+$/.test(fieldName)) return path
    return null
  }
  for (let depth = 1; depth <= segs.length; depth++) {
    if (segs.slice(segs.length - depth).join('-') === fieldName) return path
  }
  const root = segs.join('-')
  if (fieldName.startsWith(root + '-')) {
    const tail = fieldName.slice(root.length + 1)
    if (/^\d+$/.test(tail)) return path
  }
  return null
}

exports.flattenPath = flattenPath
exports.passThroughPath = passThroughPath
exports.slugify = slugify
exports.splitPath = splitPath
