# JSON Convert

A TiddlyWiki plugin that converts arbitrary JSON into tiddlers, with
reusable mapping profiles, a preview-and-commit staging area, and
tolerant input handling.

## Try the demo

The repository ships its own demo wiki via GitHub Pages, containing
the plugin plus a handful of sample data files and matching mapping
profiles.

- Current release: `docs/index.html`
- Latest dev build: `docs/latest.html`
- Versioned archive: `docs/<version>/index.html`

(Once GitHub Pages is configured for the repo, those become live URLs
under `https://<user>.github.io/<repo>/`.)

## Install in your own wiki

1. Open the demo wiki.
2. Drag the tiddler `$:/plugins/crosseye/json-convert` onto your own
   wiki.
3. Save.

A convert icon appears in your wiki's page-controls toolbar — click
it to open the Console.

Alternatively, download `docs/<version>/plugin.json` and drop it onto
a wiki manually.

## Key features

- **Mapping profiles** — small JSON documents that describe how each
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
- **Tolerant parser** — strips BOMs and trailing junk with a
  recovery warning; coerces numerics; reports each error/warning
  with its record index.
- **Staging area** — every conversion lands in a preview area first.
  Skip / overwrite / rename actions per row before committing.
- **Form-based profile editor** — display-mode rows with inline
  editing, browse-modal path picker, click-to-fill transforms,
  revert-to-backup, and debounced live writes.
- **Imported tiddler audit log** — a per-session list of every
  tiddler the importer has written, clickable to navigate.

## Development

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
npm run build:plugin    # writes output/plugin.json (the draggable envelope)
```

### Releases

```sh
npm run bump:patch      # 0.8.0 → 0.8.1, syncs plugin.info, commits, tags, pushes
npm run bump:minor      # 0.8.0 → 0.9.0
npm run bump:major      # 0.8.0 → 1.0.0
```

A pushed tag (`v*`) triggers `.github/workflows/release.yml`, which:

- Builds the wiki to `docs/<version>/index.html`
- Copies that to `docs/index.html` (the published-canonical version)
- Saves the plugin envelope to `docs/<version>/plugin.json`
- Commits all three back to `main` with `[skip ci]`

Pushes to `main` rebuild `docs/latest.html` only.

## Repository layout

```
wiki/                       The TiddlyWiki edition built by `npm run build`
  tiddlywiki.info           Wiki configuration + build targets
  tiddlers/                 Demo wiki content (samples, overview, settings)
  plugins/json-convert/     Plugin contents (engine, widgets, filters, UI, styles)
test/                       Node --test test suite for the pure-JS engine
tools/                      Build helpers (version sync, plugin envelope packing)
docs/                       Published GitHub Pages output
```

## License

[MIT](LICENSE).  Copyright (c) 2026 Scott Sauyet.
