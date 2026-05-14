const stripBOM = (s) =>
  s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s

const findJsonSpan = (s) => {
  let start = -1
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '{' || c === '[') {
      start = i
      break
    }
  }
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (inString) {
      if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{' || c === '[') depth++
    else if (c === '}' || c === ']') {
      depth--
      if (depth === 0) return { start, end: i + 1 }
    }
  }
  return null
}

const extractPosition = (err) => {
  const m = /at position (\d+)/.exec(err.message)
  return m ? Number(m[1]) : undefined
}

const tryParse = (text) => {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (err) {
    return { ok: false, error: err }
  }
}

const recoveryNote = (text, stripped, span) => {
  const parts = []
  if (stripped.length < text.length) parts.push('BOM')
  if (span.start > 0 || span.end < stripped.length) {
    parts.push('non-JSON wrapper')
  }
  return parts.length
    ? `Parsed after stripping ${parts.join(' and ')}`
    : 'Parsed after recovery'
}

exports.parse = (text) => {
  const direct = tryParse(text)
  if (direct.ok) {
    return { value: direct.value, warnings: [], errors: [] }
  }

  const stripped = stripBOM(text)
  const span = findJsonSpan(stripped)
  if (span) {
    const slice = stripped.slice(span.start, span.end)
    const recovered = tryParse(slice)
    if (recovered.ok) {
      return {
        value: recovered.value,
        warnings: [{
          code: 'parse-recovered',
          message: recoveryNote(text, stripped, span)
        }],
        errors: []
      }
    }
  }

  return {
    value: undefined,
    warnings: [],
    errors: [{
      code: 'parse-failed',
      message: direct.error.message,
      position: extractPosition(direct.error)
    }]
  }
}
