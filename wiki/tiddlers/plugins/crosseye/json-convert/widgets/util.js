const clearByPrefix = (wiki, prefix) => {
  const stale = []
  wiki.each((tiddler, title) => {
    if (title.indexOf(prefix) === 0) stale.push(title)
  })
  stale.forEach((t) => wiki.deleteTiddler(t))
}

// User transforms are tiddlers tagged $:/tags/json-convert/transform.
// Each carries a `name` field (the transform's profile-facing name) and
// a `text` field holding the JS function body: `value` is in scope,
// return the transformed value.  A compile error skips the transform; a
// runtime throw returns '' so a misbehaving custom transform can't kill
// the whole conversion.
const TRANSFORM_TAG = '$:/tags/json-convert/transform'

const compileUserTransform = (body) => {
  let fn
  try {
    // eslint-disable-next-line no-new-func
    fn = new Function('value', body)
  } catch (_) {
    return null
  }
  return (value) => {
    try { return fn(value) } catch (_) { return '' }
  }
}

const collectUserTransforms = (wiki) => {
  const titles = wiki.filterTiddlers(`[tag[${TRANSFORM_TAG}]]`)
  const out = {}
  for (const title of titles) {
    const tiddler = wiki.getTiddler(title)
    if (!tiddler) continue
    const name = tiddler.fields.name
    if (!name) continue
    const fn = compileUserTransform(tiddler.fields.text || '')
    if (fn) out[name] = fn
  }
  return out
}

exports.clearByPrefix = clearByPrefix
exports.collectUserTransforms = collectUserTransforms
exports.TRANSFORM_TAG = TRANSFORM_TAG
