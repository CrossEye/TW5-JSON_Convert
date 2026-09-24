const Widget = require('$:/core/modules/widgets/widget.js').widget
const { classifyDrop, droppedTiddlerFields } = require(
  '$:/plugins/crosseye/json-convert/engine/drop.js'
)

const writeText = (wiki, title, text) => {
  const existing = wiki.getTiddler(title)
  const fields = existing ? { ...existing.fields } : {}
  fields.title = title
  fields.text = text
  wiki.addTiddler(fields)
}

const hasTiddler = (e) => {
  if (!e.dataTransfer) return false
  const types = e.dataTransfer.types
  if (!types) return false
  for (let i = 0; i < types.length; i++) {
    if (types[i] === 'text/vnd.tiddler' || types[i] === 'URL') return true
  }
  return false
}

const hasFile = (e) => {
  if (!e.dataTransfer) return false
  const types = e.dataTransfer.types
  if (!types) return false
  for (let i = 0; i < types.length; i++) {
    if (types[i] === 'Files') return true
  }
  return false
}

function JsonConvertDropFileWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertDropFileWidget.prototype = Object.create(Widget.prototype)

JsonConvertDropFileWidget.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent
  this.computeAttributes()
  this.execute()

  const wrapper = this.document.createElement('div')
  wrapper.className = this.wrapperClass

  this.renderChildren(wrapper, null)

  let depth = 0
  const setActive = (on) => {
    if (on) wrapper.classList.add('jc-dropzone-active')
    else wrapper.classList.remove('jc-dropzone-active')
  }

  // Capturing-phase listeners so we run before any descendant default
  // and before TW's body-level import handler can see the event.
  wrapper.addEventListener('dragenter', (e) => {
    if (!hasFile(e) && !hasTiddler(e)) return
    e.preventDefault()
    e.stopPropagation()
    depth++
    setActive(true)
  }, true)

  wrapper.addEventListener('dragover', (e) => {
    if (!hasFile(e) && !hasTiddler(e)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, true)

  wrapper.addEventListener('dragleave', (e) => {
    if (!hasFile(e) && !hasTiddler(e)) return
    e.preventDefault()
    e.stopPropagation()
    depth--
    if (depth <= 0) {
      depth = 0
      setActive(false)
    }
  }, true)

  wrapper.addEventListener('drop', (e) => {
    if (!hasFile(e) && !hasTiddler(e)) return
    e.preventDefault()
    e.stopPropagation()
    depth = 0
    setActive(false)

    if (!hasFile(e)) {
      this.handleTiddlerDrop(droppedTiddlerFields(e.dataTransfer))
      return
    }
    this.setNote('')

    const file = e.dataTransfer.files && e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      writeText(this.wiki, this.targetTitle, String(reader.result || ''))
      if (this.actions) {
        this.invokeActionString(this.actions, this, null, {})
      }
    }
    reader.onerror = () => {
      console.error('[jc-drop-file] read failed:', reader.error)
    }
    reader.readAsText(file)
  }, true)

  parent.insertBefore(wrapper, nextSibling)
  this.domNodes.push(wrapper)
}

// A dropped tiddler never becomes text in the box: a profile selects
// itself, anything else loads its text as the source.
JsonConvertDropFileWidget.prototype.handleTiddlerDrop = function(fields) {
  const title = fields && fields.title
  const exists = !!(title && this.wiki.tiddlerExists(title))
  const outcome = classifyDrop(fields, exists)
  if (outcome.action === 'select-profile' && this.profileTitle) {
    writeText(this.wiki, this.profileTitle, outcome.title)
    this.setNote(`Selected profile "${outcome.title}".`)
    return
  }
  if (outcome.action === 'load-source') {
    writeText(this.wiki, this.targetTitle, outcome.text)
    this.setNote(`Loaded source JSON from "${outcome.title}".`)
    if (this.actions) this.invokeActionString(this.actions, this, null, {})
    return
  }
  if (outcome.action === 'note') this.setNote(outcome.note)
}

JsonConvertDropFileWidget.prototype.setNote = function(note) {
  if (!this.noteTitle) return
  if (note) writeText(this.wiki, this.noteTitle, note)
  else this.wiki.deleteTiddler(this.noteTitle)
}

JsonConvertDropFileWidget.prototype.execute = function() {
  this.targetTitle = this.getAttribute('target-title', '')
  this.profileTitle = this.getAttribute('profile-title', '')
  this.noteTitle = this.getAttribute('note-title', '')
  this.wrapperClass = this.getAttribute('class', 'jc-dropzone')
  this.actions = this.getAttribute('actions', '')
  this.makeChildWidgets()
}

JsonConvertDropFileWidget.prototype.refresh = function(changedTiddlers) {
  const changed = this.computeAttributes()
  if (changed['target-title'] || changed.class || changed.actions ||
      changed['profile-title'] || changed['note-title']) {
    this.refreshSelf()
    return true
  }
  return this.refreshChildren(changedTiddlers)
}

exports['json-convert-drop-file'] = JsonConvertDropFileWidget
