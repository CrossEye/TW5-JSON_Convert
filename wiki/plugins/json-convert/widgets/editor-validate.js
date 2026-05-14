const Widget = require('$:/core/modules/widgets/widget.js').widget
const { validateProfile } = require(
  '$:/plugins/crosseye/json-convert/engine/validate.js'
)
const { clearByPrefix, collectUserTransforms } = require('./util.js')

const computeErrors = (wiki, profileTitle) => {
  if (!profileTitle) return []
  const text = wiki.getTiddlerText(profileTitle) || ''
  let profile
  try {
    profile = JSON.parse(text)
  } catch (e) {
    return [{
      code: 'profile-not-json',
      message: `Profile body is not valid JSON: ${e.message}`
    }]
  }
  return validateProfile(profile, collectUserTransforms(wiki))
}

const RECORDS_CODES = new Set([
  'missing-records', 'bad-records-path'
])

const domIdForError = (err) => {
  if (err.location) return `jc-${err.location}`
  if (RECORDS_CODES.has(err.code)) return 'jc-records'
  return ''
}

const writeErrors = (wiki, outputTitle, errors) => {
  const itemPrefix = `${outputTitle}/items/`
  clearByPrefix(wiki, itemPrefix)
  wiki.addTiddler({
    title: outputTitle,
    type: 'application/json',
    text: JSON.stringify(errors)
  })
  wiki.addTiddler({
    title: `${outputTitle}/count`,
    text: String(errors.length)
  })
  errors.forEach((err, i) => {
    wiki.addTiddler({
      title: `${itemPrefix}${i}`,
      code: err.code || '',
      message: err.message || '',
      location: err.location || '',
      'dom-id': domIdForError(err),
      'jc-idx': String(i).padStart(4, '0')
    })
  })
}

function JsonConvertValidateWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertValidateWidget.prototype = Object.create(Widget.prototype)

JsonConvertValidateWidget.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent
  this.computeAttributes()
  this.execute()
  this.runValidation()
  const placeholder = this.document.createTextNode('')
  parent.insertBefore(placeholder, nextSibling)
  this.domNodes.push(placeholder)
}

JsonConvertValidateWidget.prototype.execute = function() {
  this.profileTitle = this.getAttribute('profile-title', '')
  this.outputTitle = this.getAttribute(
    'output',
    '$:/state/json-convert/editor/errors'
  )
}

const aTransformChanged = (wiki, changedTiddlers) => {
  for (const title of Object.keys(changedTiddlers)) {
    const t = wiki.getTiddler(title)
    const tags = t && t.fields.tags
    if (Array.isArray(tags) && tags.includes('$:/tags/json-convert/transform')) {
      return true
    }
  }
  return false
}

JsonConvertValidateWidget.prototype.refresh = function(changedTiddlers) {
  const changed = this.computeAttributes()
  if (changed['profile-title'] || changed.output ||
      (this.profileTitle && changedTiddlers[this.profileTitle]) ||
      aTransformChanged(this.wiki, changedTiddlers)) {
    this.runValidation()
  }
  return false
}

JsonConvertValidateWidget.prototype.runValidation = function() {
  const errors = computeErrors(this.wiki, this.profileTitle)
  writeErrors(this.wiki, this.outputTitle, errors)
}

exports['json-convert-editor-validate'] = JsonConvertValidateWidget
