#!/usr/bin/env node
// Boot the wiki headlessly, optionally seed tiddlers, and print one
// tiddler rendered as HTML.  A cheap regression check for the wikitext
// panels: render before a change, render after, diff.
//
//   node tools/render-tiddler.js <title> [seed.json]
//
// The seed file is a JSON array of tiddler field objects.  Keep seeded
// titles under $:/temp/ or $:/state/: the filesystem sync adaptor writes
// anything else to wiki/tiddlers/ on the way past.
const fs = require('node:fs')
const path = require('node:path')

const [title, seedPath] = process.argv.slice(2)
if (!title) {
  console.error('usage: render-tiddler.js <title> [seed.json]')
  process.exit(2)
}

const root = path.join(__dirname, '..')
const $tw = require(path.join(root, 'vendor/tiddlywiki/boot/boot.js'))
  .TiddlyWiki()
$tw.boot.argv = [path.join(root, 'wiki')]
$tw.boot.boot(() => {
  const seeds = seedPath
    ? JSON.parse(fs.readFileSync(seedPath, 'utf8'))
    : []
  seeds.forEach((fields) => $tw.wiki.addTiddler(new $tw.Tiddler(fields)))
  process.stdout.write($tw.wiki.renderTiddler('text/html', title))
})
