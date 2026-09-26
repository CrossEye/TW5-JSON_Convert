const Widget = require('$:/core/modules/widgets/widget.js').widget
const {
  slugify, clearByPrefix
} = require('$:/plugins/crosseye/json-convert/widgets/util.js')
const {
  packTitleFor, compareVersions, bumpPatch
} = require('$:/plugins/crosseye/json-convert-studio/pack/build.js')

const DEFAULT_FORM_BASE = '$:/state/json-convert/generator/'
const DEFAULT_OUTPUT_BASE = '$:/temp/json-convert/generator/'
const STUDIO_URL_CONFIG =
  '$:/plugins/crosseye/json-convert-studio/config/studio-url'
const USERNAME = '$:/status/UserName'
const VERSION_RE = /^\d+\.\d+\.\d+$/

const text = (wiki, t) => (wiki.getTiddlerText(t) || '').trim()

const defaultStudioUrl = (wiki) => {
  const protocol = text(wiki, '$:/info/url/protocol')
  const here = text(wiki, '$:/info/url/full')
  const canonical = text(wiki, STUDIO_URL_CONFIG)
  return protocol === 'file:' || !here ? canonical : here
}

const formWriter = (wiki, formBase) => {
  const set = (name, value) =>
    wiki.addTiddler({ title: `${formBase}${name}`, text: value })
  const setIfEmpty = (name, value) => {
    if (!text(wiki, `${formBase}${name}`)) set(name, value)
  }
  return { set, setIfEmpty }
}

// Prime the generator form for a profile.  Profile-derived fields are
// reset whenever the profile changes; the author's own details are
// filled only when empty, so they survive from one pack to the next.
const initForProfile = (wiki, profileTitle, formBase, outputBase) => {
  const { set, setIfEmpty } = formWriter(wiki, formBase)
  set('profile', profileTitle)

  const profile = wiki.getTiddler(profileTitle)
  const label = (profile && profile.fields.caption) || profileTitle
  if (text(wiki, `${formBase}for-profile`) !== profileTitle) {
    set('for-profile', profileTitle)
    set('name', `${label} Importer`)
    set('slug', `${slugify(label)}-importer`)
    set('caption', `Import ${label}`)
    set('description', `Imports ${label} JSON as tiddlers`)
    set('panel-description', '')
    set('sample', '')
    clearByPrefix(wiki, outputBase)
  }

  const user = text(wiki, USERNAME)
  const person = user && user !== 'Anonymous' ? user : ''
  setIfEmpty('author', person)
  setIfEmpty('publisher', slugify(person) || 'importers')
  setIfEmpty('convert-label', 'Convert')
  setIfEmpty('apply-label', 'Apply')
  setIfEmpty('collisions', 'skip')
  setIfEmpty('studio-url', defaultStudioUrl(wiki))

  // A pack already installed under the target title must be replaced
  // by a newer version, or the import upgrader will discard it.
  const installed = wiki.getTiddler(packTitleFor(
    text(wiki, `${formBase}publisher`), text(wiki, `${formBase}slug`)
  ))
  const current = text(wiki, `${formBase}version`)
  if (installed && installed.fields.version) {
    if (!current || compareVersions(current, installed.fields.version) <= 0) {
      set('version', bumpPatch(installed.fields.version))
    }
  } else {
    setIfEmpty('version', '0.1.0')
  }
}

// Prime the form to regenerate an installed pack: every field comes
// from the pack and its panel tiddler, the version is bumped, and the
// profile is the one it was made from if that still exists, otherwise
// the copy inside the pack.
const initForPack = (wiki, packTitle, formBase, outputBase) => {
  const pack = wiki.getTiddler(packTitle)
  if (!pack) return false
  const f = pack.fields
  const m = /^\$:\/plugins\/([^/]+)\/([^/]+)$/.exec(packTitle)
  const panel = wiki.getTiddler(`${packTitle}/importer`)
  const pf = panel ? panel.fields : {}
  const source = f['source-profile']
  const profile = source && wiki.getTiddler(source)
    ? source
    : `${packTitle}/profile`
  const version = VERSION_RE.test(f.version || '') ? f.version : '0.1.0'

  const { set } = formWriter(wiki, formBase)
  set('profile', profile)
  set('for-profile', profile)
  set('publisher', m ? m[1] : '')
  set('slug', f['json-convert-pack'] || (m ? m[2] : ''))
  set('name', f.name || '')
  set('description', f.description || '')
  set('author', f.author || '')
  set('version', bumpPatch(version))
  set('caption', pf.caption || '')
  set('panel-description', pf.description || '')
  set('convert-label', pf['convert-label'] || 'Convert')
  set('apply-label', pf['apply-label'] || 'Apply')
  set('collisions', pf.collisions || 'skip')
  set('sample', pf.sample || '')
  set('studio-url', pf['studio-url'] || f.source || defaultStudioUrl(wiki))
  clearByPrefix(wiki, outputBase)
  return true
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
  this.pack = this.getAttribute('pack', '')
  this.formBase = this.getAttribute('form-base', DEFAULT_FORM_BASE)
  this.outputBase = this.getAttribute('output-base', DEFAULT_OUTPUT_BASE)
}

JsonConvertGeneratorInitWidget.prototype.refresh = function() {
  const changed = this.computeAttributes()
  if (changed.profile || changed.pack || changed['form-base'] ||
      changed['output-base']) {
    this.refreshSelf()
    return true
  }
  return false
}

JsonConvertGeneratorInitWidget.prototype.invokeAction = function() {
  if (this.pack) {
    return initForPack(this.wiki, this.pack, this.formBase, this.outputBase)
  }
  if (!this.profile) return false
  initForProfile(this.wiki, this.profile, this.formBase, this.outputBase)
  return true
}

exports['json-convert-generator-init'] = JsonConvertGeneratorInitWidget
