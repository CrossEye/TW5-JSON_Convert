const Widget = require('$:/core/modules/widgets/widget.js').widget
const { parse } = require('$:/plugins/crosseye/json-convert/engine/parser.js')
const { resolvePath } = require('$:/plugins/crosseye/json-convert/engine/path.js')
const { mergeRecordShapes } = require('$:/plugins/crosseye/json-convert/engine/shape.js')
const { walkTemplate, parseToken } = require('$:/plugins/crosseye/json-convert/engine/template.js')
const { collectLeafPaths, selectAllPickerState } = require('$:/plugins/crosseye/json-convert/engine/picker.js')
const { flattenPath } = require('$:/plugins/crosseye/json-convert/engine/field-name.js')

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

const writeJsonState = (wiki, title, obj) => {
  if (!title) return
  wiki.addTiddler({
    title,
    type: 'application/json',
    text: JSON.stringify(obj, null, 2)
  })
}

function JsonConvertPickerBulkWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertPickerBulkWidget.prototype = Object.create(Widget.prototype)

JsonConvertPickerBulkWidget.prototype.render = function() {
  this.computeAttributes()
  this.execute()
}

JsonConvertPickerBulkWidget.prototype.execute = function() {
  this.action = this.getAttribute('action', '')
  this.sourceTitle = this.getAttribute('source-title', '')
  this.recordsPath = this.getAttribute('records-path', '')
  this.draftBase = this.getAttribute('draft-base', '')
  this.stateTitle = this.getAttribute('state-title',
    '$:/state/json-convert/editor/picker')
}

JsonConvertPickerBulkWidget.prototype.refresh = function() {
  return false
}

JsonConvertPickerBulkWidget.prototype.invokeAction = function() {
  if (this.action === 'clear') {
    writeJsonState(this.wiki, this.stateTitle, {})
    return true
  }
  if (this.action === 'select-all') {
    if (!this.draftBase) return true
    const leafPaths = enumerateLeafPaths(this.wiki, this.sourceTitle, this.recordsPath)
    const twFields = readGroup(this.wiki, this.draftBase, 'tw-fields')
    const customFields = readGroup(this.wiki, this.draftBase, 'custom-fields')
    const currentState = readJsonState(this.wiki, this.stateTitle)
    const next = selectAllPickerState({
      leafPaths, twFields, customFields, currentState, flattenPath
    })
    writeJsonState(this.wiki, this.stateTitle, next)
  }
  return true
}

exports['json-convert-picker-bulk'] = JsonConvertPickerBulkWidget
