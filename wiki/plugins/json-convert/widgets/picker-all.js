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

function JsonConvertPickerAllWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertPickerAllWidget.prototype = Object.create(Widget.prototype)

JsonConvertPickerAllWidget.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent
  this.computeAttributes()
  this.execute()

  const leafPaths = enumerateLeafPaths(this.wiki, this.sourceTitle, this.recordsPath)
  const state = readJsonState(this.wiki, this.stateTitle)
  const ticked = leafPaths.filter((p) =>
    Object.prototype.hasOwnProperty.call(state, p)).length
  const total = leafPaths.length

  const wrap = this.document.createElement('label')
  wrap.className = 'jc-picker-all'

  const label = this.document.createElement('span')
  label.className = 'jc-picker-all-label'
  label.textContent = 'All'
  wrap.appendChild(label)

  const checkbox = this.document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.className = 'jc-picker-all-check'
  if (total === 0) {
    checkbox.disabled = true
    checkbox.checked = false
    checkbox.title = 'No tickable leaves in this source.'
  } else if (ticked === total) {
    checkbox.checked = true
    checkbox.indeterminate = false
    checkbox.title = `All ${total} fields ticked — uncheck to clear`
  } else if (ticked === 0) {
    checkbox.checked = false
    checkbox.indeterminate = false
    checkbox.title = `Tick to select all ${total} fields`
  } else {
    checkbox.checked = false
    checkbox.indeterminate = true
    checkbox.title = `${ticked} of ${total} ticked — click to select all`
  }

  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      const twFields = readGroup(this.wiki, this.draftBase, 'tw-fields')
      const customFields = readGroup(this.wiki, this.draftBase, 'custom-fields')
      const cur = readJsonState(this.wiki, this.stateTitle)
      writeJsonState(this.wiki, this.stateTitle, selectAllPickerState({
        leafPaths, twFields, customFields, currentState: cur, flattenPath
      }))
    } else {
      writeJsonState(this.wiki, this.stateTitle, {})
    }
  })

  wrap.appendChild(checkbox)
  parent.insertBefore(wrap, nextSibling)
  this.domNodes.push(wrap)
}

JsonConvertPickerAllWidget.prototype.execute = function() {
  this.sourceTitle = this.getAttribute('source-title', '')
  this.recordsPath = this.getAttribute('records-path', '')
  this.draftBase = this.getAttribute('draft-base', '')
  this.stateTitle = this.getAttribute('state-title',
    '$:/state/json-convert/editor/picker')
}

JsonConvertPickerAllWidget.prototype.refresh = function(changedTiddlers) {
  const changedAttributes = this.computeAttributes()
  if (changedAttributes['source-title'] ||
      changedAttributes['records-path'] ||
      changedAttributes['draft-base'] ||
      changedAttributes['state-title'] ||
      (this.sourceTitle && changedTiddlers[this.sourceTitle]) ||
      (this.stateTitle && changedTiddlers[this.stateTitle])) {
    this.refreshSelf()
    return true
  }
  return false
}

exports['json-convert-picker-all'] = JsonConvertPickerAllWidget
