const clearByPrefix = (wiki, prefix) => {
  const stale = []
  wiki.each((tiddler, title) => {
    if (title.indexOf(prefix) === 0) stale.push(title)
  })
  stale.forEach((t) => wiki.deleteTiddler(t))
}

exports.clearByPrefix = clearByPrefix
