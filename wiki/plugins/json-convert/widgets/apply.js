const Widget = require('$:/core/modules/widgets/widget.js').widget
const { clearByPrefix } = require('./util.js')

const DEFAULT_STATE_BASE  = '$:/state/json-convert'
const DEFAULT_STAGED_BASE = '$:/temp/json-convert/staged'

const META_FIELDS = new Set(['title', '_target-title', '_collision', '_stamp'])
const CREATION_FIELDS = new Set(['created', 'creator'])

const stripMeta = (fields) => {
  const out = {}
  for (const k of Object.keys(fields)) {
    if (!META_FIELDS.has(k)) out[k] = fields[k]
  }
  return out
}

const stagedTitles = (wiki, prefix) => {
  const titles = []
  wiki.each((tiddler, title) => {
    if (title.indexOf(prefix) === 0) titles.push(title)
  })
  return titles
}

const recordImports = (wiki, auditTitle, importedTitles) => {
  if (importedTitles.length === 0) return
  const existing = wiki.getTiddler(auditTitle)
  const prior = existing
    ? $tw.utils.parseStringArray(existing.fields.list || '')
    : []
  const seen = new Set(prior)
  const next = [...prior]
  for (const t of importedTitles) {
    if (!seen.has(t)) { next.push(t); seen.add(t) }
  }
  wiki.addTiddler({
    title: auditTitle,
    list: $tw.utils.stringifyList(next)
  })
}

const applyOne = (wiki, stagedTitle, stagedPrefix, decisionsPrefix) => {
  const i = stagedTitle.slice(stagedPrefix.length)
  const decision = wiki.getTiddler(`${decisionsPrefix}${i}`)
  const action = decision?.fields.text || 'skip'
  if (action === 'skip') return null

  const staged = wiki.getTiddler(stagedTitle)
  if (!staged) return null

  const targetTitle = action === 'rename'
    ? (decision.fields['rename-title'] || '').trim()
    : staged.fields['_target-title']
  if (!targetTitle) return null

  const fields = stripMeta(staged.fields)
  const existing = wiki.getTiddler(targetTitle)

  // A merge never changes when or by whom a tiddler was created; only
  // a value the profile bound does, because then the author asked.
  if (existing) {
    for (const name of CREATION_FIELDS) {
      if (fields[name] === undefined && existing.fields[name] !== undefined) {
        fields[name] = existing.fields[name]
      }
    }
  }

  // Fill the fields the profile asked to have stamped, where it did
  // not bind them itself and the merge above did not keep them.
  const stamps = $tw.utils.parseStringArray(staged.fields._stamp || '')
  if (stamps.length) {
    const creation = wiki.getCreationFields()
    const modification = wiki.getModificationFields()
    for (const name of stamps) {
      if (fields[name] !== undefined) continue
      const source = CREATION_FIELDS.has(name) ? creation : modification
      if (source[name] !== undefined) fields[name] = source[name]
    }
  }

  wiki.addTiddler({ ...fields, title: targetTitle })
  return targetTitle
}

const applyAll = (wiki, stateBase, stagedBase, auditTitle) => {
  const stagedPrefix    = `${stagedBase}/`
  const decisionsPrefix = `${stateBase}/decisions/`
  const imported = stagedTitles(wiki, stagedPrefix)
    .map((t) => applyOne(wiki, t, stagedPrefix, decisionsPrefix))
    .filter((t) => t !== null)
  recordImports(wiki, auditTitle, imported)
  clearByPrefix(wiki, stagedPrefix)
  clearByPrefix(wiki, decisionsPrefix)
}

const JsonConvertApplyWidget = function(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertApplyWidget.prototype = Object.create(Widget.prototype)

JsonConvertApplyWidget.prototype.render = function(parent, nextSibling) {
  this.computeAttributes()
  this.execute()
}

JsonConvertApplyWidget.prototype.execute = function() {
  this.stateBase  = this.getAttribute('state-base',  DEFAULT_STATE_BASE)
  this.stagedBase = this.getAttribute('staged-base', DEFAULT_STAGED_BASE)
  this.auditTitle =
    this.getAttribute('audit-title', `${this.stateBase}/audit-log`)
}

JsonConvertApplyWidget.prototype.refresh = function() {
  const changed = this.computeAttributes()
  if (changed['state-base'] || changed['staged-base'] ||
      changed['audit-title']) {
    this.refreshSelf()
    return true
  }
  return false
}

JsonConvertApplyWidget.prototype.invokeAction = function() {
  applyAll(this.wiki, this.stateBase, this.stagedBase, this.auditTitle)
  return true
}

exports['json-convert-apply'] = JsonConvertApplyWidget
