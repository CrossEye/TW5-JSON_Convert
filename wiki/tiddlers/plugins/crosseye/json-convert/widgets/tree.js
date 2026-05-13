const Widget = require('$:/core/modules/widgets/widget.js').widget
const { parse } = require('$:/plugins/crosseye/json-convert/engine/parser.js')
const { resolvePath } = require('$:/plugins/crosseye/json-convert/engine/path.js')
const { mergeRecordShapes } = require('$:/plugins/crosseye/json-convert/engine/shape.js')
const { walkTemplate } = require('$:/plugins/crosseye/json-convert/engine/template.js')

const extractIterationToken = (iteration) => {
  let path = null
  walkTemplate(iteration,
    () => {},
    () => {},
    (p) => { if (path === null) path = p }
  )
  return path === null ? iteration : path
}

const KEY_RE = /^[^.[\]]+$/

const buildDisplayPath = (segments) => {
  let path = ''
  for (const s of segments) {
    if (s.kind === 'star') path += '[*]'
    else if (s.kind === 'index') path += `[${s.value}]`
    else path = path ? `${path}.${s.value}` : s.value
  }
  return path
}

const buildEmitPath = (segments) => {
  let path = ''
  for (const s of segments) {
    if (s.kind === 'star') path += '[0]'
    else if (s.kind === 'index') path += `[${s.value}]`
    else path = path ? `${path}.${s.value}` : s.value
  }
  return path
}

const pathHasInvalidKey = (segments) =>
  segments.some((s) => s.kind === 'key' && !KEY_RE.test(s.value))

const previewLeaf = (v) => {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') {
    const trimmed = v.length > 60 ? `${v.slice(0, 60)}…` : v
    return JSON.stringify(trimmed)
  }
  return String(v)
}

const previewBranch = (v) =>
  Array.isArray(v) ? `Array(${v.length})` : `{${Object.keys(v).length}}`

const previewShapeLeaf = (node) =>
  node.sampleValue === undefined ? '?' : previewLeaf(node.sampleValue)

const previewShapeBranch = (node) => {
  if (node.kind === 'array') return node.element ? 'Array(*)' : 'Array(0)'
  const n = node.children ? Object.keys(node.children).length : 0
  return `{${n}}`
}

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
  root.tabIndex = -1
  if (this.mode === 'iteration-pick') root.classList.add('jc-tree-iteration-pick')

  if (this.iterationPath) this.renderMerged(root)
  else this.renderRaw(root)

  parent.insertBefore(root, nextSibling)
  this.domNodes.push(root)

  // On initial render (e.g., modal just opened), give the tree focus
  // so Tab/Shift-Tab navigation works without a click first.  The
  // opener button still holds focus underneath the modal, so we
  // explicitly move focus into the modal here.
  setTimeout(() => root.focus(), 0)
}

JsonConvertTreeWidget.prototype.appendMessage = function(parent, cls, text) {
  const node = this.document.createElement('div')
  node.className = cls
  node.textContent = text
  parent.appendChild(node)
}

JsonConvertTreeWidget.prototype.parseSource = function(parent) {
  const text = this.wiki.getTiddlerText(this.sourceTitle) || ''
  if (!text.trim()) {
    this.appendMessage(parent, 'jc-tree-empty', 'No source JSON.')
    return null
  }
  const result = parse(text)
  if (result.errors.length) {
    const e = result.errors[0]
    const msg = e.position == null
      ? `Parse error: ${e.message}`
      : `Parse error at position ${e.position}: ${e.message}`
    this.appendMessage(parent, 'jc-tree-error', msg)
    return null
  }
  if (result.warnings.length) {
    this.appendMessage(parent, 'jc-tree-note', result.warnings[0].message)
  }
  return result.value
}

// ---- Raw mode (free or iteration-pick) ----

JsonConvertTreeWidget.prototype.renderRaw = function(parent) {
  const value = this.parseSource(parent)
  if (value === null) return
  this.renderRawRoot(parent, value)
}

