const stringify = (v) =>
  v === null || v === undefined ? '' : String(v)

const htmlToWikitext = (v) => stringify(v)

const tiddlywikiList = (items) => items
  .filter((x) => x !== '')
  .map((x) => /\s/.test(x) ? `[[${x}]]` : x)
  .join(' ')

const splitOnCommas = (v) => Array.isArray(v)
  ? v.map((s) => stringify(s).trim())
  : stringify(v).split(',').map((s) => s.trim())

const splitCommas = (v) => tiddlywikiList(splitOnCommas(v))

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

const isoToDate = (v) => {
  if (v === null || v === undefined || v === '') return ''
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? '' : formatTwDate(d)
}

// Parameterized built-ins.  Every transform is called as
// (value, params, context); these read params, the older ones ignore
// them.  Given the wrong parameters they leave the value alone.
const isEmpty = (v) => v === null || v === undefined || v === ''

const zeroPad = (v, params = []) => {
  const width = Number.parseInt(params[0], 10)
  if (!Number.isFinite(width) || width < 0) return v
  return stringify(v).padStart(width, '0')
}

const defaultTo = (v, params = []) =>
  isEmpty(v) ? (params[0] === undefined ? '' : params[0]) : v

const prefix = (v, params = []) =>
  isEmpty(v) || params[0] === undefined ? v : params[0] + stringify(v)

const suffix = (v, params = []) =>
  isEmpty(v) || params[0] === undefined ? v : stringify(v) + params[0]

const replace = (v, params = []) => {
  const from = params[0]
  if (from === undefined || from === '') return v
  return stringify(v).split(from).join(params[1] === undefined ? '' : params[1])
}

// An array of objects to the named property of each, as a TiddlyWiki
// title list (items with spaces double-bracketed), which is what a
// tags field wants.  A lone object yields its property; anything else
// yields ''.
const pluck = (v, params = []) => {
  const key = params[0]
  if (key === undefined) return v
  const items = Array.isArray(v) ? v : (v && typeof v === 'object' ? [v] : [])
  return tiddlywikiList(items.map((item) =>
    item && typeof item === 'object' ? stringify(item[key]) : ''
  ))
}

const defaultTransforms = {
  'html-to-wikitext':  htmlToWikitext,
  'split-commas':      splitCommas,
  'timestamp-to-date': timestampToDate,
  'iso-to-date':       isoToDate,
  'zero-pad':          zeroPad,
  'default':           defaultTo,
  'prefix':            prefix,
  'suffix':            suffix,
  'replace':           replace,
  'pluck':             pluck
}

exports.defaultTransforms = defaultTransforms
exports.formatTwDate = formatTwDate
