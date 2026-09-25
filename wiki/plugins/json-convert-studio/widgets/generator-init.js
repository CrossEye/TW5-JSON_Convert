const Widget = require('$:/core/modules/widgets/widget.js').widget
const { slugify } = require('$:/plugins/crosseye/json-convert/widgets/util.js')
const {
  packTitleFor, compareVersions, bumpPatch
} = require('$:/plugins/crosseye/json-convert-studio/pack/build.js')
const { clearByPrefix } = require('$:/plugins/crosseye/json-convert/widgets/util.js')

const DEFAULT_FORM_BASE = '$:/state/json-convert/generator/'
const DEFAULT_OUTPUT_BASE = '$:/temp/json-convert/generator/'
const STUDIO_URL_CONFIG =
  '$:/plugins/crosseye/json-convert-studio/config/studio-url'
const USERNAME = '$:/status/UserName'

// Prime the generator form for a profile.  Profile-derived fields are
// reset whenever the profile changes; the author's own details are
// filled only when empty, so they survive from one pack to the next.
const initForm = (wiki, profileTitle, formBase, outputBase) => {
  const text = (t) => (wiki.getTiddlerText(t) || '').trim()
  const set = (name, value) =>
    wiki.addTiddler({ title: `${formBase}${name}`, text: value })
  const setIfEmpty = (name, value) => {
    if (!text(`${formBase}${name}`)) set(name, value)
  }

  set('profile', profileTitle)

  const profile = wiki.getTiddler(profileTitle)
  const label = (profile && profile.fields.caption) || profileTitle
  if (text(`${formBase}for-profile`) !== profileTitle) {
    set('for-profile', profileTitle)
    set('name', `${label} Importer`)
    set('slug', `${slugify(label)}-importer`)
    set('caption', `Import ${label}`)
    set('description', `Imports ${label} JSON as tiddlers`)
    set('panel-description', '')
    set('sample', '')
    clearByPrefix(wiki, outputBase)
  }

  const user = text(USERNAME)
  const person = user && user !== 'Anonymous' ? user : ''
  setIfEmpty('author', person)
  setIfEmpty('publisher', slugify(person) || 'importers')
  setIfEmpty('convert-label', 'Convert')
  setIfEmpty('apply-label', 'Apply')
  setIfEmpty('collisions', 'skip')

  const protocol = text('$:/info/url/protocol')
  const here = text('$:/info/url/full')
  const canonical = text(STUDIO_URL_CONFIG)
  setIfEmpty('studio-url', protocol === 'file:' || !here ? canonical : here)

  // A pack already installed under the target title must be replaced
  // by a newer version, or the import upgrader will discard it.
  const installed = wiki.getTiddler(
    packTitleFor(text(`${formBase}publisher`), text(`${formBase}slug`))
  )
  const current = text(`${formBase}version`)
  if (installed && installed.fields.version) {
    if (!current || compareVersions(current, installed.fields.version) <= 0) {
      set('version', bumpPatch(installed.fields.version))
    }
  } else {
    setIfEmpty('version', '0.1.0')
  }
}

const JsonConvertGeneratorInitWidget = function(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertGeneratorInitWidget.prototype = Object.create(Widget.prototype)

JsonConvertGeneratorInitWidget.prototype.render = function(parent, nextSibling) {
  this.computeAttributes()
  this.execute()
}

JsonConvertGeneratorInitWidget.prototype.execute = function() {
  this.profile = this.getAttribute('profile', '')
  this.formBase = this.getAttribute('form-base', DEFAULT_FORM_BASE)
  this.outputBase = this.getAttribute('output-base', DEFAULT_OUTPUT_BASE)
}

JsonConvertGeneratorInitWidget.prototype.refresh = function() {
  const changed = this.computeAttributes()
  if (changed.profile || changed['form-base'] || changed['output-base']) {
    this.refreshSelf()
    return true
  }
  return false
}

JsonConvertGeneratorInitWidget.prototype.invokeAction = function() {
  if (!this.profile) return false
  initForm(this.wiki, this.profile, this.formBase, this.outputBase)
  return true
}

exports['json-convert-generator-init'] = JsonConvertGeneratorInitWidget
