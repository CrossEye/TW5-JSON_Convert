const { parsePath, renderPathSegments } = require(
  '$:/plugins/crosseye/json-convert/engine/path.js'
)
const { walkTemplate, parseToken } = require(
  '$:/plugins/crosseye/json-convert/engine/template.js'
)

// For each input records-path (a string like `{{a[*].b[*]}}`), emit
// the records-paths of its ancestor scopes.  Innermost-parent first,
// outermost-but-not-root last.  A path with 0 or 1 `[*]` produces
// nothing.
//
// Example: `{{[*].subgroups[*].items[*]}}` →
//   `{{[*].subgroups[*]}}`     (innermost parent — subgroups)
//   `{{[*]}}`                  (outermost ancestor — top-level groups)
//
// Used by the path-pick modal to render one tree per ancestor scope.
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
    if (nStars <= 1) return
    for (let depth = 1; depth < nStars; depth++) {
      const idx = nStars - depth - 1
      const parentSegs = segments.slice(0, stars[idx] + 1)
      out.push(`{{${renderPathSegments(parentSegs)}}}`)
    }
  })
  return out
}
