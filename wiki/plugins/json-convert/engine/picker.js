const { passThroughPath } = require('./field-name.js')

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

const initialPickerState = ({ leafPaths, twFields, customFields }) => {
  const leafSet = new Set(leafPaths)
  const state = {}
  for (const [name, value] of Object.entries(customFields || {})) {
    const path = passThroughPath(value, name, leafSet)
    if (path !== null) state[path] = name
  }
  for (const [name, value] of Object.entries(twFields || {})) {
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

exports.initialPickerState = initialPickerState
exports.diffPicker = diffPicker
