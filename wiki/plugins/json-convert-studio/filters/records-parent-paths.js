const { parsePath, renderPathSegments } = require(
  '$:/plugins/crosseye/json-convert/engine/path.js'
)
const { walkTemplate, parseToken } = require(
  '$:/plugins/crosseye/json-convert/engine/template.js'
)

// For each input records-path (a string like `{{a[*].b[*]}}`), emit
// the records-paths of its ancestor scopes.  Innermost-parent first,
// root last.  An empty string represents the document root (no
// iteration); the tree widget renders the raw source shape for it.
// A records-path with 0 `[*]` produces nothing.
//
// Example: `{{[*].subgroups[*].items[*]}}` →
//   `{{[*].subgroups[*]}}`     (innermost parent — subgroups)
//   `{{[*]}}`                  (outer ancestor — top-level groups)
//   ``                         (root document)
//
// Used by the path-pick modal to render one tree per ancestor scope.
// The modal's depth counter (1, 2, …, nStars) matches the number of
// `../` segments needed to reach each scope from the innermost record.
const extractToken = (recordsPath) => {
  let path = null
  walkTemplate(recordsPath,
    () => {},
    () => {},
    (content) => { if (path === null) path = parseToken(content).path }
  )
  return path === null ? recordsPath : path
}

exports['jc-records-parent-paths'] = function(source) {
  const out = []
  source((tiddler, title) => {
    const tokenPath = extractToken(title)
    const segments = parsePath(tokenPath)
    if (!segments) return
    const stars = []
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].type === 'star') stars.push(i)
    }
    const nStars = stars.length
    if (nStars === 0) return
    for (let depth = 1; depth < nStars; depth++) {
      const idx = nStars - depth - 1
      const parentSegs = segments.slice(0, stars[idx] + 1)
      out.push(`{{${renderPathSegments(parentSegs)}}}`)
    }
    out.push('')
  })
  return out
}

// For an input records-path and a depth (1 = innermost-parent, …,
// nStars = root), return the key segment that bridges into the
// next-deeper scope — i.e. the key the picker should HIDE at this
// ancestor's tree so users don't see noise like the `activities`
// entry inside the `days[*]` scope.  Returns empty if the bridging
// segment isn't a plain key (e.g. adjacent `[*]`s or bare-array root).
//
// Example: `{{days[*].activities[*]}}` with depth=1 → `activities`,
// depth=2 → `days`.  `{{[*].subgroups[*]}}` depth=2 → `` (bare array).
exports['jc-records-hide-key'] = function(source, operator) {
  const depth = Number.parseInt(operator.operand, 10)
  const out = []
  source((_, title) => {
    const segments = parsePath(extractToken(title))
    if (!segments || Number.isNaN(depth) || depth < 1) {
      out.push('')
      return
    }
    const stars = []
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].type === 'star') stars.push(i)
    }
    const nStars = stars.length
    if (depth > nStars) {
      out.push('')
      return
    }
    const idx = depth === nStars ? 0 : stars[nStars - 1 - depth] + 1
    const seg = segments[idx]
    out.push(seg && seg.type === 'key' ? seg.key : '')
  })
  return out
}

// Strip the `{{` / `}}` wrapping from a records-path template, so the
// inner path can be shown in a heading.  Exists because TW's attribute
// parser treats `"{{"` as an empty transclusion, making the natural
// `trimprefix[{{]trimsuffix[}}]` approach unusable both directly and
// via indirect operand.
exports['jc-strip-template-braces'] = function(source) {
  const out = []
  source((_, title) => {
    if (title.length >= 4 && title.startsWith('{{') && title.endsWith('}}')) {
      out.push(title.slice(2, -2))
    } else {
      out.push(title)
    }
  })
  return out
}
