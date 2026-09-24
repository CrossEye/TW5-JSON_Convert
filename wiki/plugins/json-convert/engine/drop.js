const PROFILE_TAG = '$:/tags/json-convert/profile'

// What should a dropped tiddler do to the source box?
//
// A tiddler drag carries the whole tiddler as JSON, but the browser's
// default action for a textarea is to insert the drag's text/plain
// payload — which TiddlyWiki sets to the tiddler's title, bracketed
// when it contains spaces.  Dropping a profile on the source box
// therefore used to splice `[[Example Reified Output]]` into the JSON,
// producing a parse failure a dozen lines from where the eye looks for
// one.  Nothing dropped here may end up as a wikilink.

const TAG_RE = /\[\[[^\]]+\]\]|\S+/g

// Tags arrive as a TiddlyWiki list string or as an array, depending on
// whether the tiddler came from this wiki or across a drag.
const tagList = (tags) => {
  if (Array.isArray(tags)) return tags
  if (typeof tags !== 'string') return []
  return (tags.match(TAG_RE) || []).map((t) => t.replace(/^\[\[|\]\]$/g, ''))
}

const classifyDrop = (fields, profileExists) => {
  if (!fields || !fields.title) return { action: 'ignore' }
  if (tagList(fields.tags).indexOf(PROFILE_TAG) !== -1) {
    return profileExists
      ? { action: 'select-profile', title: fields.title }
      : {
          action: 'note',
          note: `"${fields.title}" is a profile from another wiki.  ` +
            'Drop it on the page background to import it first, then ' +
            'pick it from the profile list.'
        }
  }
  if (typeof fields.text === 'string' && fields.text.trim() !== '') {
    return { action: 'load-source', text: fields.text, title: fields.title }
  }
  return {
    action: 'note',
    note: `"${fields.title}" has no text to load as source JSON.`
  }
}

// TiddlyWiki puts the dragged tiddler's fields on the dataTransfer as
// `text/vnd.tiddler`; some browsers only get the data: URL form.
// Returns null when the payload isn't a tiddler at all.
const droppedTiddlerFields = (dataTransfer) => {
  if (!dataTransfer) return null
  const read = (type) => {
    try { return dataTransfer.getData(type) || '' } catch (_) { return '' }
  }
  let raw = read('text/vnd.tiddler')
  if (!raw) {
    const url = read('URL') || read('text/x-moz-url')
    const prefix = 'data:text/vnd.tiddler,'
    if (url.indexOf(prefix) === 0) {
      try {
        raw = decodeURIComponent(url.slice(prefix.length))
      } catch (_) {
        raw = ''
      }
    }
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const one = Array.isArray(parsed) ? parsed[0] : parsed
    return one && typeof one === 'object' && !Array.isArray(one) ? one : null
  } catch (_) {
    return null
  }
}

exports.classifyDrop = classifyDrop
exports.droppedTiddlerFields = droppedTiddlerFields
exports.tagList = tagList
exports.PROFILE_TAG = PROFILE_TAG