JsonConvertTreeWidget.prototype.renderRawRoot = function(parent, value) {
  if (value === null || typeof value !== 'object') {
    this.renderRawLeaf(parent, '(root)', value, [])
    return
  }
  const entries = childEntries(value)
  if (entries.length === 0) {
    this.appendMessage(parent, 'jc-tree-note', Array.isArray(value) ? 'Empty array.' : 'Empty object.')
    return
  }
  for (const [name, child, seg] of entries) {
    this.renderRawNode(parent, name, child, [seg], 1)
  }
}

JsonConvertTreeWidget.prototype.renderRawNode = function(parent, name, value, segments, depth) {
  const hasChildren = value !== null && typeof value === 'object'
  if (!hasChildren) {
    this.renderRawLeaf(parent, name, value, segments)
    return
  }
  const isArray = Array.isArray(value)
  const details = this.document.createElement('details')
  details.className = 'jc-tree-node'
  if (depth <= 1) details.open = true

  const summary = this.document.createElement('summary')
  summary.className = 'jc-tree-summary'
  this.renderRow(summary, {
    name,
    preview: previewBranch(value),
    segments,
    canEmit: this.mode === 'iteration-pick' ? isArray : true
  })
  details.appendChild(summary)

  const children = this.document.createElement('div')
  children.className = 'jc-tree-children'
  for (const [childName, childVal, seg] of childEntries(value)) {
    this.renderRawNode(children, childName, childVal, [...segments, seg], depth + 1)
  }
  details.appendChild(children)
  parent.appendChild(details)
}

JsonConvertTreeWidget.prototype.renderRawLeaf = function(parent, name, value, segments) {
  const row = this.document.createElement('div')
  row.className = 'jc-tree-node jc-tree-leaf'
  this.renderRow(row, {
    name,
    preview: previewLeaf(value),
    segments,
    // In iteration-pick mode, leaves are never arrays so never selectable.
    canEmit: this.mode !== 'iteration-pick'
  })
  parent.appendChild(row)
}

// ---- Merged-shape mode ----

JsonConvertTreeWidget.prototype.renderMerged = function(parent) {
  const value = this.parseSource(parent)
  if (value === null) return
  if (!this.iterationPath.trim()) {
    this.appendMessage(parent, 'jc-tree-note', 'Set the iteration path first.')
    return
  }
  const iterationPath = extractIterationToken(this.iterationPath)
  const records = resolvePath(value, iterationPath)
  if (records === undefined) {
    this.appendMessage(parent, 'jc-tree-note', `Iteration path "${this.iterationPath}" did not resolve.`)
    return
  }
  if (!Array.isArray(records)) {
    this.appendMessage(parent, 'jc-tree-note', `Iteration path "${this.iterationPath}" did not resolve to an array.`)
    return
  }
  if (records.length === 0) {
    this.appendMessage(parent, 'jc-tree-note', 'Iteration array is empty.')
    return
  }

  const note = this.document.createElement('div')
  note.className = 'jc-tree-note jc-tree-index-note'
  note.textContent = 'Click emits index [0] for arrays; edit the path to pick a different element.'
  parent.appendChild(note)

  const shape = mergeRecordShapes(records)
  this.renderMergedRoot(parent, shape)
}

JsonConvertTreeWidget.prototype.renderMergedRoot = function(parent, node) {
  if (!node) {
    this.appendMessage(parent, 'jc-tree-note', 'No records.')
    return
  }
  if (node.kind === 'leaf') {
    this.renderMergedLeaf(parent, '(record)', node, [])
    return
  }
  if (node.kind === 'mixed') {
    this.renderMergedMixed(parent, '(record)', node, [])
    return
  }
  if (node.kind === 'array') {
    const seg = { kind: 'star' }
    this.renderMergedNode(parent, '[*]', node.element || null, [seg], 1)
    return
  }
  const keys = node.children ? Object.keys(node.children) : []
  if (keys.length === 0) {
    this.appendMessage(parent, 'jc-tree-note', 'Records have no fields.')
    return
  }
  for (const key of keys) {
    const seg = { kind: 'key', value: key }
    this.renderMergedNode(parent, key, node.children[key], [seg], 1)
  }
}

