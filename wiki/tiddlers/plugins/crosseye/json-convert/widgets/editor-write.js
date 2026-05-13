const Widget = require('$:/core/modules/widgets/widget.js').widget

const readGroup = (wiki, draftBase, group) => {
  const keysTiddler = wiki.getTiddler(`${draftBase}${group}-keys`)
  if (!keysTiddler) return {}
  const names = $tw.utils.parseStringArray(keysTiddler.fields.list || '')
  const out = {}
  for (const name of names) {
    const row = wiki.getTiddler(`${draftBase}${group}/${name}`)
    if (!row) continue
    const value = row.fields.value || ''
    if (!value.length) continue
    out[name] = value
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

// One binding per line, colons aligned within each group.
const formatGroupBody = (group) => {
  const entries = Object.entries(group || {})
  if (entries.length === 0) return ''
  const keys = entries.map(([k]) => JSON.stringify(k))
  const maxKeyLen = Math.max(...keys.map((k) => k.length))
  return entries.map(([k, v]) => {
    const key = JSON.stringify(k)
    const pad = ' '.repeat(maxKeyLen - key.length + 1)
    return `    ${key}:${pad}${JSON.stringify(v)}`
  }).join(',\n')
}

const formatGroup = (name, group) => {
  const body = formatGroupBody(group)
  if (!body) return `  ${JSON.stringify(name)}: {}`
  return `  ${JSON.stringify(name)}: {\n${body}\n  }`
}

const formatProfile = (profile) => {
  const parts = [`  "iteration": ${JSON.stringify(profile.iteration)}`]
  parts.push(formatGroup('tw-fields', profile['tw-fields']))
  if (profile['custom-fields'] !== undefined) {
    parts.push(formatGroup('custom-fields', profile['custom-fields']))
  }
  return `{\n${parts.join(',\n')}\n}`
}

const writeProfile = (wiki, profileTitle, draftBase) => {
  if (!profileTitle || !draftBase) return
  const profile = buildProfile(wiki, draftBase)
  const existing = wiki.getTiddler(profileTitle)
  const fields = existing ? { ...existing.fields } : { title: profileTitle }
  fields.title = profileTitle
  fields.type = fields.type || 'application/json'
  fields.tags = fields.tags || '$:/tags/json-convert/mapping'
  fields.text = formatProfile(profile)
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
