const { prepareSource } = require(
  '$:/plugins/crosseye/json-convert/engine/prepare.js'
)
const { resolvePath } = require(
  '$:/plugins/crosseye/json-convert/engine/path.js'
)
const { mergeRecordShapes } = require(
  '$:/plugins/crosseye/json-convert/engine/shape.js'
)
const { collectLeafPaths } = require(
  '$:/plugins/crosseye/json-convert/engine/picker.js'
)
const { walkTemplate, parseToken } = require(
  '$:/plugins/crosseye/json-convert/engine/template.js'
)

const extractRecordsToken = (recordsPath) => {
  let path = null
  walkTemplate(recordsPath,
    () => {},
    () => {},
    (content) => { if (path === null) path = parseToken(content).path }
  )
  return path === null ? recordsPath : path
}

// Recover the leaf set from source + records path.  Returns [] if any
// step fails (parse error, records path doesn't resolve, empty array).
// `normalizeSpec` is the profile's normalize value, so the leaves
// offered by the pickers are the leaves the conversion will see.
const enumerateLeafPaths = (wiki, sourceTitle, recordsPath, normalizeSpec) => {
  const text = wiki.getTiddlerText(sourceTitle) || ''
  if (!text.trim()) return []
  const result = prepareSource(text, normalizeSpec)
  if (result.errors.length) return []
  if (!recordsPath || !recordsPath.trim()) return []
  const records = resolvePath(result.value, extractRecordsToken(recordsPath))
  if (!Array.isArray(records) || records.length === 0) return []
  return collectLeafPaths(mergeRecordShapes(records))
}

exports.enumerateLeafPaths = enumerateLeafPaths
exports.extractRecordsToken = extractRecordsToken
