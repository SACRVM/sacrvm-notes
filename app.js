/**
 * <app-notes> — notes as a SACRVM APPKIT app (manifest kind: "view").
 *
 * A fullscreen app: it takes the whole stage and draws no navigation of its
 * own. The note LIST is the navigation, so it is projected into the host's
 * rail (context.sidebar) — same chrome as every other app on the desktop, and
 * the harness page's own <sac-sidebar> when it runs standalone.
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

    // Storage. context.fs is the shell's reserved slot for shared storage and
    // is still null, so notes live in localStorage under one namespaced key —
    // when the shell grows an fs, these two functions are all that moves.
    const STORE_KEY = "sacrvm.notes.v1";

    function loadNotes() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
            return Array.isArray(parsed) ? parsed.filter((n) => n && typeof n.id === "string") : [];
        } catch (err) {
            console.warn("[app-notes] stored notes unreadable, starting empty:", err);
            return [];
        }
    }

    function saveNotes(notes) {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(notes));
        } catch (err) {
            console.warn("[app-notes] could not store notes:", err);
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
            // textContent, never innerHTML.
            this.innerHTML = `
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
</div>`;

            this._editor  = this.querySelector(".editor");
            this._nothing = this.querySelector(".ed-nothing");
            this._title   = this.querySelector(".ed-title");
            this._body    = this.querySelector(".ed-body");
            this._state   = this.querySelector(".ed-state");
            this._meta    = this.querySelector(".ed-meta");

            this._notes = [];
            this._current = null;
            this._saveTimer = null;

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
            this._notes = loadNotes();
            // A tab closed mid-sentence must not lose it.
            this._onLeave = () => this._flush();
            window.addEventListener("beforeunload", this._onLeave);
            // Rail clicks, the back button and pasted URLs all arrive here.
            this._offRoute = context.onRoute((route) => this._select(route));
            this._select(context.route);
        }

        onUnmount() {
            this._flush();
            if (this._offRoute) { this._offRoute(); this._offRoute = null; }
            if (this._onLeave) { window.removeEventListener("beforeunload", this._onLeave); this._onLeave = null; }
            if (this._ctx) this._ctx.sidebar.clear();
        }

        /* --------------------------------------------------------- notes -- */

        /** Show one note: flush the one being left, then re-address and repaint. */
        _select(id) {
            this._flush();
            this._current = this._notes.find((n) => n.id === id) || this._notes[0] || null;
            this._render();
            this._projectRail();
            // replaceState — moving between notes is not a new page each time.
            this._ctx.deepLink.set(this._current ? this._current.id : null);
        }

        _create() {
            this._flush();
            const now = Date.now();
            // Newest first, and the order never shuffles under the cursor:
            // the rail is stable while you type.
            this._notes.unshift({ id: newId(), title: "", body: "", created: now, updated: now });
            saveNotes(this._notes);
            this._select(this._notes[0].id);
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
                saveNotes(this._notes);
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
                saveNotes(this._notes);
                this._renderMeta();
                this._projectRail();               // the title is the rail label
            }
            this._setState("Saved");
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

        /** The rail IS the note list — heading, "New note", then the notes. */
        _projectRail() {
            if (!this._ctx) return;
            const current = this._current;
            this._ctx.sidebar.set([
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
            ]);
        }
    }

    sac.app.define("app-notes", AppNotes);
})();
