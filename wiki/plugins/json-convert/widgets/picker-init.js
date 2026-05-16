const Widget = require('$:/core/modules/widgets/widget.js').widget
const { parse } = require('$:/plugins/crosseye/json-convert/engine/parser.js')
const { resolvePath } = require('$:/plugins/crosseye/json-convert/engine/path.js')
const { mergeRecordShapes } = require('$:/plugins/crosseye/json-convert/engine/shape.js')
const { walkTemplate, parseToken } = require('$:/plugins/crosseye/json-convert/engine/template.js')
const { initialPickerState } = require('$:/plugins/crosseye/json-convert/engine/picker.js')

const extractRecordsToken = (recordsPath) => {
  let path = null
  walkTemplate(recordsPath,
    () => {},
    () => {},
    (content) => { if (path === null) path = parseToken(content).path }
  )
  return path === null ? recordsPath : path
}

// Walk the merged shape and collect every leaf path as a string in the
// engine's path syntax (using `[*]` where the walk descended into an
// array element).  Mirrors the canonical paths the tree widget emits in
// non-pick mode (modulo the records-pick rewriting), which is what we
// need to syntactically match against `{{...}}` bindings.
const segsToPath = (segs) => {
  let p = ''
  for (const s of segs) {
    if (s.kind === 'star') p += '[*]'
    else if (s.kind === 'index') p += `[${s.value}]`
    else p = p ? `${p}.${s.value}` : s.value
  }
  return p
}

const collectLeafPaths = (shape) => {
  const out = []
  const walk = (node, segs) => {
    if (!node) return
    if (node.kind === 'leaf' || node.kind === 'mixed') {
      out.push(segsToPath(segs))
      return
    }
    if (node.kind === 'object') {
      for (const key of Object.keys(node.children || {})) {
        walk(node.children[key], [...segs, { kind: 'key', value: key }])
      }
      return
    }
    if (node.kind === 'array') {
      if (node.element) walk(node.element, [...segs, { kind: 'star' }])
    }
  }
  walk(shape, [])
  return out
}

// Recover the leaf set from source + records path.  Returns [] if any
// step fails (parse error, records path doesn't resolve, empty array).
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

const writeJsonState = (wiki, title, obj) => {
  if (!title) return
  wiki.addTiddler({
    title,
    type: 'application/json',
    text: JSON.stringify(obj, null, 2)
  })
}

function JsonConvertPickerInitWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertPickerInitWidget.prototype = Object.create(Widget.prototype)

JsonConvertPickerInitWidget.prototype.render = function() {
  this.computeAttributes()
  this.execute()
}

JsonConvertPickerInitWidget.prototype.execute = function() {
  this.sourceTitle = this.getAttribute('source-title', '')
  this.recordsPath = this.getAttribute('records-path', '')
  this.draftBase = this.getAttribute('draft-base', '')
  this.stateTitle = this.getAttribute('state-title',
    '$:/state/json-convert/editor/picker')
  this.snapshotTitle = this.getAttribute('snapshot-title',
    '$:/state/json-convert/editor/picker-open-snapshot')
}

JsonConvertPickerInitWidget.prototype.refresh = function() {
  return false
}

JsonConvertPickerInitWidget.prototype.invokeAction = function() {
  if (!this.draftBase) return true
  const leafPaths = enumerateLeafPaths(this.wiki, this.sourceTitle, this.recordsPath)
  const twFields = readGroup(this.wiki, this.draftBase, 'tw-fields')
  const customFields = readGroup(this.wiki, this.draftBase, 'custom-fields')
  const state = initialPickerState({ leafPaths, twFields, customFields })
  writeJsonState(this.wiki, this.stateTitle, state)
  writeJsonState(this.wiki, this.snapshotTitle, state)
  return true
}

exports['json-convert-picker-init'] = JsonConvertPickerInitWidget
