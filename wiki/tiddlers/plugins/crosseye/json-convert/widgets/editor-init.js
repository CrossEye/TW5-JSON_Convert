const Widget = require('$:/core/modules/widgets/widget.js').widget
const { clearByPrefix } = require('./util.js')

const TW_FIELD_SEED = ['title', 'text', 'tags', 'type', 'caption']

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const readBinding = (binding) => {
  if (typeof binding === 'string') {
    return { value: binding, transform: '' }
  }
  if (isPlainObject(binding)) {
    return {
      value: typeof binding.value === 'string' ? binding.value : '',
      transform:
        typeof binding.transform === 'string' ? binding.transform : ''
    }
  }
  return { value: '', transform: '' }
}

const writeRow = (wiki, prefix, name, binding) => {
  const { value, transform } = readBinding(binding)
  wiki.addTiddler({
    title: `${prefix}${name}`,
    value,
    transform
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

const initDrafts = (wiki, profileTitle, draftBase) => {
  clearByPrefix(wiki, draftBase)
  wiki.deleteTiddler('$:/state/json-convert/editor/active-target')

  const text = wiki.getTiddlerText(profileTitle) || ''
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
