#!/usr/bin/env node
// Copy the version from package.json into the plugin's plugin.info so
// TiddlyWiki bundles the plugin envelope with the right version field.
// Idempotent — safe to run as a npm "version" hook and as part of any
// build script.
const fs = require('node:fs')
const path = require('node:path')

const pkg = require('../package.json')
const infoPath = path.join(
  'wiki', 'plugins', 'json-convert', 'plugin.info'
)

const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'))
if (info.version === pkg.version) {
  process.exit(0)
}
info.version = pkg.version
fs.writeFileSync(infoPath, JSON.stringify(info, null, 2) + '\n', 'utf8')
console.log(`sync-version: plugin.info → ${pkg.version}`)
