const { passThroughPath } = require('./field-name.js')

// Walk a merged-shape node and collect every leaf path as a string in
// the engine's path syntax.  Skips leaves that descend into an array
// (`inArray === true`); their paths would need `[*]` in a binding,
// which the validator rejects.  Users wanting to bind those still have
// the regular Browse modal.
const segsToPath = (segs) => {
  let p = ''
  for (const s of segs) {
    if (s.kind === 'index') p += `[${s.value}]`
    else p = p ? `${p}.${s.value}` : s.value
  }
  return p
}

const collectLeafPaths = (shape) => {
  const out = []
  const walk = (node, segs) => {
    if (!node) return
    if (node.kind === 'leaf' || node.kind === 'mixed') {
      if (!node.inArray) out.push(segsToPath(segs))
      return
    }
    if (node.kind === 'object') {
      for (const key of Object.keys(node.children || {})) {
        walk(node.children[key], [...segs, { kind: 'key', value: key }])
      }
      return
    }
    if (node.kind === 'array') {
      if (node.element) walk(node.element, [...segs, { kind: 'index', value: 0 }])
    }
  }
  walk(shape, [])
  return out
}

// Pass-through field picker — pure helpers shared by the editor widgets.
//
// Picker state is a flat map of the user's active selections:
//
//   { [path]: <name> }
//
// Only ticked paths appear.  Default names for unticked leaves are
// computed live by the rendering widget via `flattenPath`, against a
// taken-names set built from the current bindings + already-ticked
// names — no need to persist them.

// `twFields` is accepted but intentionally ignored: pass-throughs the
// picker creates always go to `custom-fields` (per design), and
// recognizing tw-fields pass-throughs in state would be misleading
// since the apply step never touches tw-fields — unticking such a
// path would silently do nothing.  TW-fields names are still
// considered when computing taken-names for new flattenings (see
// the picker UI), so collisions are still avoided.
const initialPickerState = ({ leafPaths, customFields }) => {
  const leafSet = new Set(leafPaths)
  const state = {}
  for (const [name, value] of Object.entries(customFields || {})) {
    const path = passThroughPath(value, name, leafSet)
    if (path !== null) state[path] = name
  }
  return state
}

// Diff between two picker states (typically: state at modal open vs.
// state at Apply).  Returns the row-level operations needed against
// the editor's draft custom-fields:
//
//   {
//     add:    [{ name, path }, ...],   // create row name → "{{path}}"
//     remove: [name, ...]              // delete row by name
//   }
//
// Renames (same path, different name) appear as one remove + one add.
// Bindings that aren't pure pass-throughs in `customFields` are never
// removed by the picker, even if their name appears in oldState — the
// recognizer would already have rejected them on init, and a binding
// could have been customized between open and apply.
const diffPicker = ({ oldState, newState, customFields, leafPaths }) => {
  const leafSet = new Set(leafPaths)
  const custom = customFields || {}
  const old = oldState || {}
  const next = newState || {}
  const removes = new Set()
  const addList = []

  for (const [path, oldName] of Object.entries(old)) {
    const newName = next[path]
    if (newName === oldName) continue
    const existingValue = custom[oldName]
    if (existingValue !== undefined &&
        passThroughPath(existingValue, oldName, leafSet) === path) {
      removes.add(oldName)
    }
  }

  for (const [path, newName] of Object.entries(next)) {
    const oldName = old[path]
    if (oldName === newName) {
      const existingValue = custom[newName]
      if (existingValue !== undefined &&
          passThroughPath(existingValue, newName, leafSet) === path) continue
    }
    addList.push({ name: newName, path })
  }

  return { add: addList, remove: [...removes] }
}

// Bulk-tick every leaf path that isn't already in `currentState`.  Names
// for newly-added leaves are computed with the caller-supplied
// `flattenPath` against a taken-names set built from the existing draft
// fields + already-ticked names, so they don't collide.  Existing
// entries are left alone (so a user-renamed pass-through survives).
const selectAllPickerState = ({ leafPaths, twFields, customFields, currentState, flattenPath }) => {
  const next = { ...(currentState || {}) }
  const taken = new Set()
  for (const name of Object.keys(twFields || {})) taken.add(name)
  for (const name of Object.keys(customFields || {})) taken.add(name)
  for (const name of Object.values(next)) taken.add(name)
  for (const path of leafPaths) {
    if (Object.prototype.hasOwnProperty.call(next, path)) continue
    const name = flattenPath(path, taken)
    next[path] = name
    taken.add(name)
  }
  return next
}

exports.collectLeafPaths = collectLeafPaths
exports.diffPicker = diffPicker
exports.initialPickerState = initialPickerState
exports.selectAllPickerState = selectAllPickerState
