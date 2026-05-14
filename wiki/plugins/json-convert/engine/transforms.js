const stringify = (v) =>
  v === null || v === undefined ? '' : String(v)

const htmlToWikitext = (v) => stringify(v)

const tiddlywikiList = (items) => items
  .filter((x) => x !== '')
  .map((x) => /\s/.test(x) ? `[[${x}]]` : x)
  .join(' ')

const splitCsv = (v) => Array.isArray(v)
  ? tiddlywikiList(v.map((s) => stringify(s).trim()))
  : tiddlywikiList(stringify(v).split(',').map((s) => s.trim()))

const pad = (n, w) => String(n).padStart(w, '0')

const formatTwDate = (d) =>
  pad(d.getUTCFullYear(), 4) +
  pad(d.getUTCMonth() + 1, 2) +
  pad(d.getUTCDate(), 2) +
  pad(d.getUTCHours(), 2) +
  pad(d.getUTCMinutes(), 2) +
  pad(d.getUTCSeconds(), 2) +
  pad(d.getUTCMilliseconds(), 3)

const timestampToDate = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  const ms = n < 1e11 ? n * 1000 : n
  return formatTwDate(new Date(ms))
}

const defaultTransforms = {
  'html-to-wikitext':  htmlToWikitext,
  'split-csv':         splitCsv,
  'timestamp-to-date': timestampToDate
}

exports.defaultTransforms = defaultTransforms
exports.formatTwDate = formatTwDate
