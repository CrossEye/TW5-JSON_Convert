#!/usr/bin/env node
// Wrap each bundled plugin text (from --savetiddler) into a draggable
// plugin .json: a one-element array holding the plugin tiddler's fields
// — the envelope metadata from plugin.info plus the bundled content as
// `text`.  TiddlyWiki's JSON importer takes an array of tiddler objects
// (or a single one); a map keyed by title imports as a titleless
// tiddler, which is what earlier releases shipped.
const fs = require('node:fs')
const path = require('node:path')

const { plugins } = require('./plugins.js')

const args = process.argv.slice(2)
const outputDir = args[0] || 'output'

plugins.forEach(({ dir, out }) => {
  const info = JSON.parse(
    fs.readFileSync(path.join(dir, 'plugin.info'), 'utf8')
  )
  const textPath = path.join(outputDir, out)
  const text = fs.readFileSync(textPath, 'utf8')
  const tiddler = { ...info, type: 'application/json', text }
  if (Array.isArray(tiddler.dependents)) {
    tiddler.dependents = tiddler.dependents
      .map((t) => (/\s/.test(t) ? `[[${t}]]` : t)).join(' ')
  }
  fs.writeFileSync(
    textPath,
    JSON.stringify([tiddler], null, 2) + '\n',
    'utf8'
  )
  console.log(`Plugin: ${info.title} v${info.version} → ${textPath}`)
})
