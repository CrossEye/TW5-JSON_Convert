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
