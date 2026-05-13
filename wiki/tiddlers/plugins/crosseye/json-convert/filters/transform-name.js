const {
  transformName,
  TRANSFORM_TYPE
} = require('$:/plugins/crosseye/json-convert/widgets/util.js')

// For each input tiddler in the source list, emit its transform name
// (the `name` field, defaulting to a slug of the title).  Tiddlers
// whose type isn't `application/javascript` are skipped.  Intended use:
//
//   [tag[$:/tags/json-convert/transform]jc-transform-name[]]
exports['jc-transform-name'] = function(source) {
  const out = []
  source.each((tiddler, title) => {
    if (!tiddler) return
    if (tiddler.fields.type !== TRANSFORM_TYPE) return
    const name = transformName(tiddler, title)
    if (name) out.push(name)
  })
  return out
}
