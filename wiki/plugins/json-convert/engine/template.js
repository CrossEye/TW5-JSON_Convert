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

const parseToken = (content) => {
  const parts = content.split('|')
  return { path: parts[0], transforms: parts.slice(1) }
}

exports.walkTemplate = walkTemplate
exports.parseToken = parseToken
