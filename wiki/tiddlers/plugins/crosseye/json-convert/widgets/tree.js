const Widget = require('$:/core/modules/widgets/widget.js').widget
const { parse } = require('$:/plugins/crosseye/json-convert/engine/parser.js')

const KEY_RE = /^[^.[\]]+$/

const buildPath = (segments) => {
  let path = ''
  for (const s of segments) {
    if (s.kind === 'index') path += `[${s.value}]`
    else path = path ? `${path}.${s.value}` : s.value
  }
  return path
}

const pathHasInvalidKey = (segments) =>
  segments.some((s) => s.kind === 'key' && !KEY_RE.test(s.value))

const previewLeaf = (v) => {
  if (v === null) return 'null'
  if (typeof v === 'string') {
    const trimmed = v.length > 60 ? `${v.slice(0, 60)}…` : v
    return JSON.stringify(trimmed)
  }
  return String(v)
}

const previewBranch = (v) =>
  Array.isArray(v) ? `Array(${v.length})` : `{${Object.keys(v).length}}`

const childEntries = (value) =>
  Array.isArray(value)
    ? value.map((v, i) => [`[${i}]`, v, { kind: 'index', value: i }])
    : Object.entries(value).map(([k, v]) => [k, v, { kind: 'key', value: k }])

function JsonConvertTreeWidget(parseTreeNode, options) {
  this.initialise(parseTreeNode, options)
}

JsonConvertTreeWidget.prototype = Object.create(Widget.prototype)

JsonConvertTreeWidget.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent
  this.computeAttributes()
  this.execute()

  const root = this.document.createElement('div')
  root.className = 'jc-tree'

  const text = this.wiki.getTiddlerText(this.sourceTitle) || ''
  if (text.trim()) {
    const result = parse(text)
    if (result.errors.length) {
      const e = result.errors[0]
      const msg = e.position == null
        ? `Parse error: ${e.message}`
        : `Parse error at position ${e.position}: ${e.message}`
      this.appendMessage(root, 'jc-tree-error', msg)
    } else {
      if (result.warnings.length) {
        this.appendMessage(root, 'jc-tree-note', result.warnings[0].message)
      }
      this.renderRoot(root, result.value)
    }
  } else {
    this.appendMessage(root, 'jc-tree-empty', 'Paste JSON above to see its shape.')
  }

  parent.insertBefore(root, nextSibling)
  this.domNodes.push(root)
}

JsonConvertTreeWidget.prototype.appendMessage = function(parent, cls, text) {
  const node = this.document.createElement('div')
  node.className = cls
  node.textContent = text
  parent.appendChild(node)
}

JsonConvertTreeWidget.prototype.renderRoot = function(parent, value) {
  if (value === null || typeof value !== 'object') {
    this.renderLeaf(parent, '(root)', value, [])
    return
  }
  const entries = childEntries(value)
  if (entries.length === 0) {
    const msg = Array.isArray(value) ? 'Empty array.' : 'Empty object.'
    this.appendMessage(parent, 'jc-tree-note', msg)
    return
  }
  for (const [name, child, seg] of entries) {
    this.renderNode(parent, name, child, [seg], 1)
  }
}

JsonConvertTreeWidget.prototype.renderNode = function(parent, name, value, segments, depth) {
  const hasChildren = value !== null && typeof value === 'object'
  if (!hasChildren) {
    this.renderLeaf(parent, name, value, segments)
    return
  }

  const details = this.document.createElement('details')
  details.className = 'jc-tree-node'
  if (depth <= 1) details.open = true

  const summary = this.document.createElement('summary')
  summary.className = 'jc-tree-summary'
  this.renderRow(summary, name, previewBranch(value), segments)
  details.appendChild(summary)

  const children = this.document.createElement('div')
  children.className = 'jc-tree-children'
  for (const [childName, childVal, seg] of childEntries(value)) {
    this.renderNode(children, childName, childVal, [...segments, seg], depth + 1)
  }
  details.appendChild(children)

  parent.appendChild(details)
}

JsonConvertTreeWidget.prototype.renderLeaf = function(parent, name, value, segments) {
  const row = this.document.createElement('div')
  row.className = 'jc-tree-leaf'
  this.renderRow(row, name, previewLeaf(value), segments)
  parent.appendChild(row)
}

JsonConvertTreeWidget.prototype.renderRow = function(parent, name, preview, segments) {
  const keySpan = this.document.createElement('span')
  keySpan.className = 'jc-tree-key'
  keySpan.textContent = name
  parent.appendChild(keySpan)

  const previewSpan = this.document.createElement('span')
  previewSpan.className = 'jc-tree-preview'
  previewSpan.textContent = preview
  parent.appendChild(previewSpan)

  if (segments.length === 0) return

  const path = buildPath(segments)
  const pathSpan = this.document.createElement('span')
  pathSpan.className = 'jc-tree-path'
  pathSpan.textContent = path
  parent.appendChild(pathSpan)

  if (pathHasInvalidKey(segments)) {
    const note = this.document.createElement('span')
    note.className = 'jc-tree-pathnote'
    note.textContent = '(unsupported key)'
    note.title = 'Keys containing "." or "[" or "]" are not selectable.'
    parent.appendChild(note)
    return
  }

  const copyBtn = this.document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'jc-tree-copy'
  copyBtn.textContent = 'copy'
  copyBtn.title = `Copy path: ${path}`
  copyBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(path)
      copyBtn.classList.add('jc-tree-copied')
      setTimeout(() => copyBtn.classList.remove('jc-tree-copied'), 800)
    }
  })
  parent.appendChild(copyBtn)
}

JsonConvertTreeWidget.prototype.execute = function() {
  this.sourceTitle = this.getAttribute('source-title', '')
}

JsonConvertTreeWidget.prototype.refresh = function(changedTiddlers) {
  const changedAttributes = this.computeAttributes()
  if (changedAttributes['source-title'] ||
      (this.sourceTitle && changedTiddlers[this.sourceTitle])) {
    this.refreshSelf()
    return true
  }
  return false
}

exports['json-convert-tree'] = JsonConvertTreeWidget
