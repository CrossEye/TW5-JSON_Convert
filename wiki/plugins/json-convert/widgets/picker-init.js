const Widget = require('$:/core/modules/widgets/widget.js').widget
const { initialPickerState } = require('$:/plugins/crosseye/json-convert/engine/picker.js')
const { enumerateLeafPaths } = require('./util.js')

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
  this.normalizeSpec = this.getAttribute('normalize', '')
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
  const leafPaths = enumerateLeafPaths(
    this.wiki, this.sourceTitle, this.recordsPath, this.normalizeSpec
  )
  const customFields = readGroup(this.wiki, this.draftBase, 'custom-fields')
  const state = initialPickerState({ leafPaths, customFields })
  writeJsonState(this.wiki, this.stateTitle, state)
  writeJsonState(this.wiki, this.snapshotTitle, state)
  return true
}

exports['json-convert-picker-init'] = JsonConvertPickerInitWidget
