// The plugins this repository builds, in dependency order.  `dir` is
// the source folder, `out` the file name --savetiddler writes into the
// output directory (see the "plugin" build in wiki/tiddlywiki.info).
const path = require('node:path')

const pluginDir = (name) => path.join('wiki', 'plugins', name)

exports.plugins = [
  { dir: pluginDir('json-convert'), out: 'plugin.json' },
  { dir: pluginDir('json-convert-studio'), out: 'studio.json' }
]