JsonConvertTreeWidget.prototype.renderMergedNode = function(parent, name, node, segments, depth) {
  if (!node) {
    const row = this.document.createElement('div')
    row.className = 'jc-tree-node jc-tree-leaf'
    this.renderRow(row, { name, preview: '?', segments, canEmit: false })
    parent.appendChild(row)
    return
  }
  if (node.kind === 'leaf') {
    this.renderMergedLeaf(parent, name, node, segments)
    return
  }
  if (node.kind === 'mixed') {
    this.renderMergedMixed(parent, name, node, segments)
    return
  }

  const details = this.document.createElement('details')
  details.className = 'jc-tree-node'
  if (depth <= 1) details.open = true

  const summary = this.document.createElement('summary')
  summary.className = 'jc-tree-summary'
  const presenceBadge = (node.presence && node.presence !== 'all') ? node.presence : null
  this.renderRow(summary, {
    name,
    preview: previewShapeBranch(node),
    segments,
    canEmit: true,
    badge: presenceBadge
  })
  details.appendChild(summary)

  const children = this.document.createElement('div')
  children.className = 'jc-tree-children'
  if (node.kind === 'object') {
    for (const key of Object.keys(node.children || {})) {
      const seg = { kind: 'key', value: key }
      this.renderMergedNode(children, key, node.children[key], [...segments, seg], depth + 1)
    }
  } else {
    const seg = { kind: 'star' }
    if (node.element) {
      this.renderMergedNode(children, '[*]', node.element, [...segments, seg], depth + 1)
    } else {
      this.appendMessage(children, 'jc-tree-note', 'Empty in all records.')
    }
  }
  details.appendChild(children)
  parent.appendChild(details)
}

JsonConvertTreeWidget.prototype.renderMergedLeaf = function(parent, name, node, segments) {
  const row = this.document.createElement('div')
  row.className = 'jc-tree-node jc-tree-leaf'
  const presenceBadge = (node.presence && node.presence !== 'all') ? node.presence : null
  let typeHint = null
  if (node.types && node.types.size > 1) {
    typeHint = [...node.types].sort().join('|')
  }
  this.renderRow(row, {
    name,
    preview: previewShapeLeaf(node),
    segments,
    canEmit: true,
    badge: presenceBadge,
    typeHint
  })
  parent.appendChild(row)
}

JsonConvertTreeWidget.prototype.renderMergedMixed = function(parent, name, node, segments) {
  const row = this.document.createElement('div')
  row.className = 'jc-tree-node jc-tree-leaf'
  this.renderRow(row, {
    name,
    preview: 'varies',
    segments,
    canEmit: false,
    badge: 'varies',
    badgeClass: 'jc-tree-varies'
  })
  parent.appendChild(row)
}

// ---- Row rendering shared by both modes ----

JsonConvertTreeWidget.prototype.renderRow = function(parent, opts) {
  const { name, preview, segments, canEmit, badge, badgeClass, typeHint } = opts

  const keySpan = this.document.createElement('span')
  keySpan.className = 'jc-tree-key'
  keySpan.textContent = name
  parent.appendChild(keySpan)

  const previewSpan = this.document.createElement('span')
  previewSpan.className = 'jc-tree-preview'
  previewSpan.textContent = preview
  parent.appendChild(previewSpan)

  if (typeHint) {
    const hintSpan = this.document.createElement('span')
    hintSpan.className = 'jc-tree-types'
    hintSpan.textContent = typeHint
    parent.appendChild(hintSpan)
  }

  if (badge) {
    const badgeSpan = this.document.createElement('span')
    badgeSpan.className = badgeClass || 'jc-tree-presence'
    badgeSpan.textContent = badge
    parent.appendChild(badgeSpan)
  }

  if (segments.length === 0) {
    if (this.mode === 'iteration-pick' && !canEmit) parent.classList.add('jc-tree-disabled')
    return
  }

  const displayPath = buildDisplayPath(segments)
  const emitPath = buildEmitPath(segments)
  const pathSpan = this.document.createElement('span')
  pathSpan.className = 'jc-tree-path'
  pathSpan.textContent = displayPath
  parent.appendChild(pathSpan)

  if (pathHasInvalidKey(segments)) {
    const note = this.document.createElement('span')
    note.className = 'jc-tree-pathnote'
    note.textContent = '(unsupported key)'
    note.title = 'Keys containing "." or "[" or "]" are not selectable.'
    parent.appendChild(note)
    return
  }

  if (!canEmit) {
    if (this.mode === 'iteration-pick') parent.classList.add('jc-tree-disabled')
    return
  }

  const copyBtn = this.document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'jc-tree-copy'
  copyBtn.textContent = 'copy'
  copyBtn.title = `Fill path: ${emitPath}`

  copyBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const target = this.readActiveTarget()
    if (!target) return
    this.fillTarget(target, emitPath)
    copyBtn.textContent = 'filled'
    copyBtn.classList.add('jc-tree-filled')
    setTimeout(() => {
      copyBtn.classList.remove('jc-tree-filled')
      copyBtn.textContent = 'copy'
    }, 800)
  })
  parent.appendChild(copyBtn)
}

