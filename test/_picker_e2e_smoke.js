const path = require('node:path')
const $tw = require(path.join(process.cwd(), 'vendor/tiddlywiki/boot/boot.js')).TiddlyWiki()
$tw.boot.argv = [path.join(process.cwd(), 'wiki')]
$tw.boot.boot(() => {
  const wiki = $tw.wiki
  const sourceTitle = '$:/state/json-convert/source'
  const draftBase = '$:/state/json-convert/editor/draft/'
  const stateTitle = '$:/state/json-convert/editor/picker'
  const snapTitle = '$:/state/json-convert/editor/picker-open-snapshot'

  // Pre-load the Reading List demo data
  const sample = wiki.getTiddlerText('Example Reading List Data') || ''
  wiki.addTiddler({ title: sourceTitle, type: 'application/json', text: sample })

  // Seed a STARTER profile that has only `title` defined; no
  // pass-throughs yet.  Picker should show all leaves as untickable.
  wiki.addTiddler({ title: `${draftBase}records`, text: '{{[*]}}' })
  wiki.addTiddler({
    title: `${draftBase}tw-fields-keys`,
    list: $tw.utils.stringifyList(['title'])
  })
  wiki.addTiddler({
    title: `${draftBase}tw-fields/title`,
    value: '{{title}}'
  })
  wiki.addTiddler({
    title: `${draftBase}custom-fields-keys`,
    list: ''
  })

  const open = () => $tw.rootWidget.invokeActionString(
    `<$json-convert-picker-init source-title="${sourceTitle}" records-path="{{[*]}}" draft-base="${draftBase}" state-title="${stateTitle}" snapshot-title="${snapTitle}"/>`,
    $tw.rootWidget, null, {})
  const apply = () => $tw.rootWidget.invokeActionString(
    `<$json-convert-picker-apply draft-base="${draftBase}" state-title="${stateTitle}" snapshot-title="${snapTitle}" source-title="${sourceTitle}" records-path="{{[*]}}"/>`,
    $tw.rootWidget, null, {})
  const showCF = () => {
    const keys = $tw.utils.parseStringArray(
      (wiki.getTiddler(`${draftBase}custom-fields-keys`) || { fields: {} }).fields.list || ''
    )
    const out = {}
    for (const k of keys) {
      const t = wiki.getTiddler(`${draftBase}custom-fields/${k}`)
      out[k] = t ? t.fields.value : '<missing>'
    }
    return out
  }
  const showState = () => wiki.getTiddlerText(stateTitle) || '{}'

  console.log('=== Round 1: open picker, no existing pass-throughs ===')
  open()
  console.log('initial state:', showState())
  console.log('initial custom-fields:', showCF())

  console.log('=== Round 2: tick author + year, apply ===')
  wiki.addTiddler({
    title: stateTitle,
    type: 'application/json',
    text: JSON.stringify({ author: 'author', year: 'year' }, null, 2)
  })
  apply()
  console.log('post-apply custom-fields:', showCF())

  console.log('=== Round 3: reopen picker — should pre-tick author + year ===')
  open()
  console.log('reopened state:', showState())

  console.log('=== Round 4: untick year (delete from state), apply ===')
  wiki.addTiddler({
    title: stateTitle,
    type: 'application/json',
    text: JSON.stringify({ author: 'author' }, null, 2)
  })
  apply()
  console.log('post-untick custom-fields:', showCF())

  console.log('=== Round 5: simulate user customizing author binding before next apply ===')
  wiki.addTiddler({
    title: `${draftBase}custom-fields/author`,
    value: '{{author|to-upper-case}}'
  })
  open()
  console.log('open state (author should NOT be ticked, customized):', showState())
  // User unticks (simulate empty state) — apply must NOT delete the customized binding
  wiki.addTiddler({
    title: stateTitle, type: 'application/json', text: '{}'
  })
  apply()
  console.log('post-apply (customized author should survive):', showCF())
})
