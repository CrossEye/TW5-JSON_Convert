const Widget = require('$:/core/modules/widgets/widget.js').widget
const { clearByPrefix } = require('./util.js')

const DEFAULT_STATE_BASE  = '$:/state/json-convert'
const DEFAULT_STAGED_BASE = '$:/temp/json-convert/staged'

const META_FIELDS = new Set(['title', '_target-title', '_collision'])

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

const applyOne = (wiki, stagedTitle, stagedPrefix, decisionsPrefix) => {
  const i = stagedTitle.slice(stagedPrefix.length)
  const decision = wiki.getTiddler(`${decisionsPrefix}${i}`)
  const action = decision?.fields.text || 'skip'
  if (action === 'skip') return

  const staged = wiki.getTiddler(stagedTitle)
  if (!staged) return

  const targetTitle = action === 'rename'
    ? (decision.fields['rename-title'] || '').trim()
    : staged.fields['_target-title']
  if (!targetTitle) return

  wiki.addTiddler({ ...stripMeta(staged.fields), title: targetTitle })
}

const applyAll = (wiki, stateBase, stagedBase) => {
  const stagedPrefix    = `${stagedBase}/`
  const decisionsPrefix = `${stateBase}/decisions/`
  stagedTitles(wiki, stagedPrefix).forEach((t) =>
    applyOne(wiki, t, stagedPrefix, decisionsPrefix))
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
}

JsonConvertApplyWidget.prototype.refresh = function() {
  const changed = this.computeAttributes()
  if (changed['state-base'] || changed['staged-base']) {
    this.refreshSelf()
    return true
  }
  return false
}

JsonConvertApplyWidget.prototype.invokeAction = function() {
  applyAll(this.wiki, this.stateBase, this.stagedBase)
  return true
}

exports['json-convert-apply'] = JsonConvertApplyWidget
