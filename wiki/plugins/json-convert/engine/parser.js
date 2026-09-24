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

const NEWLINE = '\n'

// Where did it go wrong?  Every engine words this differently and some
// say nothing useful at all, so try each known shape and degrade to no
// location rather than to a wrong one:
//
//   V8/Node   ... at position 1684
//   V8 (newer)... at position 1684 (line 27 column 10)
//   SpiderMonkey  at line 27 column 10 of the JSON data
//   JavaScriptCore  (no location at all)
const extractLocation = (message, text) => {
  const lineCol = /at line (\d+) column (\d+)/.exec(message)
  if (lineCol) {
    return { line: Number(lineCol[1]), column: Number(lineCol[2]) }
  }
  const pos = /at position (\d+)/.exec(message)
  if (!pos) return {}
  const position = Number(pos[1])
  if (position > text.length) return {}
  const before = text.slice(0, position)
  const lineStart = before.lastIndexOf(NEWLINE) + 1
  return {
    position,
    line: before.split(NEWLINE).length,
    column: position - lineStart + 1
  }
}

// The offending line itself: "position 1684" tells you nothing when you
// are staring at a textarea.
const excerptFor = (text, line) => {
  if (line === undefined) return undefined
  const lines = text.split(NEWLINE)
  return line >= 1 && line <= lines.length ? lines[line - 1] : undefined
}

// The raw offset is reported in its own field, so keep it out of the
// prose.  The trailing snippet some engines append is noise too.
const tidyMessage = (message) => message
  .replace(/\s*(?:in JSON)?\s*at position \d+(?:\s*\(line \d+ column \d+\))?/, '')
  .replace(/\s*at line \d+ column \d+ of the JSON data/, '')
  .replace(/,?\s*(?:\.\.\.)?"[\s\S]*?"(?:\.\.\.)?\s*is not valid JSON/, '')
  .trim()

const parseError = (text, err) => {
  const { position, line, column } = extractLocation(err.message, text)
  const where = line === undefined ? '' : ` at line ${line}, column ${column}`
  return {
    code: 'parse-failed',
    message: `Malformed JSON${where}: ${tidyMessage(err.message)}`,
    position,
    line,
    column,
    excerpt: excerptFor(text, line)
  }
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
    errors: [parseError(text, direct.error)]
  }
}
