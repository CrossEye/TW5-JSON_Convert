const Widget = require('$:/core/modules/widgets/widget.js').widget
const {
  transformName, TRANSFORM_TYPES
} = require('$:/plugins/crosseye/json-convert/widgets/util.js')
const {
  buildPack, packTitleFor, RUNTIME_TITLE, TRANSFORM_TAG
} = require('$:/plugins/crosseye/json-convert-studio/pack/build.js')

const DEFAULT_FORM_BASE = '$:/state/json-convert/generator/'
const DEFAULT_OUTPUT_BASE = '$:/temp/json-convert/generator/'

const FORM_FIELDS = {
  profile: 'profile',
  publisher: 'publisher',
  slug: 'slug',
  name: 'name',
  description: 'description',
  author: 'author',
  version: 'version',
  caption: 'caption',
  panelDescription: 'panel-description',
  convertLabel: 'convert-label',
  applyLabel: 'apply-label',
  collisions: 'collisions',
  sample: 'sample',
  studioUrl: 'studio-url'
}

const readForm = (wiki, base) => {
  const form = {}
  for (const [key, name] of Object.entries(FORM_FIELDS)) {
    form[key] = (wiki.getTiddlerText(`${base}${name}`) || '').trim()
  }
  return form
}

// Every tagged transform in the wiki, keyed by the name a profile
// would use.  Ones shipped inside the runtime are marked builtin so
// the pack never carries a second copy.
const collectTransforms = (wiki) => {
  const out = {}
  const titles = wiki.filterTiddlers(
    `[all[shadows+tiddlers]tag[${TRANSFORM_TAG}]]`
  )
  for (const title of titles) {
    const tiddler = wiki.getTiddler(title)
    if (!tiddler || !TRANSFORM_TYPES.has(tiddler.fields.type)) continue
    const name = transformName(tiddler, title)
    if (!name) continue
    out[name] = {
      title,
      fields: tiddler.getFieldStrings(),
      builtin: title.indexOf(`${RUNTIME_TITLE}/`) === 0
    }
  }
  return out
}

const gather = (wiki, form) => {
  const profileTiddler = wiki.getTiddler(form.profile)
  const profile = profileTiddler
    ? {
        title: form.profile,
        text: profileTiddler.fields.text || '',
        fields: profileTiddler.getFieldStrings()
      }
    : null
  const sample = form.sample && wiki.getTiddler(form.sample)
    ? { title: form.sample, text: wiki.getTiddlerText(form.sample) || '' }
    : null
  const rt = wiki.getTiddler(RUNTIME_TITLE)
  const runtime = {
    title: RUNTIME_TITLE,
    version: rt ? rt.fields.version : '',
    coreVersion: rt ? rt.fields['core-version'] : ''
  }
  const existing = wiki.getTiddler(packTitleFor(form.publisher, form.slug))
  const installed = existing ? existing.fields.version || null : null
  return {
    form,
    profile,
    transforms: collectTransforms(wiki),
    sample,
    runtime,
    installed,
    now: $tw.utils.stringifyDate(new Date())
  }
}

const writeJson = (wiki, title, value) => wiki.addTiddler({
  title,
  type: 'application/json',
  text: JSON.stringify(value)
})

const writeDownload = (wiki, title, tiddlers) => wiki.addTiddler({
  title,
  type: 'text/plain',
  text: JSON.stringify(tiddlers, null, 2) + '\n'
})

const generate = (wiki, formBase, outputBase) => {
  const form = readForm(wiki, formBase)
  const input = gather(wiki, form)
  const result = buildPack(input)
  const statusTitle = `${outputBase}status`

  if (result.errors.length) {
    wiki.deleteTiddler(`${outputBase}output/pack`)
    wiki.deleteTiddler(`${outputBase}output/bundle`)
    writeJson(wiki, statusTitle, { ok: false, errors: result.errors })
    return
  }

  // Installing the pack here is the preview and the drag source: the
  // tab appears in this wiki's sidebar, and the plugin tiddler can be
  // dragged to another wiki like any other.
  wiki.addTiddler(new $tw.Tiddler(result.pack))

  const packFields = result.pack
  const runtimeFields = wiki.getTiddler(RUNTIME_TITLE).getFieldStrings()
  writeDownload(wiki, `${outputBase}output/pack`, [packFields])
  writeDownload(wiki, `${outputBase}output/bundle`, [runtimeFields, packFields])
  writeJson(wiki, statusTitle, {
    ok: true,
    errors: [],
    title: packFields.title,
    version: packFields.version,
    caption: form.caption,
    slug: form.slug,
    panel: result.panelTitle,
    transforms: result.transforms,
    containsJs: result.containsJs,
    hasSample: result.hasSample,
    runtimeVersion: input.runtime.version
  })
}

const JsonConvertGenerateWidget = function(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertGenerateWidget.prototype = Object.create(Widget.prototype)

JsonConvertGenerateWidget.prototype.render = function(parent, nextSibling) {
  this.computeAttributes()
  this.execute()
}

JsonConvertGenerateWidget.prototype.execute = function() {
  this.formBase = this.getAttribute('form-base', DEFAULT_FORM_BASE)
  this.outputBase = this.getAttribute('output-base', DEFAULT_OUTPUT_BASE)
}

JsonConvertGenerateWidget.prototype.refresh = function() {
  const changed = this.computeAttributes()
  if (changed['form-base'] || changed['output-base']) {
    this.refreshSelf()
    return true
  }
  return false
}

JsonConvertGenerateWidget.prototype.invokeAction = function() {
  generate(this.wiki, this.formBase, this.outputBase)
  return true
}

exports['json-convert-generate'] = JsonConvertGenerateWidget
