const { formatProfile } = require(
  '$:/plugins/crosseye/json-convert/engine/profile-format.js'
)
const { validateProfile } = require(
  '$:/plugins/crosseye/json-convert/engine/validate.js'
)
const { defaultTransforms } = require(
  '$:/plugins/crosseye/json-convert/engine/transforms.js'
)
const { walkTemplate, parseToken } = require(
  '$:/plugins/crosseye/json-convert/engine/template.js'
)
const { prepareSource } = require(
  '$:/plugins/crosseye/json-convert/engine/prepare.js'
)
const { resolvePath } = require(
  '$:/plugins/crosseye/json-convert/engine/path.js'
)
const { mergeRecordShapes } = require(
  '$:/plugins/crosseye/json-convert/engine/shape.js'
)
const { serializeShape, topLevelFields } = require(
  '$:/plugins/crosseye/json-convert/engine/shape-diff.js'
)
const { extractRecordsToken } = require(
  '$:/plugins/crosseye/json-convert-studio/widgets/util.js'
)

// Pure construction of an importer pack — the plugin tiddler a
// recipient installs — from a profile, the transforms it references,
// optional sample data, and the form the author filled in.  No wiki
// access: the widget gathers the inputs, this module builds the
// output, and the tests exercise it headlessly.

const RUNTIME_TITLE = '$:/plugins/crosseye/json-convert'
const PROFILE_TAG = '$:/tags/json-convert/profile'
const TRANSFORM_TAG = '$:/tags/json-convert/transform'
const PROFILE_FORMAT = 1
const TYPE_JS = 'application/javascript'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const VERSION_RE = /^\d+\.\d+\.\d+$/
const COLLISIONS = new Set(['skip', 'overwrite'])

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const err = (code, message) => ({ code, message })

const compareVersions = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1
  }
  return 0
}

const bumpPatch = (version) => {
  const [major, minor, patch] = version.split('.').map(Number)
  return `${major}.${minor}.${patch + 1}`
}

const packTitleFor = (publisher, slug) => `$:/plugins/${publisher}/${slug}`

// Every transform name a profile's bindings pipe through.
const referencedTransforms = (profile) => {
  const names = new Set()
  const scan = (template) => {
    if (typeof template !== 'string') return
    walkTemplate(template, () => {}, () => {}, (content) => {
      parseToken(content).transforms.forEach((n) => names.add(n.trim()))
    })
  }
  for (const group of ['tw-fields', 'custom-fields']) {
    const bindings = profile[group]
    if (isPlainObject(bindings)) Object.values(bindings).forEach(scan)
  }
  return names
}

// The shape of the sample's records, recorded so the consumer panel can
// later compare what a recipient pastes against what the profile was
// built for.  Null when the sample cannot be read the way the profile
// reads it — the author sees that as a generation error instead.
const fingerprint = (sampleText, profile) => {
  const prepared = prepareSource(sampleText, profile.normalize)
  if (prepared.errors.length) {
    return { error: prepared.errors[0].message }
  }
  const records = resolvePath(
    prepared.value, extractRecordsToken(profile.records)
  )
  if (!Array.isArray(records) || records.length === 0) {
    return { error: `records path ${profile.records} matches nothing in the sample` }
  }
  return {
    records: profile.records,
    count: records.length,
    shape: serializeShape(mergeRecordShapes(records))
  }
}

const runtimeLink = (studioUrl) =>
  `${studioUrl}#${encodeURIComponent(RUNTIME_TITLE)}`

const shimText = ({ runtimeMin, studioUrl, panelTitle }) => {
  const where = studioUrl
    ? `Drag [[the ${RUNTIME_TITLE} tiddler|${runtimeLink(studioUrl)}]] into this wiki, save, and reload.`
    : `Ask whoever gave you this importer for the \`${RUNTIME_TITLE}\` plugin; drag it into this wiki, save, and reload.`
  return [
    `<$let panel="${RUNTIME_TITLE}/ui/consumer-panel">`,
    `<$list filter="[<panel>is[tiddler]] [<panel>is[shadow]] +[first[]]" variable="_jc" emptyMessage="""`,
    `This importer needs the ''JSON Convert'' runtime plugin (version ${runtimeMin} or newer), which is not installed in this wiki.  ${where}`,
    `""">`,
    '<$transclude',
    '  $tiddler=<<panel>>',
    '  $mode="block"',
    `  pack="${panelTitle}"/>`,
    '</$list>',
    '</$let>',
    ''
  ].join('\n')
}

