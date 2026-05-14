#!/usr/bin/env node
// Wrap the bundled plugin text (from --savetiddler) into a draggable
// plugin .json: a single-tiddler JSON object keyed by the plugin's
// title, containing the envelope metadata from plugin.info plus the
// bundled content as `text`.
const fs = require('node:fs')
const path = require('node:path')

const args = process.argv.slice(2)
const outputDir = args[0] || 'output'

const infoPath = path.join('wiki', 'plugins', 'json-convert', 'plugin.info')
const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'))
const textPath = path.join(outputDir, 'plugin.json')
const text = fs.readFileSync(textPath, 'utf8')

const tiddler = {
  ...info,
  type: 'application/json',
  text
}

const wrapper = { [info.title]: tiddler }
fs.writeFileSync(
  textPath,
  JSON.stringify(wrapper, null, 2) + '\n',
  'utf8'
)
console.log(`Plugin: ${info.title} v${info.version} → ${textPath}`)
