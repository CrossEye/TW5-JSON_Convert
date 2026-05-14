const {
  transformName,
  TRANSFORM_TYPES
} = require('$:/plugins/crosseye/json-convert/widgets/util.js')

// For each input tiddler in the source list, emit its transform name
// (the `name` field, defaulting to a slug of the title).  Tiddlers
// whose type isn't a recognised transform body language are skipped.
// Intended use:
//
//   [tag[$:/tags/json-convert/transform]jc-transform-name[]]
exports['jc-transform-name'] = function(source) {
  const out = []
  source((tiddler, title) => {
    if (!tiddler) return
    if (!TRANSFORM_TYPES.has(tiddler.fields.type)) return
    const name = transformName(tiddler, title)
    if (name) out.push(name)
  })
  return out
}
