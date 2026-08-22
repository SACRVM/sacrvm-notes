/**
 * <app-notes> — notes as a SACRVM APPKIT app (manifest kind: "view").
 *
 * A fullscreen app, COMPLETE: it draws its whole chrome — its own <sac-nav>
 * and its own <sac-sidebar> rail. The note LIST is the navigation, and the
 * rail that shows it belongs to the app. A host injects its presence through
 * context.host — the full package { name, icon, href, nav, toolbar } — and
 * the app hands it to its own nav, which renders the "⌂ HOST ·" jump, the
 * suite's nav group in the burger panel and the host's toolbar controls;
 * standalone context.host is null and nothing is injected.
 *
 * Every note is an address. The rail links are built with context.href(), the
 * selection is published with context.deepLink.set(), and context.onRoute()
 * brings the back button and pasted links back in. The app never builds a
 * hash by hand: on a desktop a note lives at "#/notes/<id>", standalone at
 * "#/<id>", and the host owns that difference.
 *
 * Editing autosaves (debounced) — there is no save button to forget.
 */
(function () {
    const BASE = sac.app.base();

    /* ----------------------------------------------------------- storage --
       Notes live in context.fs — storage the host grants, scoped to this app,
       async so that a host backing it with something other than localStorage
       changes nothing here. The layout is one path per note plus an explicit
       order, because the rail's order is the app's decision, not the sort
       order of a list of ids:

           order        ["n1ab", "n1cd", …]      newest first
           notes/<id>   { id, title, body, created, updated }

       Editing therefore rewrites one note, not the whole collection.

       A host may grant no storage at all (context.fs === null) — then the app
       falls back to the single localStorage key it used before, which is also
       what it migrates from on first run. An app checks; it never assumes. */

    const LEGACY_KEY = "sacrvm.notes.v1";

    function readLegacy() {
        try {
            const parsed = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
            return Array.isArray(parsed) ? parsed.filter((n) => n && typeof n.id === "string") : [];
        } catch (err) {
            console.warn("[app-notes] stored notes unreadable, starting empty:", err);
            return [];
        }
    }

    function writeLegacy(notes) {
        try {
            localStorage.setItem(LEGACY_KEY, JSON.stringify(notes));
        } catch (err) {
            console.warn("[app-notes] could not store notes:", err);
        }
    }

    /** The four writes this app needs, over whichever storage it was given. */
    function makeStore(fs) {
        if (!fs) {
            let cache = [];
            return {
                async load() { cache = readLegacy(); return cache.slice(); },
                async save(note) {
                    const i = cache.findIndex((n) => n.id === note.id);
                    if (i === -1) cache.unshift(note); else cache[i] = note;
                    writeLegacy(cache);
                },
                async remove(id) {
                    cache = cache.filter((n) => n.id !== id);
                    writeLegacy(cache);
                },
                async setOrder(notes) { cache = notes.slice(); writeLegacy(cache); },
            };
        }

        return {
            async load() {
                await migrate(fs);
                const order = await fs.read("order", []);
                const paths = await fs.list("notes/");
                const ids = paths.map((p) => p.slice("notes/".length));
                // The order document decides; anything it does not mention (a
                // half-written earlier session, another tab) is appended rather
                // than dropped. Storage is the user's data — never lose a note
                // over bookkeeping.
                const seen = new Set(order);
                const all = order.filter((id) => ids.includes(id))
                                 .concat(ids.filter((id) => !seen.has(id)));
                const notes = await Promise.all(all.map((id) => fs.read("notes/" + id, null)));
                return notes.filter((n) => n && typeof n.id === "string");
            },
            async save(note) { await fs.write("notes/" + note.id, note); },
            async remove(id) { await fs.remove("notes/" + id); },
            async setOrder(notes) { await fs.write("order", notes.map((n) => n.id)); },
        };
    }

    /** One-time move of the pre-context.fs notes. Only into empty storage, and
     *  the old key goes only after every note arrived. */
    async function migrate(fs) {
        const legacy = readLegacy();
        if (!legacy.length) return;
        if ((await fs.list("notes/")).length) return;   // fs already has notes
        try {
            for (const note of legacy) await fs.write("notes/" + note.id, note);
            await fs.write("order", legacy.map((n) => n.id));
            localStorage.removeItem(LEGACY_KEY);
            console.info(`[app-notes] moved ${legacy.length} note(s) into context.fs`);
        } catch (err) {
            console.warn("[app-notes] migration failed, keeping the old store:", err);
        }
    }

    /** Autosave delay: long enough to not write on every keystroke, short
     *  enough that nobody ever wonders whether it saved. */
    const SAVE_DELAY = 400;

    const newId = () => "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    /** Rail width, in characters: a label that wraps to three lines is not a
     *  navigation item any more. Cut with a visible ellipsis. */
    const RAIL_LABEL_MAX = 38;
    const short = (text) =>
        text.length > RAIL_LABEL_MAX ? text.slice(0, RAIL_LABEL_MAX - 1).trimEnd() + "…" : text;

    /** What the rail calls a note: its title, else its first written line. */
    function labelOf(note) {
        const title = (note.title || "").trim();
        if (title) return short(title);
        const first = (note.body || "").split("\n").find((line) => line.trim());
        return first ? short(first.trim()) : "Untitled";
    }

    const stamp = (ms) => new Date(ms).toLocaleString(undefined, {
        dateStyle: "medium", timeStyle: "short",
    });

    /** Ask before deleting. sac.dialog rides along on a host and on any page
     *  that loads the kit; guarded, because an app must survive without it. */
    function confirmDelete(label) {
        const message = `"${label}" will be permanently deleted.`;
        if (typeof sac !== "undefined" && sac.dialog && typeof sac.dialog.confirm === "function") {
            return sac.dialog.confirm({
                title: "Delete this note?",
                message,
                buttons: [
                    { action: "cancel", label: "Cancel", kind: "default" },
                    { action: "delete", label: "Delete", kind: "destructive" },
                ],
            }).then((action) => action === "delete");
        }
        return Promise.resolve(window.confirm(message));
    }

    class AppNotes extends sac.app.Element {
        /* ---------------------------------------------------------- build -- */

        build() {
            sac.app.styles(BASE + "app.css", "app-notes-css");

            // Static markup only — every note string goes in through .value or
            // textContent, never innerHTML. The nav and the rail are the
            // app's OWN chrome; a host adds nothing but context.host.
            this.innerHTML = `
<sac-nav brand="NOTES" brand-icon="note">
    <div slot="context"><sac-theme-toggle></sac-theme-toggle></div>
</sac-nav>
<div class="main-layout">
    <sac-sidebar></sac-sidebar>
    <div class="notes">
        <section class="editor" hidden>
            <header class="ed-head">
                <input class="ed-title" type="text" placeholder="Untitled"
                       aria-label="Note title" maxlength="200" autocomplete="off">
                <div class="toolbar">
                    <span class="ed-state" role="status" aria-live="polite"></span>
                    <button type="button" class="btn ed-delete">
                        <sac-icon name="trash"></sac-icon>Delete
                    </button>
                </div>
            </header>
            <textarea class="ed-body" aria-label="Note body" placeholder="Start writing…"></textarea>
            <footer class="ed-meta"></footer>
        </section>

        <div class="empty-state ed-nothing" hidden>
            <sac-icon name="note"></sac-icon>
            <h3>No notes yet</h3>
            <p>Notes are kept in this browser, and every one of them gets a link you can paste.</p>
            <button type="button" class="btn primary ed-first">
                <sac-icon name="plus"></sac-icon>New note
            </button>
        </div>
    </div>
</div>`;

            this._nav     = this.querySelector("sac-nav");
            this._rail    = this.querySelector("sac-sidebar");
            this._editor  = this.querySelector(".editor");
            this._nothing = this.querySelector(".ed-nothing");
            this._title   = this.querySelector(".ed-title");
            this._body    = this.querySelector(".ed-body");
            this._state   = this.querySelector(".ed-state");
            this._meta    = this.querySelector(".ed-meta");

            this._notes = [];
            this._current = null;
            this._saveTimer = null;
            this._loaded = false;      // storage is async — nothing to show yet
            this._wanted = undefined;
            this._offCommands = null;  // set while the palette can reach us

            const queue = () => this._queueSave();
            const flush = () => this._flush();
            this._title.addEventListener("input", queue);
            this._body.addEventListener("input", queue);
            this._title.addEventListener("blur", flush);
            this._body.addEventListener("blur", flush);

            this.querySelector(".ed-delete").addEventListener("click", () => this._delete());
            this.querySelector(".ed-first").addEventListener("click", () => this._create());
        }

        /* ------------------------------------------------------ lifecycle -- */

        onMount(context) {
            this._ctx = context;
            // The brand links to the app's own root; the host's injected
            // presence — the ⌂ jump, the suite's nav group, host toolbar
            // controls — is the ONE thing a desktop adds to this chrome.
            // Data in, the app's own nav renders it; null standalone.
            this._nav.setAttribute("brand-href", context.href(""));
            this._nav.host = context.host;
            this._store = makeStore(context.fs);
            // A tab closed mid-sentence must not lose it.
            this._onLeave = () => this._flush();
            window.addEventListener("beforeunload", this._onLeave);
            // Rail clicks, the back button and pasted URLs all arrive here.
            this._offRoute = context.onRoute((route) => this._select(route));

            // The app owns its toolbar, so the palette does not see its
            // buttons by itself: anything keyboard-worthy registers on
            // sac.commands — and only while the app is actually on stage,
            // or another app's palette would still run ours.
            this._viz = new IntersectionObserver(([entry]) => this._setCommands(entry.isIntersecting));
            this._viz.observe(this);

            // Reading is async now, so the first paint waits for it — the
            // route that got us here is honoured once the notes are in.
            this._store.load().then((notes) => {
                this._notes = notes;
                this._loaded = true;
                // A route that arrived while reading wins over the one we
                // mounted with — the user asked for it more recently.
                this._select(this._wanted !== undefined ? this._wanted : context.route);
                this._wanted = undefined;
            }).catch((err) => {
                console.error("[app-notes] could not read the notes:", err);
                this._notes = [];
                this._loaded = true;
                this._select(null);
                if (typeof sac !== "undefined" && typeof sac.toast === "function") {
                    sac.toast("Your notes could not be read — nothing was overwritten.",
                              { kind: "error", duration: 0 });
                }
            });
        }

        onUnmount() {
            this._flush();
            if (this._offRoute) { this._offRoute(); this._offRoute = null; }
            if (this._onLeave) { window.removeEventListener("beforeunload", this._onLeave); this._onLeave = null; }
            if (this._viz) { this._viz.disconnect(); this._viz = null; }
            this._setCommands(false);
        }

        /** On stage / off stage: the palette commands follow the app. */
        _setCommands(visible) {
            if (visible) {
                if (this._offCommands || typeof sac === "undefined" || !sac.commands) return;
                const offs = [
                    sac.commands.register({
                        id:    "notes-new-note",
                        label: "New note",
                        icon:  "plus",
                        run:   () => this._create(),
                    }),
                    sac.commands.register({
                        id:    "notes-delete-note",
                        label: "Delete note",
                        icon:  "trash",
                        run:   () => { if (this._current) this._delete(); },
                    }),
                ];
                this._offCommands = () => offs.forEach((off) => off());
            } else if (this._offCommands) {
                this._offCommands();
                this._offCommands = null;
            }
        }

        /* --------------------------------------------------------- notes -- */

        /** Show one note: flush the one being left, then re-address and repaint. */
        _select(id) {
            // Nothing is readable yet: remember what was asked for instead of
            // re-addressing to "no note" and losing it.
            if (!this._loaded) { this._wanted = id; return; }
            this._flush();
            this._current = this._notes.find((n) => n.id === id) || this._notes[0] || null;
            this._render();
            this._renderRail();
            // replaceState — moving between notes is not a new page each time.
            this._ctx.deepLink.set(this._current ? this._current.id : null);
        }

        _create() {
            this._flush();
            const now = Date.now();
            // Newest first, and the order never shuffles under the cursor:
            // the rail is stable while you type.
            const note = { id: newId(), title: "", body: "", created: now, updated: now };
            this._notes.unshift(note);
            this._write(this._store.save(note).then(() => this._store.setOrder(this._notes)));
            this._select(note.id);
            this._title.focus();
        }

        _delete() {
            const note = this._current;
            if (!note) return;
            confirmDelete(labelOf(note)).then((yes) => {
                if (!yes) return;
                const index = this._notes.findIndex((n) => n.id === note.id);
                if (index === -1) return;
                this._notes.splice(index, 1);
                this._write(this._store.remove(note.id).then(() => this._store.setOrder(this._notes)));
                this._cancelSave();
                this._current = null;              // never flush a deleted note back in
                const next = this._notes[index] || this._notes[index - 1] || null;
                this._select(next ? next.id : null);
                if (typeof sac !== "undefined" && typeof sac.toast === "function") {
                    sac.toast("Note deleted.", { kind: "info" });
                }
            });
        }

        /* ------------------------------------------------------ autosave -- */

        _queueSave() {
            if (!this._current) return;
            this._setState("Saving…");
            this._cancelSave();
            this._saveTimer = setTimeout(() => { this._saveTimer = null; this._flush(); }, SAVE_DELAY);
        }

        _cancelSave() {
            if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
        }

        /** Write the fields into the current note, now. Safe to call anytime. */
        _flush() {
            this._cancelSave();
            const note = this._current;
            if (!note) return;
            if (note.title !== this._title.value || note.body !== this._body.value) {
                note.title = this._title.value;
                note.body = this._body.value;
                note.updated = Date.now();
                // One note, one write — editing never rewrites the collection.
                this._write(this._store.save(note));
                this._renderMeta();
                this._renderRail();                // the title is the rail label
            }
            this._setState("Saved");
        }

        /** Every write goes through here: storage that refuses (no room left,
         *  a host backend that is offline) must say so instead of pretending
         *  the note is safe. */
        _write(promise) {
            return promise.catch((err) => {
                console.error("[app-notes] write failed:", err);
                this._setState("Not saved");
                if (typeof sac !== "undefined" && typeof sac.toast === "function") {
                    sac.toast("This note could not be saved — copy it somewhere safe.",
                              { kind: "error", duration: 0 });
                }
            });
        }

        /* -------------------------------------------------------- render -- */

        _render() {
            const note = this._current;
            this._editor.hidden = !note;
            this._nothing.hidden = !!note;
            if (!note) return;
            this._title.value = note.title || "";
            this._body.value = note.body || "";
            this._setState("");
            this._renderMeta();
        }

        _renderMeta() {
            const note = this._current;
            this._meta.textContent = note ? "Edited " + stamp(note.updated || note.created || Date.now()) : "";
        }

        _setState(text) {
            this._state.textContent = text;
        }

        /** The rail IS the note list — heading, "New note", then the notes.
         *  It is the app's own <sac-sidebar>; nothing is projected anywhere. */
        _renderRail() {
            if (!this._ctx) return;
            const current = this._current;
            this._rail.items = [
                { section: "Notes" },
                { label: "New note", icon: "plus", onClick: () => this._create() },
                ...this._notes.map((note) => ({
                    label:  labelOf(note),
                    icon:   "note",
                    // context.href, never a hand-built hash: the host owns the
                    // address space, and standalone there is no app id in it.
                    href:   this._ctx.href(note.id),
                    active: current != null && note.id === current.id,
                })),
            ];
        }
    }

    sac.app.define("app-notes", AppNotes);
})();
