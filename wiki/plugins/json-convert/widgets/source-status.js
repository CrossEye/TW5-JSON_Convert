const Widget = require('$:/core/modules/widgets/widget.js').widget
const { parse } = require(
  '$:/plugins/crosseye/json-convert/engine/parser.js'
)

// Live verdict on the source JSON, rendered under the source box.
// Without it a malformed paste is indistinguishable from a successful
// run that produced nothing: Convert reports `parse-failed` into a
// collapsed panel and the staging area simply stays empty.
//
//   <$json-convert-source-status source-title=<<t>> note-title=<<n>>/>

const MAX_EXCERPT = 120

// Keep the caret next to the offending column on a very long line.
const windowExcerpt = (excerpt, column) => {
  if (excerpt.length <= MAX_EXCERPT) return { text: excerpt, column }
  const start = Math.max(0, column - Math.floor(MAX_EXCERPT / 2))
  const text = (start > 0 ? '…' : '') +
    excerpt.slice(start, start + MAX_EXCERPT) +
    (start + MAX_EXCERPT < excerpt.length ? '…' : '')
  return { text, column: column - start + (start > 0 ? 1 : 0) }
}

const caretLine = (text, column) => {
  if (column === undefined) return null
  // Tabs in the excerpt would misalign a space-built caret.
  const prefix = text.slice(0, Math.max(0, column - 1))
    .replace(/[^\t]/g, ' ')
  return prefix + '^'
}

function JsonConvertSourceStatusWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertSourceStatusWidget.prototype = Object.create(Widget.prototype)

JsonConvertSourceStatusWidget.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent
  this.computeAttributes()
  this.execute()

  const root = this.document.createElement('div')
  root.className = 'jc-source-status'

  const note = this.noteTitle
    ? (this.wiki.getTiddlerText(this.noteTitle) || '').trim()
    : ''
  const text = this.wiki.getTiddlerText(this.sourceTitle) || ''

  if (note) root.appendChild(this.line('jc-source-note', note))

  if (text.trim()) {
    const result = parse(text)
    if (result.errors.length > 0) root.appendChild(this.errorBlock(result.errors[0]))
    else if (result.warnings.length > 0) {
      root.appendChild(this.line('jc-source-warn', result.warnings[0].message))
    } else {
      root.appendChild(this.line('jc-source-ok', 'Valid JSON.'))
    }
  }

  parent.insertBefore(root, nextSibling)
  this.domNodes.push(root)
}

JsonConvertSourceStatusWidget.prototype.line = function(cls, message) {
  const node = this.document.createElement('div')
  node.className = cls
  node.textContent = message
  return node
}

JsonConvertSourceStatusWidget.prototype.errorBlock = function(err) {
  const box = this.document.createElement('div')
  box.className = 'jc-source-err'

  const heading = this.document.createElement('div')
  heading.className = 'jc-source-err-heading'
  heading.textContent = err.message
  box.appendChild(heading)

  if (err.excerpt !== undefined && err.excerpt !== '') {
    const { text, column } = windowExcerpt(err.excerpt, err.column)
    const caret = caretLine(text, column)
    const pre = this.document.createElement('pre')
    pre.className = 'jc-source-err-excerpt'
    pre.textContent = caret === null ? text : `${text}\n${caret}`
    box.appendChild(pre)
  }

  const hint = this.document.createElement('div')
  hint.className = 'jc-source-err-hint'
  hint.textContent =
    'Nothing can be converted until this is fixed.  A stray character ' +
    'on the line above is the usual cause.'
  box.appendChild(hint)

  return box
}

JsonConvertSourceStatusWidget.prototype.execute = function() {
  this.sourceTitle = this.getAttribute('source-title', '')
  this.noteTitle = this.getAttribute('note-title', '')
}

JsonConvertSourceStatusWidget.prototype.refresh = function(changedTiddlers) {
  const changedAttributes = this.computeAttributes()
  if (changedAttributes['source-title'] ||
      changedAttributes['note-title'] ||
      (this.sourceTitle && changedTiddlers[this.sourceTitle]) ||
      (this.noteTitle && changedTiddlers[this.noteTitle])) {
    this.refreshSelf()
    return true
  }
  return false
}

exports['json-convert-source-status'] = JsonConvertSourceStatusWidget
