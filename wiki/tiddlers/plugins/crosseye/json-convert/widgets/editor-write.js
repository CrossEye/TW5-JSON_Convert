const Widget = require('$:/core/modules/widgets/widget.js').widget

const FORM_KEYS = new Set(['path', 'template', 'literal'])

const buildBinding = (rowFields) => {
  const form = FORM_KEYS.has(rowFields.form) ? rowFields.form : 'path'
  const binding = { [form]: rowFields.value || '' }
  if (rowFields.transform) binding.transform = rowFields.transform
  return binding
}

const readGroup = (wiki, draftBase, group) => {
  const keysTiddler = wiki.getTiddler(`${draftBase}${group}-keys`)
  if (!keysTiddler) return {}
  const names = $tw.utils.parseStringArray(keysTiddler.fields.list || '')
  const out = {}
  for (const name of names) {
    const row = wiki.getTiddler(`${draftBase}${group}/${name}`)
    if (!row) continue
    if (!(row.fields.value || '').length) continue
    out[name] = buildBinding(row.fields)
  }
  return out
}

const buildProfile = (wiki, draftBase) => {
  const iteration = wiki.getTiddlerText(`${draftBase}iteration`) || ''
  const twFields = readGroup(wiki, draftBase, 'tw-fields')
  const customFields = readGroup(wiki, draftBase, 'custom-fields')

  const profile = { iteration, 'tw-fields': twFields }
  if (Object.keys(customFields).length > 0) {
    profile['custom-fields'] = customFields
  }
  return profile
}

const writeProfile = (wiki, profileTitle, draftBase) => {
  if (!profileTitle || !draftBase) return
  const profile = buildProfile(wiki, draftBase)
  const existing = wiki.getTiddler(profileTitle)
  const fields = existing ? { ...existing.fields } : { title: profileTitle }
  fields.title = profileTitle
  fields.type = fields.type || 'application/json'
  fields.tags = fields.tags || '$:/tags/json-convert/mapping'
  fields.text = JSON.stringify(profile, null, 2)
  wiki.addTiddler(fields)
}

function JsonConvertEditorWriteWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertEditorWriteWidget.prototype = Object.create(Widget.prototype)

JsonConvertEditorWriteWidget.prototype.render = function(parent, nextSibling) {
  this.computeAttributes()
  this.execute()
}

JsonConvertEditorWriteWidget.prototype.execute = function() {
  this.profileTitle = this.getAttribute('profile-title', '')
  this.draftBase = this.getAttribute('draft-base', '')
}

JsonConvertEditorWriteWidget.prototype.refresh = function() {
  return false
}

JsonConvertEditorWriteWidget.prototype.invokeAction = function() {
  writeProfile(this.wiki, this.profileTitle, this.draftBase)
  return true
}

exports['json-convert-editor-write'] = JsonConvertEditorWriteWidget
