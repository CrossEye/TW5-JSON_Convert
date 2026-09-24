const Widget = require('$:/core/modules/widgets/widget.js').widget
const { setNormalizeEnabled } = require(
  '$:/plugins/crosseye/json-convert/engine/profile-format.js'
)

// Action widget: turn the auto-pivot normalize step on or off in a
// saved profile.  The console's flatten toggle uses this; the editor
// writes its draft instead and lets editor-write serialize.
//
//   <$json-convert-normalize-set profile-title=<<t>> enabled="yes"/>

function JsonConvertNormalizeSetWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertNormalizeSetWidget.prototype = Object.create(Widget.prototype)

JsonConvertNormalizeSetWidget.prototype.render = function() {
  this.computeAttributes()
  this.execute()
}

JsonConvertNormalizeSetWidget.prototype.execute = function() {
  this.profileTitle = this.getAttribute('profile-title', '')
  this.enabled = this.getAttribute('enabled', 'yes') === 'yes'
}

JsonConvertNormalizeSetWidget.prototype.refresh = function() {
  return false
}

JsonConvertNormalizeSetWidget.prototype.invokeAction = function() {
  if (!this.profileTitle) return true
  const tiddler = this.wiki.getTiddler(this.profileTitle)
  if (!tiddler) return true
  const text = setNormalizeEnabled(tiddler.fields.text || '', this.enabled)
  if (text === null) return true // malformed or already in that state
  this.wiki.addTiddler({ ...tiddler.fields, text })
  return true
}

exports['json-convert-normalize-set'] = JsonConvertNormalizeSetWidget
