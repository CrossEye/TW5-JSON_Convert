<h1 align="center">
  <img src="assets/logo.svg" width="96" alt="" /><br>
  JSON Convert
</h1>

<p align="center">
  TiddlyWiki plugins that turn arbitrary JSON into tiddlers, with
  reusable profiles, a preview-and-commit staging area, tolerant
  input handling — and a generator that bakes a profile into a small
  <em>importer</em> plugin anyone can use without seeing any of that.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="#"><img src="https://img.shields.io/badge/TiddlyWiki-%E2%89%A55.4.0-orange.svg" alt="TiddlyWiki ≥5.4.0"></a>
  <a href="#-development"><img src="https://img.shields.io/badge/tests-277%20passing-brightgreen.svg" alt="tests"></a>
</p>

---

## 🌐 &nbsp;Try the demo

The repository ships its own demo wiki via GitHub Pages, containing
the plugin plus a handful of sample data files and matching
profiles.

- **Current release**: <https://crosseye.github.io/TW5-JSON_Convert/>
- **Latest dev build**: <https://crosseye.github.io/TW5-JSON_Convert/latest.html>
- **Versioned archive**: `https://crosseye.github.io/TW5-JSON_Convert/<version>/`

## 📦 &nbsp;Install in your own wiki

JSON Convert is two plugins:

- `$:/plugins/crosseye/json-convert` — the **runtime**: the conversion
  engine and the panels that run it.  This is all a recipient of an
  importer needs.
- `$:/plugins/crosseye/json-convert-studio` — the **studio**: the
  Console, the profile editor and pickers, the importer generator, and
  the full usage guide.  Needs the runtime.

1. Open the demo wiki.
2. Drag both tiddlers onto your own wiki (the runtime first, or together).
3. Save and reload.

A convert icon appears in your wiki's page-controls toolbar — click
it to open the Console — and a **Studio** entry in the sidebar contents.

Alternatively, download `docs/<version>/plugin.json` (runtime) and
`docs/<version>/studio.json` (studio) and drop them onto a wiki.

Upgrading from 0.10.x: dragging in the 0.11 runtime replaces the old
single plugin, which takes the editor with it; add the studio to get it
back.

### Importers

An **importer** is a plugin the studio generates from one profile: a
page with a box to paste JSON into, a button that stages the result, a
review list, and a button that applies it.  No profiles, paths or
transforms are visible.  Generate one with *Generate importer…* beside
any profile, download it alone or bundled with the runtime, and hand it
over.  The demo ships two under *More › Importers*; the Importer Guide
in the demo walks the whole thing end to end.

## ✨ &nbsp;Key features

- **Importers** — bake a tested profile into a small plugin with one
  page and two buttons, for people who will never open the Console.
  Ships a sample, a readme and a shape fingerprint, and tells the
  recipient in plain words when their JSON does not fit.
- **Profiles** — small JSON documents that describe how each
  source record maps to a tiddler (`title`, `text`, `tags`, plus
  arbitrary custom fields).
- **Per-token transforms** — `{{name|slugify}}-{{id}}` chains
  transforms left-to-right inside any template token.
- **User-defined transforms** — drop a tiddler tagged
  `$:/tags/json-convert/transform` (JS function body, `value` in
  scope) and it appears in the Browse modal's transform picker.
- **Nested records and ancestor scopes** — `{{groups[*].items[*]}}`
  iterates every leaf item, and bindings can reach enclosing scopes
  via `../field` and `../../field`.
- **Source normalization** — one checkbox flattens "reified"
  sources that report every field as its own
  `{"key": …, "value": …}` object, so ordinary bindings and the
  field picker work against them.  Saved with the profile.
- **Tolerant parser** — strips BOMs and trailing junk with a
  recovery warning; coerces numerics; reports each error/warning
  with its record index.
- **Staging area** — every conversion lands in a preview area first.
  Skip / overwrite / rename actions per row before committing.
- **Form-based profile editor** — display-mode rows with inline
  editing, browse-modal path picker, click-to-fill transforms,
  revert-to-backup, and debounced live writes.
- **Pass-through field picker** — for wide source schemas, tick
  the leaves you want from a checkbox tree of the source's shape,
  apply, and the editor inserts pass-through bindings for each.
- **Imported tiddler audit log** — a per-session list of every
  tiddler the importer has written, clickable to navigate.

## 🛠️ &nbsp;Development

Once-only setup:

```sh
npm run setup    # clones TiddlyWiki5 v5.4.0 into vendor/
```

Iteration:

```sh
npm run build    # writes output/index.html
npm test         # runs the engine test suite (node --test)
npm run start    # local TiddlyWiki server at http://localhost:8080
```

Other build targets:

```sh
npm run build:latest    # writes docs/latest.html
npm run build:plugin    # writes output/plugin.json and output/studio.json
```

### 🚀 &nbsp;Releases

```sh
npm run bump:patch      # 0.8.0 → 0.8.1, syncs plugin.info, commits, tags, pushes
npm run bump:minor      # 0.8.0 → 0.9.0
npm run bump:major      # 0.8.0 → 1.0.0
```

A pushed tag (`v*`) triggers `.github/workflows/release.yml`, which:

- Builds the wiki to `docs/<version>/index.html`
- Copies that to `docs/index.html` (the published-canonical version)
- Saves the plugin files to `docs/<version>/plugin.json` and `studio.json`
- Commits all three back to `main` with `[skip ci]`

Pushes to `main` rebuild `docs/latest.html` only.

## 🗂️ &nbsp;Repository layout

```
wiki/                       The TiddlyWiki edition built by `npm run build`
  tiddlywiki.info           Wiki configuration + build targets
  tiddlers/                 Demo wiki content (samples, overview, settings)
  plugins/json-convert/     Runtime plugin (engine, widgets, ui components, styles)
  plugins/json-convert-studio/  Studio plugin (Console, editor, generator, usage guide)
  plugins/reading-list-importer/  A hand-built importer pack, shipped with the demo
test/                       Node --test test suite for the pure-JS engine
tools/                      Build helpers (version sync, plugin envelope packing)
assets/                     Project assets (logo, etc.)
docs/                       Published GitHub Pages output
```

## ⚖️ &nbsp;License

[MIT](LICENSE).  Copyright (c) 2026 Scott Sauyet.
