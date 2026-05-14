const DEFAULT_THRESHOLD = 10

const kindOf = (value) => {
  if (value === null) return 'leaf'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  return 'leaf'
}

const typeOf = (value) => {
  if (value === null) return 'null'
  return typeof value
}

const bucket = (count, parentCount) => {
  if (count >= parentCount) return 'all'
  if (count === 1) return 'one'
  if (count >= parentCount / 2) return 'most'
  return 'some'
}

const presenceFor = (count, parentCount, inArray, trackPresence) => {
  if (inArray) return undefined
  if (!trackPresence) return 'all'
  return bucket(count, parentCount)
}

const leafNode = (values, inArray, presence) => {
  const types = new Set()
  let sampleValue
  let sampleSeen = false
  for (const v of values) {
    types.add(typeOf(v))
    if (!sampleSeen && v !== undefined) {
      sampleValue = v
      sampleSeen = true
    }
  }
  return {
    kind: 'leaf',
    inArray,
    presence,
    types,
    sampleValue
  }
}

const mergeAll = (values, inArray, parentCount, trackPresence) => {
  const presence = presenceFor(values.length, parentCount, inArray, trackPresence)

  const kinds = new Set()
  for (const v of values) kinds.add(kindOf(v))

  if (kinds.size > 1) {
    return { kind: 'mixed', inArray, presence }
  }

  const [kind] = [...kinds]

  if (kind === 'leaf') {
    return leafNode(values, inArray, presence)
  }

  if (kind === 'object') {
    const allKeys = new Set()
    for (const v of values) for (const k of Object.keys(v)) allKeys.add(k)
    const children = {}
    for (const key of allKeys) {
      const childValues = []
      for (const v of values) if (key in v) childValues.push(v[key])
      children[key] = mergeAll(childValues, inArray, values.length, trackPresence)
    }
    return { kind: 'object', inArray, presence, children }
  }

  // array
  const allElements = []
  for (const v of values) for (const e of v) allElements.push(e)
  const node = { kind: 'array', inArray, presence }
  if (allElements.length > 0) {
    node.element = mergeAll(allElements, true, allElements.length, trackPresence)
  }
  return node
}

const mergeRecordShapes = (records, opts = {}) => {
  if (!Array.isArray(records) || records.length === 0) return null
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD
  const trackPresence = records.length >= threshold
  return mergeAll(records, false, records.length, trackPresence)
}

exports.mergeRecordShapes = mergeRecordShapes
exports.DEFAULT_THRESHOLD = DEFAULT_THRESHOLD
