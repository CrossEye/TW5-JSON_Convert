const Widget = require('$:/core/modules/widgets/widget.js').widget

const writeField = (wiki, title, field, value) => {
  const existing = wiki.getTiddler(title)
  const fields = existing ? { ...existing.fields } : {}
  fields.title = title
  fields[field] = value
  wiki.addTiddler(fields)
}

const captureCursor = (wiki, stateTitle, cursorStart, cursorEnd) => {
  const existing = wiki.getTiddler(stateTitle)
  const fields = existing ? { ...existing.fields } : {}
  fields.title = stateTitle
  if (typeof cursorStart === 'number') {
    fields['cursor-start'] = String(cursorStart)
  }
  if (typeof cursorEnd === 'number') {
    fields['cursor-end'] = String(cursorEnd)
  }
  wiki.addTiddler(fields)
}

function JsonConvertEditInputWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertEditInputWidget.prototype = Object.create(Widget.prototype)

JsonConvertEditInputWidget.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent
  this.computeAttributes()
  this.execute()

  const input = this.document.createElement('input')
  input.type = 'text'
  if (this.placeholder) input.setAttribute('placeholder', this.placeholder)
  if (this.inputClass) input.className = this.inputClass
  if (this.elementId) input.id = this.elementId

  const tiddler = this.boundTiddler ? this.wiki.getTiddler(this.boundTiddler) : null
  input.value = tiddler ? (tiddler.fields[this.boundField] || '') : ''

  input.addEventListener('input', () => {
    if (!this.boundTiddler) return
    writeField(this.wiki, this.boundTiddler, this.boundField, input.value)
    if (this.actions) {
      this.invokeActionString(this.actions, this, null, {})
    }
  })

  if (this.targetStateTitle) {
    input.addEventListener('blur', () => {
      captureCursor(
        this.wiki, this.targetStateTitle,
        input.selectionStart, input.selectionEnd
      )
    })
  }

  parent.insertBefore(input, nextSibling)
  this.domNodes.push(input)
  this.inputDom = input
}

JsonConvertEditInputWidget.prototype.execute = function() {
  this.boundTiddler = this.getAttribute('tiddler', '')
  this.boundField = this.getAttribute('field', 'text')
  this.placeholder = this.getAttribute('placeholder', '')
  this.inputClass = this.getAttribute('class', '')
  this.targetStateTitle = this.getAttribute('target-state-title', '')
  this.actions = this.getAttribute('actions', '')
  this.fillMode = this.getAttribute('fill-mode', 'insert')
  this.elementId = this.getAttribute('element-id', '')
}

JsonConvertEditInputWidget.prototype.refresh = function(changedTiddlers) {
  const changedAttributes = this.computeAttributes()
  if (changedAttributes.tiddler ||
      changedAttributes.field ||
      changedAttributes.placeholder ||
      changedAttributes.class ||
      changedAttributes['target-state-title'] ||
      changedAttributes.actions) {
    this.refreshSelf()
    return true
  }
  if (this.boundTiddler && changedTiddlers[this.boundTiddler] && this.inputDom) {
    const t = this.wiki.getTiddler(this.boundTiddler)
    const newValue = t ? (t.fields[this.boundField] || '') : ''
    if (this.inputDom.value !== newValue) {
      this.inputDom.value = newValue
    }
  }
  return false
}

exports['json-convert-edit-input'] = JsonConvertEditInputWidget
