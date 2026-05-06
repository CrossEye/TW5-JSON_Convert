const Widget = require('$:/core/modules/widgets/widget.js').widget
const { clearByPrefix } = require('./util.js')

const DEFAULT_STATE_BASE  = '$:/state/json-convert'
const DEFAULT_STAGED_BASE = '$:/temp/json-convert/staged'

const cancelAll = (wiki, stateBase, stagedBase) => {
  clearByPrefix(wiki, `${stagedBase}/`)
  clearByPrefix(wiki, `${stateBase}/decisions/`)
}

const JsonConvertCancelWidget = function(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertCancelWidget.prototype = Object.create(Widget.prototype)

JsonConvertCancelWidget.prototype.render = function(parent, nextSibling) {
  this.computeAttributes()
  this.execute()
}

JsonConvertCancelWidget.prototype.execute = function() {
  this.stateBase  = this.getAttribute('state-base',  DEFAULT_STATE_BASE)
  this.stagedBase = this.getAttribute('staged-base', DEFAULT_STAGED_BASE)
}

JsonConvertCancelWidget.prototype.refresh = function() {
  const changed = this.computeAttributes()
  if (changed['state-base'] || changed['staged-base']) {
    this.refreshSelf()
    return true
  }
  return false
}

JsonConvertCancelWidget.prototype.invokeAction = function() {
  cancelAll(this.wiki, this.stateBase, this.stagedBase)
  return true
}

exports['json-convert-cancel'] = JsonConvertCancelWidget