const readmeText = ({
  name, description, caption, panelTitle, studioUrl, runtimeMin, version,
  now, fields
}) => {
  const date = `${now.slice(0, 4)}-${now.slice(4, 6)}-${now.slice(6, 8)}`
  const made = studioUrl
    ? `[[JSON Convert Studio|${studioUrl}]]`
    : 'JSON Convert Studio'
  const lines = [
    `! ${name}`,
    '',
    description,
    '',
    `* [[${caption}|${panelTitle}]] — open the importer.  It is also listed under ''More › Importers'' in the sidebar.`
  ]
  if (fields.length) {
    lines.push(`* It expects JSON records with the fields ${fields.map((f) => `\`${f}\``).join(', ')}.`)
  }
  lines.push(
    `* How to use it: [[Using an importer|${RUNTIME_TITLE}/usage]].`,
    `* Version ${version}, made ${date} with ${made}.  Needs the JSON Convert runtime ${runtimeMin} or newer.  If your JSON stops fitting, ask whoever made this importer for a regenerated copy.`,
    ''
  )
  return lines.join('\n')
}

const validateForm = (form) => {
  const errors = []
  if (!SLUG_RE.test(form.publisher || '')) {
    errors.push(err('bad-publisher',
      'publisher must be lower-case letters, digits and hyphens, e.g. "acme"'))
  }
  if (!SLUG_RE.test(form.slug || '')) {
    errors.push(err('bad-slug',
      'slug must be lower-case letters, digits and hyphens, e.g. "invoice-importer"'))
  }
  if (!(form.name || '').trim()) {
    errors.push(err('missing-name', 'the importer needs a name'))
  }
  if (!(form.caption || '').trim()) {
    errors.push(err('missing-caption', 'the importer page needs a caption'))
  }
  if (!VERSION_RE.test(form.version || '')) {
    errors.push(err('bad-version', 'version must look like 1.2.3'))
  }
  if (form.collisions && !COLLISIONS.has(form.collisions)) {
    errors.push(err('bad-collisions',
      'the collision default must be "skip" or "overwrite"'))
  }
  return errors
}

// input:
//   form       — { profile, publisher, slug, name, description, author,
//                  version, caption, panelDescription, convertLabel,
//                  applyLabel, collisions, studioUrl }
//   profile    — { title, text, fields }        (the source profile)
//   transforms — { [name]: { title, fields, builtin } }  (every user
//                  transform in the wiki; builtin ones ship with the
//                  runtime and are never copied)
//   sample     — { title, text } or null
//   runtime    — { title, version, coreVersion }
//   installed  — version string of a pack already at the target title,
//                or null
//   now        — TiddlyWiki date string for created/modified
const buildPack = (input) => {
  const { form, profile, transforms, sample, runtime, installed, now } = input
  const errors = validateForm(form)

  let parsed = null
  if (!profile) {
    errors.push(err('missing-profile', 'no profile selected'))
  } else {
    try {
      parsed = JSON.parse(profile.text || '')
    } catch (e) {
      errors.push(err('profile-not-json',
        `profile "${profile.title}" is not valid JSON: ${e.message}`))
    }
  }

  const available = {}
  for (const name of Object.keys(transforms || {})) available[name] = true
  if (parsed !== null) {
    validateProfile(parsed, available).forEach((e) => {
      errors.push(err('profile-invalid', `${e.code}: ${e.message}`))
    })
  }

  if (installed && form.version && VERSION_RE.test(form.version) &&
      compareVersions(form.version, installed) <= 0) {
    errors.push(err('version-not-newer',
      `version ${installed} of this importer is already installed here; ` +
      `use ${bumpPatch(installed)} or higher so the new one replaces it`))
  }

  let shape = null
  if (parsed !== null && errors.length === 0 && sample) {
    shape = fingerprint(sample.text || '', parsed)
    if (shape.error) {
      errors.push(err('sample-mismatch',
        `the sample does not fit the profile: ${shape.error}`))
    }
  }

  if (errors.length) return { errors }

  const packTitle = packTitleFor(form.publisher, form.slug)
  const t = (rest) => `${packTitle}/${rest}`
  const tiddlers = {}

  const copied = []
  let containsJs = false
  for (const name of referencedTransforms(parsed)) {
    if (defaultTransforms[name]) continue
    const entry = transforms[name]
    if (!entry || entry.builtin) continue
    const title = t(`transforms/${name}`)
    tiddlers[title] = {
      ...entry.fields,
      title,
      name,
      tags: TRANSFORM_TAG
    }
    copied.push(name)
    if (entry.fields.type === TYPE_JS) containsJs = true
  }

  const profileTitle = t('profile')
  tiddlers[profileTitle] = {
    title: profileTitle,
    caption: form.name.trim(),
    tags: PROFILE_TAG,
    type: 'application/json',
    text: formatProfile({ format: PROFILE_FORMAT, ...parsed })
  }

  let sampleTitle = ''
  if (sample) {
    sampleTitle = t('sample')
    tiddlers[sampleTitle] = {
      title: sampleTitle,
      type: 'application/json',
      text: sample.text
    }
    const shapeTitle = t('shape')
    tiddlers[shapeTitle] = {
      title: shapeTitle,
      type: 'application/json',
      text: JSON.stringify(shape)
    }
  }

  const panelTitle = t('importer')
  const panel = {
    title: panelTitle,
    caption: form.caption.trim(),
    type: 'text/vnd.tiddlywiki',
    slug: form.slug,
    profile: profileTitle,
    'convert-label': (form.convertLabel || '').trim() || 'Convert',
    'apply-label': (form.applyLabel || '').trim() || 'Apply',
    collisions: form.collisions || 'skip',
    'runtime-min': runtime.version,
    text: shimText({
      runtimeMin: runtime.version,
      studioUrl: form.studioUrl,
      panelTitle
    })
  }
  if (sampleTitle) {
    panel.sample = sampleTitle
    panel.shape = t('shape')
  }
  if ((form.author || '').trim()) panel.author = form.author.trim()
  if (form.studioUrl) panel['studio-url'] = form.studioUrl
  if ((form.panelDescription || '').trim()) {
    panel.description = form.panelDescription.trim()
  }
  tiddlers[panelTitle] = panel

  const description = (form.description || '').trim() ||
    `Imports ${form.name.trim()} JSON as tiddlers`
  const readmeTitle = t('readme')
  tiddlers[readmeTitle] = {
    title: readmeTitle,
    type: 'text/vnd.tiddlywiki',
    text: readmeText({
      name: form.name.trim(),
      description,
      caption: form.caption.trim(),
      panelTitle,
      studioUrl: form.studioUrl,
      runtimeMin: runtime.version,
      version: form.version,
      now,
      fields: shape ? topLevelFields(shape.shape) : []
    })
  }

  const pack = {
    title: packTitle,
    name: form.name.trim(),
    description,
    author: (form.author || '').trim(),
    version: form.version,
    'core-version': runtime.coreVersion || '>=5.4.0',
    'plugin-type': 'plugin',
    dependents: runtime.title,
    'json-convert-pack': form.slug,
    'source-profile': form.profile,
    list: 'readme',
    type: 'application/json',
    created: now,
    modified: now,
    text: JSON.stringify({ tiddlers })
  }
  if (form.studioUrl) pack.source = form.studioUrl

  return {
    errors: [],
    pack,
    panelTitle,
    transforms: copied,
    containsJs,
    hasSample: !!sample
  }
}

exports.buildPack = buildPack
exports.fingerprint = fingerprint
exports.referencedTransforms = referencedTransforms
exports.packTitleFor = packTitleFor
exports.compareVersions = compareVersions
exports.bumpPatch = bumpPatch
exports.RUNTIME_TITLE = RUNTIME_TITLE
exports.TRANSFORM_TAG = TRANSFORM_TAG
