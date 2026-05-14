// For each input title parsed as a non-negative integer N, emit the
// operator's operand string repeated N times.  Used by the path-pick
// modal to build `../` prefixes from a depth count.
//
// Example: `[[3]jc-repeat-string[../]]` → `../../../`
exports['jc-repeat-string'] = function(source, operator) {
  const out = []
  const str = operator.operand || ''
  source((tiddler, title) => {
    const n = Number.parseInt(title, 10)
    if (Number.isNaN(n) || n < 0) return
    out.push(str.repeat(n))
  })
  return out
}
