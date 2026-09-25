#!/usr/bin/env node
// Wrap each bundled plugin text (from --savetiddler) into a draggable
// plugin .json: a single-tiddler JSON object keyed by the plugin's
// title, containing the envelope metadata from plugin.info plus the
// bundled content as `text`.
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
  const wrapper = { [info.title]: tiddler }
  fs.writeFileSync(
    textPath,
    JSON.stringify(wrapper, null, 2) + '\n',
    'utf8'
  )
  console.log(`Plugin: ${info.title} v${info.version} → ${textPath}`)
})
