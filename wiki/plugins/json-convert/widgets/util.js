const clearByPrefix = (wiki, prefix) => {
  const stale = []
  wiki.each((tiddler, title) => {
    if (title.indexOf(prefix) === 0) stale.push(title)
  })
  stale.forEach((t) => wiki.deleteTiddler(t))
}

// User transforms are tiddlers tagged $:/tags/json-convert/transform.
// Two body languages are supported, dispatched by the tiddler's
// `type` field:
//
//   application/javascript — body is a JS function body; `value` is
//     in scope and the return value is the transformed value.
//   text/vnd.tiddlywiki    — body is wikitext rendered with `value`
//     as a variable; the rendered output is the transformed value.
//
// Each tiddler carries an optional `name` field (defaulted to a slug
// of the title).  A compile/render error skips the transform; a
// runtime throw or render failure returns '' so a misbehaving
// transform can't kill the whole conversion.
const TRANSFORM_TAG = '$:/tags/json-convert/transform'
const TYPE_JS = 'application/javascript'
const TYPE_WIKITEXT = 'text/vnd.tiddlywiki'
const TRANSFORM_TYPES = new Set([TYPE_JS, TYPE_WIKITEXT])

const slugify = (s) => String(s).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const transformName = (tiddler, title) =>
  tiddler.fields.name || slugify(title)

const compileJsTransform = (body) => {
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

const compileWikitextTransform = (wiki, body) => (value) => {
  try {
    return wiki.renderText(
      'text/plain', 'text/vnd.tiddlywiki', body,
      { variables: { value: String(value) } }
    )
  } catch (_) {
    return ''
  }
}

const compileTransform = (wiki, type, body) => {
  if (type === TYPE_JS) return compileJsTransform(body)
  if (type === TYPE_WIKITEXT) return compileWikitextTransform(wiki, body)
  return null
}

const collectUserTransforms = (wiki) => {
  const titles = wiki.filterTiddlers(
    `[all[shadows+tiddlers]tag[${TRANSFORM_TAG}]]`
  )
  const out = {}
  for (const title of titles) {
    const tiddler = wiki.getTiddler(title)
    if (!tiddler) continue
    const type = tiddler.fields.type
    if (!TRANSFORM_TYPES.has(type)) continue
    const name = transformName(tiddler, title)
    if (!name) continue
    const fn = compileTransform(wiki, type, tiddler.fields.text || '')
    if (fn) out[name] = fn
  }
  return out
}

// Why a transform name the profile uses is not in the registry.  The
// three usual reasons — the tiddler has no usable type, it is not
// tagged, its JavaScript does not compile — are silent in
// collectUserTransforms, which simply skips such tiddlers; this puts
// the reason into the "unknown transform" message.  Returns '' when
// nothing in the wiki looks like an attempt at that name.
const explainUnknownTransform = (wiki, name) => {
  const tagged = wiki.filterTiddlers(
    `[all[shadows+tiddlers]tag[${TRANSFORM_TAG}]]`
  )
  for (const title of tagged) {
    const tiddler = wiki.getTiddler(title)
    if (!tiddler || transformName(tiddler, title) !== name) continue
    const type = tiddler.fields.type
    if (!TRANSFORM_TYPES.has(type)) {
      return `the tiddler "${title}" carries that name but its type is ` +
        (type ? `"${type}"` : 'not set') +
        `; a transform needs type ${TYPE_JS} or ${TYPE_WIKITEXT}`
    }
    if (type === TYPE_JS) {
      try {
        // eslint-disable-next-line no-new-func
        new Function('value', tiddler.fields.text || '')
      } catch (e) {
        return `the tiddler "${title}" carries that name but its ` +
          `JavaScript does not compile: ${e.message}`
      }
    }
  }
  const named = wiki.filterTiddlers(
    `[all[shadows+tiddlers]field:name[${name}]!tag[${TRANSFORM_TAG}]]`
  )
  if (named.length) {
    return `the tiddler "${named[0]}" has name "${name}" but is not ` +
      `tagged ${TRANSFORM_TAG}`
  }
  return ''
}

// Append the explanation to every unknown-transform error in a list.
const explainTransformErrors = (wiki, errors) => errors.map((e) => {
  const isUnknown = e.code === 'unknown-transform' ||
    (e.code === 'profile-invalid' && /^unknown-transform:/.test(e.message))
  if (!isUnknown) return e
  const m = /unknown transform "([^"]+)"/.exec(e.message)
  const why = m ? explainUnknownTransform(wiki, m[1]) : ''
  return why ? { ...e, message: `${e.message} — ${why}` } : e
})

exports.clearByPrefix = clearByPrefix
exports.explainUnknownTransform = explainUnknownTransform
exports.explainTransformErrors = explainTransformErrors
exports.collectUserTransforms = collectUserTransforms
exports.slugify = slugify
exports.transformName = transformName
exports.TRANSFORM_TAG = TRANSFORM_TAG
exports.TRANSFORM_TYPES = TRANSFORM_TYPES
// Back-compat alias for the filter operator, which only needs to know
// whether a tiddler has *some* supported transform type.
exports.TRANSFORM_TYPE = TYPE_JS
