const Widget = require('$:/core/modules/widgets/widget.js').widget

const writeText = (wiki, title, text) => {
  const existing = wiki.getTiddler(title)
  const fields = existing ? { ...existing.fields } : {}
  fields.title = title
  fields.text = text
  wiki.addTiddler(fields)
}

function JsonConvertBrowseFileWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertBrowseFileWidget.prototype = Object.create(Widget.prototype)

JsonConvertBrowseFileWidget.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent
  this.computeAttributes()
  this.execute()

  const input = this.document.createElement('input')
  input.type = 'file'
  input.accept = this.accept
  if (this.inputClass) input.className = this.inputClass

  input.addEventListener('change', () => {
    const file = input.files && input.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      writeText(this.wiki, this.targetTitle, String(reader.result || ''))
      if (this.actions) {
        this.invokeActionString(this.actions, this, null, {})
      }
      input.value = '' // allow reselecting the same file
    }
    reader.onerror = () => {
      console.error('[jc-browse-file] read failed:', reader.error)
    }
    reader.readAsText(file)
  })

  parent.insertBefore(input, nextSibling)
  this.domNodes.push(input)
}

JsonConvertBrowseFileWidget.prototype.execute = function() {
  this.targetTitle = this.getAttribute('target-title', '')
  this.accept = this.getAttribute('accept', '.json,application/json,.txt,text/plain')
  this.inputClass = this.getAttribute('class', '')
  this.actions = this.getAttribute('actions', '')
}

JsonConvertBrowseFileWidget.prototype.refresh = function(changedTiddlers) {
  const changed = this.computeAttributes()
  if (changed['target-title'] || changed.accept ||
      changed.class || changed.actions) {
    this.refreshSelf()
    return true
  }
  return false
}

exports['json-convert-browse-file'] = JsonConvertBrowseFileWidget