const parseIntOrNull = (s) => {
  if (typeof s !== 'string' || s === '') return null
  const n = parseInt(s, 10)
  return Number.isNaN(n) ? null : n
}

JsonConvertTreeWidget.prototype.readActiveTarget = function() {
  if (!this.targetStateTitle) return null
  const t = this.wiki.getTiddler(this.targetStateTitle)
  if (!t) return null
  const tiddler = t.fields.tiddler || ''
  const field = t.fields.field || ''
  if (!tiddler || !field) return null
  return {
    tiddler,
    field,
    fillMode: t.fields['fill-mode'] || 'replace',
    elementId: t.fields['element-id'] || '',
    cursorStart: parseIntOrNull(t.fields['cursor-start']),
    cursorEnd: parseIntOrNull(t.fields['cursor-end'])
  }
}

JsonConvertTreeWidget.prototype.fillTarget = function(target, path) {
  const token = `{{${path}}}`
  const existing = this.wiki.getTiddler(target.tiddler)
  const fields = existing ? { ...existing.fields } : { title: target.tiddler }
  fields.title = target.tiddler
  const currentVal = (existing && existing.fields[target.field]) || ''

  let newVal
  let cursorAfter

  if (target.fillMode === 'insert') {
    const start = target.cursorStart !== null
      ? target.cursorStart
      : currentVal.length
    const end = target.cursorEnd !== null ? target.cursorEnd : start
    newVal = currentVal.slice(0, start) + token + currentVal.slice(end)
    cursorAfter = start + token.length
  } else {
    newVal = token
    cursorAfter = token.length
  }

  fields[target.field] = newVal
  this.wiki.addTiddler(fields)

  if (this.targetActions) {
    this.invokeActionString(this.targetActions, this, null, {})
  }

  // After the modal closes, restore focus to the target input and
  // place the caret right after the inserted token.
  if (target.elementId) {
    const doc = this.document
    setTimeout(() => {
      const el = doc.getElementById(target.elementId)
      if (el && typeof el.setSelectionRange === 'function') {
        try {
          el.focus()
          el.setSelectionRange(cursorAfter, cursorAfter)
        } catch (_) { /* element may have been recreated */ }
      }
    }, 0)
  }
}

JsonConvertTreeWidget.prototype.execute = function() {
  this.sourceTitle = this.getAttribute('source-title', '')
  this.targetStateTitle = this.getAttribute('target-state-title', '')
  this.targetActions = this.getAttribute('target-actions', '')
  this.mode = this.getAttribute('mode', '')
  this.iterationPath = this.getAttribute('iteration-path', '')
}

JsonConvertTreeWidget.prototype.refresh = function(changedTiddlers) {
  const changedAttributes = this.computeAttributes()
  if (changedAttributes['source-title'] ||
      changedAttributes['target-state-title'] ||
      changedAttributes['target-actions'] ||
      changedAttributes['mode'] ||
      changedAttributes['iteration-path'] ||
      (this.sourceTitle && changedTiddlers[this.sourceTitle])) {
    this.refreshSelf()
    return true
  }
  return false
}

exports['json-convert-tree'] = JsonConvertTreeWidget
