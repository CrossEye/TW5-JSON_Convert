const { parse } = require('./parser.js')
const { normalizeDoc } = require('./normalize.js')

// The single entry point for "text on screen → document to work
// against".  Everything that reads the source JSON — conversion, the
// shape tree, the pickers — goes through here, so the structure the
// user picks from is always the structure the conversion sees.
//
// `spec` is the profile's `normalize` value: an array, the JSON text
// of one, or absent.  Absent means parse-only, byte-for-byte the old
// behaviour.
const prepareSource = (text, spec) => {
  const parsed = parse(text)
  if (parsed.errors.length > 0 || parsed.value === undefined) return parsed
  const { value, warnings } = normalizeDoc(parsed.value, spec)
  return {
    value,
    warnings: [...parsed.warnings, ...warnings],
    errors: []
  }
}

exports.prepareSource = prepareSource
