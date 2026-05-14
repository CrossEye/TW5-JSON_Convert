const Widget = require('$:/core/modules/widgets/widget.js').widget

function JsonConvertFocusElementWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertFocusElementWidget.prototype = Object.create(Widget.prototype)

JsonConvertFocusElementWidget.prototype.render = function(parent, nextSibling) {
  this.computeAttributes()
  this.execute()
}

JsonConvertFocusElementWidget.prototype.execute = function() {
  this.elementId = this.getAttribute('id', '')
}

JsonConvertFocusElementWidget.prototype.refresh = function() {
  return false
}

JsonConvertFocusElementWidget.prototype.invokeAction = function() {
  if (!this.elementId) return true
  const el = this.document.getElementById(this.elementId)
  if (el) {
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    if (typeof el.focus === 'function') {
      el.focus()
    }
  }
  return true
}

exports['json-convert-focus-element'] = JsonConvertFocusElementWidget
