#!/usr/bin/env node
// Copy the version from package.json into each plugin's plugin.info so
// TiddlyWiki bundles the plugin envelopes with the right version field.
// Idempotent — safe to run as a npm "version" hook and as part of any
// build script.
const fs = require('node:fs')
const path = require('node:path')

const { plugins } = require('./plugins.js')
const pkg = require('../package.json')

plugins.forEach(({ dir }) => {
  const infoPath = path.join(dir, 'plugin.info')
  const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'))
  if (info.version === pkg.version) return
  info.version = pkg.version
  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2) + '\n', 'utf8')
  console.log(`sync-version: ${infoPath} → ${pkg.version}`)
})
