const Widget = require('$:/core/modules/widgets/widget.js').widget
const { clearByPrefix } = require('./util.js')

const TW_FIELD_SEED = ['title', 'tags', 'caption', 'text']

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const writeRow = (wiki, prefix, name, binding) => {
  const value = typeof binding === 'string' ? binding : ''
  wiki.addTiddler({
    title: `${prefix}${name}`,
    value
  })
}

const orderedNames = (group, profileMap) => {
  const profileKeys = Object.keys(profileMap)
  if (group !== 'tw-fields') return profileKeys
  const seedSet = new Set(TW_FIELD_SEED)
  const extras = profileKeys.filter((k) => !seedSet.has(k))
  return [...TW_FIELD_SEED, ...extras]
}

const writeFieldGroup = (wiki, draftBase, group, profileMap) => {
  const prefix = `${draftBase}${group}/`
  const obj = isPlainObject(profileMap) ? profileMap : {}
  const names = orderedNames(group, obj)
  for (const name of names) writeRow(wiki, prefix, name, obj[name])
  wiki.addTiddler({
    title: `${draftBase}${group}-keys`,
    list: $tw.utils.stringifyList(names)
  })
}

const BACKUP_TITLE = '$:/temp/json-convert/editor/backup'

const initDrafts = (wiki, profileTitle, draftBase) => {
  clearByPrefix(wiki, draftBase)
  wiki.deleteTiddler('$:/state/json-convert/editor/active-target')

  const text = wiki.getTiddlerText(profileTitle) || ''

  // Snapshot the on-disk profile so the user can revert their edits
  // back to the state the editor opened with.  $:/temp space — not
  // persisted across reload.
  wiki.addTiddler({
    title: BACKUP_TITLE,
    'for-title': profileTitle,
    text
  })

  let profile = {}
  try { profile = JSON.parse(text) } catch { profile = {} }
  if (!isPlainObject(profile)) profile = {}

  const iteration =
    typeof profile.iteration === 'string' ? profile.iteration : ''

  wiki.addTiddler({
    title: `${draftBase}iteration`,
    text: iteration
  })

  // Snapshot iteration for the confirm-on-change guard.
  const stateBase = draftBase.replace(/\/draft\/$/, '')
  wiki.addTiddler({
    title: `${stateBase}/iteration-original`,
    text: iteration
  })

  writeFieldGroup(wiki, draftBase, 'tw-fields', profile['tw-fields'])
  writeFieldGroup(wiki, draftBase, 'custom-fields', profile['custom-fields'])
}

function JsonConvertEditorInitWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertEditorInitWidget.prototype = Object.create(Widget.prototype)

JsonConvertEditorInitWidget.prototype.render = function(parent, nextSibling) {
  this.computeAttributes()
  this.execute()
}

JsonConvertEditorInitWidget.prototype.execute = function() {
  this.profileTitle = this.getAttribute('profile-title', '')
  this.draftBase = this.getAttribute('draft-base', '')
}

JsonConvertEditorInitWidget.prototype.refresh = function() {
  return false
}

JsonConvertEditorInitWidget.prototype.invokeAction = function() {
  if (this.profileTitle && this.draftBase) {
    initDrafts(this.wiki, this.profileTitle, this.draftBase)
  }
  return true
}

exports['json-convert-editor-init'] = JsonConvertEditorInitWidget
