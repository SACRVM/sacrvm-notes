# Notes

A notes app built as a [SACRVM APPKIT](https://github.com/SACRVM/sacrvm-appkit) app:
one custom element, one classic script, no build step. Write notes, keep them,
link to them — the note list is the app's own rail, and every note has its own URL.

## What it does

| | |
| --- | --- |
| Notes | Create, edit and delete. Newest first; the order never shuffles while you type. |
| Autosave | Debounced 400 ms, plus on blur, on note switch and on leaving the page. No save button to forget. |
| Addressable | Each note is a route. Rail links, the back button and pasted links all land on the right note. |
| Delete | Asks first — `sac.dialog` where the kit is loaded, the browser's `confirm()` otherwise. |
| Storage | `context.fs` — one path per note (`notes/<id>`) plus an explicit `order`, so editing rewrites one note and not the collection. The pre-`context.fs` key (`sacrvm.notes.v1`) migrates on first run, and is still the fallback on a host that grants no storage. |

The title is a real field; when it is empty the rail falls back to the note's
first written line, then to "Untitled".

## Run it

```bash
npx serve .        # http://localhost:3000
```

`index.html` is the harness: it loads the vendored kit (`kit/`, the release
copy — `kit/VERSION` says which) and provides nothing else — the app is
complete and draws its own chrome (nav + rail). F5 to develop.

## Install it on a desktop

The app is a `kind: "view"` app — it takes the stage and draws its whole
chrome; the desktop injects its presence through `context.host` (the ⌂
jump-home, the suite's nav group, host toolbar controls), and the app's own
nav renders it. Register it with the manifest in `app.json`:

```js
sac.apps.register({
    id:    "notes",
    name:  "Notes",
    icon:  "note",
    kind:  "view",
    tag:   "app-notes",
    src:   "https://example.com/sacrvm-notes/app.js",   // app.json's "entry"
});
sac.apps.init();
```

The shell then owns the address space: notes live at `#/notes/<id>` there and
at `#/<id>` standalone. The app builds no hash itself — it asks
`context.href()` — so the same file works in both places unchanged.

## License

MIT — see [LICENSE](LICENSE).
