const { normalizeEnabled } = require(
  '$:/plugins/crosseye/json-convert/engine/profile-format.js'
)

// For each input profile title, emit "yes" when that profile carries a
// non-empty `normalize` spec, "no" otherwise.  Lets the console read
// the flatten setting straight out of the profile — no mirrored state
// tiddler to drift.  Intended use:
//
//   [<profile>jc-normalize-enabled[]match[yes]]
exports['jc-normalize-enabled'] = function(source) {
  const out = []
  source((tiddler, title) => {
    const text = tiddler ? tiddler.fields.text || '' : ''
    out.push(normalizeEnabled(text) ? 'yes' : 'no')
  })
  return out
}
