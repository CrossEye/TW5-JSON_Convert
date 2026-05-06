const Widget = require('$:/core/modules/widgets/widget.js').widget
const { convert } = require(
  '$:/plugins/crosseye/json-convert/engine/convert.js'
)
const { clearByPrefix } = require('./util.js')

const DEFAULT_STATE_BASE  = '$:/state/json-convert'
const DEFAULT_STAGED_BASE = '$:/temp/json-convert/staged'

const setJson = (wiki, title, value) => wiki.addTiddler({
  title,
  type: 'application/json',
  text: JSON.stringify(value)
})

const loadProfile = (wiki, profileTitle) => {
  if (!profileTitle) {
    return {
      error: {
        code: 'no-profile-selected',
        message: 'No mapping profile selected'
      }
    }
  }
  const text = wiki.getTiddlerText(profileTitle) || ''
  try {
    return { profile: JSON.parse(text) }
  } catch (e) {
    return {
      error: {
        code: 'profile-not-json',
        message:
          `Profile "${profileTitle}" is not valid JSON: ${e.message}`
      }
    }
  }
}

const writeStaged = (wiki, stagedPrefix, tiddlers, collisions) =>
  tiddlers.forEach((t, i) => {
    const fields = {
      ...t,
      title: `${stagedPrefix}${i}`,
      '_target-title': t.title
    }
    if (collisions.has(t.title)) fields._collision = 'yes'
    wiki.addTiddler(fields)
  })

const writeDecisions = (wiki, decisionsPrefix, tiddlers, collisions) =>
  tiddlers.forEach((t, i) => {
    const action = collisions.has(t.title) ? 'skip' : 'overwrite'
    wiki.addTiddler({ title: `${decisionsPrefix}${i}`, text: action })
  })

const writeResults = (wiki, stateBase, result) => {
  setJson(wiki, `${stateBase}/result/errors`, result.errors)
  setJson(wiki, `${stateBase}/result/warnings`, result.warnings)
  setJson(wiki, `${stateBase}/result/collisions`, [...result.collisions])
}

const runConversion = (wiki, stateBase, stagedBase) => {
  const stagedPrefix    = `${stagedBase}/`
  const decisionsPrefix = `${stateBase}/decisions/`
  clearByPrefix(wiki, stagedPrefix)
  clearByPrefix(wiki, decisionsPrefix)

  const source = wiki.getTiddlerText(`${stateBase}/source`) || ''
  const profileTitle = wiki.getTiddlerText(`${stateBase}/profile`) || ''
  const loaded = loadProfile(wiki, profileTitle)

  const result = loaded.error
    ? {
        tiddlers: [],
        errors: [loaded.error],
        warnings: [],
        collisions: new Set()
      }
    : convert(source, loaded.profile, new Set(wiki.allTitles()))

  writeStaged(wiki, stagedPrefix, result.tiddlers, result.collisions)
  writeDecisions(wiki, decisionsPrefix, result.tiddlers, result.collisions)
  writeResults(wiki, stateBase, result)
}

const JsonConvertRunWidget = function(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertRunWidget.prototype = Object.create(Widget.prototype)

JsonConvertRunWidget.prototype.render = function(parent, nextSibling) {
  this.computeAttributes()
  this.execute()
}

JsonConvertRunWidget.prototype.execute = function() {
  this.stateBase = this.getAttribute('state-base', DEFAULT_STATE_BASE)
  this.stagedBase = this.getAttribute('staged-base', DEFAULT_STAGED_BASE)
}

JsonConvertRunWidget.prototype.refresh = function(changedAttributes) {
  const changed = this.computeAttributes()
  if (changed['state-base'] || changed['staged-base']) {
    this.refreshSelf()
    return true
  }
  return false
}

JsonConvertRunWidget.prototype.invokeAction = function() {
  runConversion(this.wiki, this.stateBase, this.stagedBase)
  return true
}

exports['json-convert-run'] = JsonConvertRunWidget
