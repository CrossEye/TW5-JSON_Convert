const Widget = require('$:/core/modules/widgets/widget.js').widget
const { parse } = require('$:/plugins/crosseye/json-convert/engine/parser.js')
const { resolvePath } = require('$:/plugins/crosseye/json-convert/engine/path.js')
const { mergeRecordShapes } = require('$:/plugins/crosseye/json-convert/engine/shape.js')
const { walkTemplate, parseToken } = require('$:/plugins/crosseye/json-convert/engine/template.js')
const { collectLeafPaths, diffPicker } = require('$:/plugins/crosseye/json-convert/engine/picker.js')

const extractRecordsToken = (recordsPath) => {
  let path = null
  walkTemplate(recordsPath,
    () => {},
    () => {},
    (content) => { if (path === null) path = parseToken(content).path }
  )
  return path === null ? recordsPath : path
}

const enumerateLeafPaths = (wiki, sourceTitle, recordsPath) => {
  const text = wiki.getTiddlerText(sourceTitle) || ''
  if (!text.trim()) return []
  const result = parse(text)
  if (result.errors.length) return []
  if (!recordsPath || !recordsPath.trim()) return []
  const records = resolvePath(result.value, extractRecordsToken(recordsPath))
  if (!Array.isArray(records) || records.length === 0) return []
  return collectLeafPaths(mergeRecordShapes(records))
}

const readGroup = (wiki, draftBase, group) => {
  const keysT = wiki.getTiddler(`${draftBase}${group}-keys`)
  if (!keysT) return {}
  const names = $tw.utils.parseStringArray(keysT.fields.list || '')
  const out = {}
  for (const name of names) {
    const row = wiki.getTiddler(`${draftBase}${group}/${name}`)
    if (row) out[name] = row.fields.value || ''
  }
  return out
}

const readJsonState = (wiki, title) => {
  const t = wiki.getTiddler(title)
  if (!t) return {}
  try {
    const obj = JSON.parse(t.fields.text || '{}')
    return obj && typeof obj === 'object' ? obj : {}
  } catch (_) { return {} }
}

// Apply a picker diff to the editor's draft custom-fields.  The list
// tiddler is rewritten with removals filtered out and additions
// appended; row tiddlers are created or deleted as needed.  Caller is
// expected to fire `<$json-convert-editor-write>` afterwards to flush
// the new draft to the profile body (the modal does this).
const applyDiff = (wiki, draftBase, diff) => {
  const keysTitle = `${draftBase}custom-fields-keys`
  const keysT = wiki.getTiddler(keysTitle)
  const current = keysT
    ? $tw.utils.parseStringArray(keysT.fields.list || '')
    : []
  const removeSet = new Set(diff.remove || [])
  const next = current.filter((n) => !removeSet.has(n))
  for (const name of diff.remove || []) {
    wiki.deleteTiddler(`${draftBase}custom-fields/${name}`)
  }
  for (const { name, path } of diff.add || []) {
    wiki.addTiddler({
      title: `${draftBase}custom-fields/${name}`,
      value: `{{${path}}}`
    })
    if (!next.includes(name)) next.push(name)
  }
  wiki.addTiddler({
    title: keysTitle,
    list: $tw.utils.stringifyList(next)
  })
}

function JsonConvertPickerApplyWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertPickerApplyWidget.prototype = Object.create(Widget.prototype)

JsonConvertPickerApplyWidget.prototype.render = function() {
  this.computeAttributes()
  this.execute()
}

JsonConvertPickerApplyWidget.prototype.execute = function() {
  this.draftBase = this.getAttribute('draft-base', '')
  this.stateTitle = this.getAttribute('state-title',
    '$:/state/json-convert/editor/picker')
  this.snapshotTitle = this.getAttribute('snapshot-title',
    '$:/state/json-convert/editor/picker-open-snapshot')
  this.sourceTitle = this.getAttribute('source-title', '')
  this.recordsPath = this.getAttribute('records-path', '')
}

JsonConvertPickerApplyWidget.prototype.refresh = function() {
  return false
}

JsonConvertPickerApplyWidget.prototype.invokeAction = function() {
  if (!this.draftBase) return true
  const newState = readJsonState(this.wiki, this.stateTitle)
  const oldState = readJsonState(this.wiki, this.snapshotTitle)
  const customFields = readGroup(this.wiki, this.draftBase, 'custom-fields')
  const leafPaths = enumerateLeafPaths(this.wiki, this.sourceTitle, this.recordsPath)
  const diff = diffPicker({ oldState, newState, customFields, leafPaths })
  applyDiff(this.wiki, this.draftBase, diff)
  return true
}

exports['json-convert-picker-apply'] = JsonConvertPickerApplyWidget
