# sacrvm-notes

A notes app, and one of the two example apps for
[SACRVM APPKIT](https://github.com/SACRVM/sacrvm-appkit). Where the calculator
shows a `window` app, this one shows a `view`: a COMPLETE app that draws its
whole chrome — its own `<sac-nav>` and its own `<sac-sidebar>` rail holding
the note list — and gives every note its own route. A desktop injects its
presence through `context.host`, which the app renders in its own nav; it
never offers the app a hull to project into. Read `README.md` first.

**One repo, one app.** The repo IS the app: `app.json` (the manifest a desktop
reads), `app.js` (one custom element, one classic script, guarded define),
`app.css`, `index.html` as a standalone harness, and `kit/` — the vendored
kit. Nothing else ships.

**No build step, ever.** Vanilla custom elements, plain CSS, `npx serve .` and
F5 — no node_modules, no bundler, no TypeScript.

**The kit is vendored** (autark, decided 2026-08-22): `kit/` is the release
copy, dropped in verbatim — `kit/VERSION` says which — and never edited here;
upgrading is "delete `kit/`, unzip the new release". `index.html` links the
local `kit/css/ui.css` and `kit/js/all.js`, never a CDN. See the appkit's
`CONSUMING.md`.
Use only the kit's documented API and its tokens — no raw colours, `--accent`
seeded on the app element, everything else derived from it. Notes live in
`context.fs` — one path per note plus an explicit `order` — with the old
`localStorage` key as both the migration source and the fallback for a host
that grants no storage. Never write to `localStorage` directly again: that
opts out of every host offering something better. GitHub Pages serves this
repo, and a desktop installs the app by
reading `app.json` from that origin: whatever is committed here is what people
install.

## Firepit inbox

At the start of a session, read any pending messages in `.firepit/inbox/*.md` — cross-project notes Firepit routes here. Act on each, then mark it done with the `firepit_inbox_complete` MCP tool, passing the message's filename as the `id`.

## Firepit knowledge

Before researching something that may already be known, query the knowledge base with the `firepit_knowledge_search` MCP tool (scope `both` covers this project plus the global base). Save durable findings with `firepit_knowledge_add` — written in English, per the indexing convention. The created markdown files live under `.firepit/knowledge/` and are committed like any other file.

## Firepit pinned knowledge

@.firepit/knowledge-pinned.md

The import above auto-loads the knowledge docs marked `pin: true` in their frontmatter — always-on rules that apply every session without a search. Firepit regenerates the file from the pinned docs; don't edit it directly. Pin/unpin via the pinned flag on `firepit_knowledge_add` / `firepit_knowledge_update`, and keep the pinned set small — everything else stays reachable through `firepit_knowledge_search`.

## Firepit artifacts

When you produce a file the user will want to open — a report, screenshot, diagram, generated image, log excerpt, build output, or an executable you built for them to run — pin it with the `firepit_artifact_add` MCP tool so it appears in the project's paperclip pane. Do this as you produce it, not at the end of the session; a path buried in scrollback is a path the user has to hunt for. Pinning only links the file — it stays where it is, and `firepit_artifact_remove` never deletes it. Check `firepit_artifact_list` first so you update an existing entry instead of piling up near-duplicates, and unpin what has gone stale.

## Firepit conventions

<!-- claude-firepit-fragments -->

@../.firepit/projects/claude.md
@../.firepit/projects/claude-github-public.md

The two imports above are shared files in the Firepit central repo — edit them there and every project follows. They carry policy; the tools themselves are described by Firepit's MCP server at the handshake, so nothing is duplicated between the two.
