// walkTemplate walks a binding template string, dispatching:
//   onText(string)  — for one or more literal characters
//   onToken(rawContent) — for the contents of a "{{...}}" token
//   onError({code, pos}) — when the template is malformed
//     codes: 'unterminated' (open "{{" with no matching "}}")
//
// Tokens are exactly `{{X}}` where X does not contain `}}`.
// Anything else — single braces included — is literal text.
//
// Token content is `path` or `path|t1|t2|...`; use parseToken to split.

const walkTemplate = (template, onError, onText, onToken) => {
  let i = 0
  while (i < template.length) {
    if (template[i] === '{' && template[i + 1] === '{') {
      let j = i + 2
      while (j < template.length - 1) {
        if (template[j] === '}' && template[j + 1] === '}') break
        j++
      }
      if (j >= template.length - 1) {
        onError({ code: 'unterminated', pos: i })
        return
      }
      onToken(template.slice(i + 2, j))
      i = j + 2
    } else {
      onText(template[i])
      i++
    }
  }
}

// Token content is `path` or `path|t1|t2|...`; each transform spec is
// a name optionally followed by bracketed parameters in TiddlyWiki's
// operand style: `zero-pad[3]`, `replace[from],[to]`.  A parameter
// cannot contain `]` (or `|`, which splits transforms).
const parseToken = (content) => {
  const parts = content.split('|')
  return { path: parts[0], transforms: parts.slice(1) }
}

const parseTransform = (spec) => {
  const open = spec.indexOf('[')
  if (open < 0) return { name: spec.trim(), params: [] }
  const name = spec.slice(0, open).trim()
  const params = []
  let rest = spec.slice(open)
  while (rest.length > 0) {
    if (rest[0] !== '[') return { name, params, error: 'malformed parameters' }
    const close = rest.indexOf(']')
    if (close < 0) return { name, params, error: 'unterminated parameter' }
    params.push(rest.slice(1, close))
    rest = rest.slice(close + 1)
    if (rest[0] === ',') rest = rest.slice(1)
    else if (rest.length > 0) return { name, params, error: 'malformed parameters' }
  }
  return { name, params }
}

exports.walkTemplate = walkTemplate
exports.parseToken = parseToken
exports.parseTransform = parseTransform
