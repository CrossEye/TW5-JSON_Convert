const Widget = require('$:/core/modules/widgets/widget.js').widget
const { convert, expandRecords } = require(
  '$:/plugins/crosseye/json-convert/engine/convert.js'
)
const { prepareSource } = require(
  '$:/plugins/crosseye/json-convert/engine/prepare.js'
)
const { mergeRecordShapes } = require(
  '$:/plugins/crosseye/json-convert/engine/shape.js'
)
const {
  serializeShape, compareShapes, isMismatch, topLevelFields
} = require('$:/plugins/crosseye/json-convert/engine/shape-diff.js')
const {
  clearByPrefix, collectUserTransforms, explainTransformErrors
} = require('./util.js')

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
        message: 'No profile selected'
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

const COLLISION_DEFAULTS = new Set(['skip', 'overwrite'])

const writeDecisions =
  (wiki, decisionsPrefix, tiddlers, collisions, collisionDefault) =>
  tiddlers.forEach((t, i) => {
    const action = collisions.has(t.title) ? collisionDefault : 'add'
    wiki.addTiddler({ title: `${decisionsPrefix}${i}`, text: action })
  })

// Compare the shape of the records actually found with the shape the
// pack was built against (its `shape` tiddler), so the panel can say
// which fields the importer expected and did not see.  Written only
// when the source parsed and a fingerprint is available.
const writeShapeCheck = (wiki, stateBase, shapeTitle, source, profile) => {
  const title = `${stateBase}/result/shape`
  wiki.deleteTiddler(title)
  if (!shapeTitle || !profile) return
  let expected
  try {
    expected = JSON.parse(wiki.getTiddlerText(shapeTitle) || '')
  } catch (_) {
    return
  }
  if (!expected || !expected.shape) return
  const prepared = prepareSource(source, profile.normalize)
  if (prepared.errors.length) return
  const expanded = expandRecords(prepared.value, profile.records)
  const records = expanded.records
    ? expanded.records.map((r) => r.record)
    : []
  const actual = records.length
    ? serializeShape(mergeRecordShapes(records))
    : null
  const diff = actual
    ? compareShapes(expected.shape, actual)
    : { missing: [], added: [], changed: [] }
  setJson(wiki, title, {
    expected: {
      records: expected.records,
      count: expected.count,
      fields: topLevelFields(expected.shape)
    },
    actual: { count: records.length, fields: topLevelFields(actual) },
    ...diff,
    mismatch: isMismatch(diff)
  })
}

const writeResults = (wiki, stateBase, result) => {
  setJson(wiki, `${stateBase}/result/errors`, result.errors)
  setJson(wiki, `${stateBase}/result/warnings`, result.warnings)
  setJson(wiki, `${stateBase}/result/collisions`, [...result.collisions])
}

// `sourceTitle` names the tiddler holding the JSON text; `profileTitle`
// names the profile itself.  Both default to conventional tiddlers under
// the state base, the latter indirectly: `<state-base>/profile` holds the
// title of the selected profile, which is how a picker-driven panel
// works.  A panel with a fixed profile passes it directly.
const runConversion = (
  wiki, stateBase, stagedBase, sourceTitle, profile, collisionDefault,
  shapeTitle
) => {
  const stagedPrefix    = `${stagedBase}/`
  const decisionsPrefix = `${stateBase}/decisions/`
  clearByPrefix(wiki, stagedPrefix)
  clearByPrefix(wiki, decisionsPrefix)

  const source = wiki.getTiddlerText(sourceTitle) || ''
  const profileTitle =
    profile || wiki.getTiddlerText(`${stateBase}/profile`) || ''
  const loaded = loadProfile(wiki, profileTitle)

  const userTransforms = collectUserTransforms(wiki)
  const result = loaded.error
    ? {
        tiddlers: [],
        errors: [loaded.error],
        warnings: [],
        collisions: new Set()
      }
    : convert(
        source,
        loaded.profile,
        new Set(wiki.allTitles()),
        { transforms: userTransforms }
      )

  result.errors = explainTransformErrors(wiki, result.errors)
  writeShapeCheck(wiki, stateBase, shapeTitle, source, loaded.profile)
  writeStaged(wiki, stagedPrefix, result.tiddlers, result.collisions)
  writeDecisions(
    wiki, decisionsPrefix, result.tiddlers, result.collisions,
    collisionDefault
  )
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
  this.sourceTitle =
    this.getAttribute('source-title', `${this.stateBase}/source`)
  this.profile = this.getAttribute('profile', '')
  const collisionDefault = this.getAttribute('collision-default', 'skip')
  this.collisionDefault =
    COLLISION_DEFAULTS.has(collisionDefault) ? collisionDefault : 'skip'
  this.shapeTitle = this.getAttribute('shape-title', '')
}

JsonConvertRunWidget.prototype.refresh = function(changedAttributes) {
  const changed = this.computeAttributes()
  if (changed['state-base'] || changed['staged-base'] ||
      changed['source-title'] || changed['profile'] ||
      changed['collision-default'] || changed['shape-title']) {
    this.refreshSelf()
    return true
  }
  return false
}

JsonConvertRunWidget.prototype.invokeAction = function() {
  runConversion(
    this.wiki, this.stateBase, this.stagedBase, this.sourceTitle,
    this.profile, this.collisionDefault, this.shapeTitle
  )
  return true
}

exports['json-convert-run'] = JsonConvertRunWidget
