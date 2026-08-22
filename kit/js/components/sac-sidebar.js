/**
 * <sac-sidebar></sac-sidebar>
 *
 * A left rail — the APP'S OWN chrome. The app puts the element in its own
 * markup and assigns `items`; nothing is projected from anywhere. One rail,
 * one look, and the app that draws it owns it (the same inversion as the
 * toolbar: a host injects context into an app, it never offers the app a
 * hull).
 *
 * With no items the rail hides itself.
 *
 * Property:
 *   items — array, re-renders on assignment:
 *     { label, icon?, href?, onClick?, active?, disabled? }
 *     { section }   — a group heading on its own
 *
 * Attributes:
 *   width — rail width, default 220px. Also settable via the
 *           --sidebar-width custom property.
 *
 * Layout contract: the rail is a normal flex child — put it inside
 * .main-layout (which already clears the fixed <sac-nav>), beside your
 * scrolling content (.app-scroll).
 */
(function () {

    /** Kit i18n: sac.t when globals.js is loaded, the English fallback when
     *  the component runs standalone. */
    const t = (key, fallback) =>
        (window.sac && window.sac.t) ? window.sac.t(key, fallback) : fallback;

class SacSidebar extends HTMLElement {
    static get observedAttributes() { return ["width"]; }

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this._items = [];
    }

    connectedCallback() {
        if (!this.shadowRoot.firstChild) this._render();
        this._syncWidth();
        this.renderSidebar();
    }

    attributeChangedCallback() {
        if (this.shadowRoot.firstChild) this._syncWidth();
    }

    get items() { return this._items; }
    set items(v) {
        this._items = Array.isArray(v) ? v : [];
        if (this.shadowRoot.firstChild) this.renderSidebar();
    }

    _syncWidth() {
        const w = this.getAttribute("width");
        if (w) this.style.setProperty("--sidebar-width", w);
        else   this.style.removeProperty("--sidebar-width");
    }

    /**
     * Rewrites the list from this.items. Called by the setter and on
     * connect. In-place: the rail never re-renders its own shell.
     */
    renderSidebar() {
        const list = this.shadowRoot.getElementById("list");
        if (!list) return;
        const items = this._items;

        // Empty rail = no rail. Hidden rather than removed, so a later
        // assignment fills it again without the app re-laying anything out.
        this.toggleAttribute("hidden", items.length === 0);
        if (!items.length) { list.replaceChildren(); return; }

        list.replaceChildren(...items.map((item) => {
            if (item.section != null && item.label == null) {
                const h = document.createElement("div");
                h.className = "section";
                h.textContent = item.section;
                return h;
            }
            // A link when the item has an address, a button when it has an
            // action — never a link that only runs script (no dead controls).
            const el = document.createElement(item.href ? "a" : "button");
            el.className = "item" + (item.active ? " active" : "");
            if (item.href) {
                el.href = item.href;
            } else {
                el.type = "button";
                if (item.onClick) el.addEventListener("click", (e) => item.onClick(e));
            }
            if (item.disabled) {
                el.setAttribute("aria-disabled", "true");
                if (el.tagName === "BUTTON") el.disabled = true;
            }
            if (item.active) el.setAttribute("aria-current", "true");
            if (item.icon && window.sac?.icons) {
                const icon = document.createElement("sac-icon");
                icon.setAttribute("name", item.icon);
                el.appendChild(icon);
            }
            const span = document.createElement("span");
            span.textContent = item.label == null ? "" : String(item.label);
            el.appendChild(span);
            return el;
        }));
    }

    _render() {
        this.shadowRoot.innerHTML = `
            <style>
                *, *::before, *::after { box-sizing: border-box; }

                :host {
                    --sidebar-width: 220px;
                    display: flex;
                    flex-direction: column;
                    flex: none;
                    width: var(--sidebar-width);
                    background: var(--panel);
                    border-right: 1px solid var(--border);
                    overflow-y: auto;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    z-index: 90;
                }
                :host([hidden]) { display: none; }

                nav {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    padding: 0.75rem;
                }

                .section {
                    margin: 0.9rem 0 0.25rem 0.5rem;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-dim);
                }
                .section:first-child { margin-top: 0.15rem; }

                .item {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    width: 100%;
                    padding: 0.45rem 0.6rem;
                    border: none;
                    border-radius: var(--radius-m);
                    background: none;
                    color: var(--text-muted);
                    font: inherit;
                    font-size: 0.85rem;
                    text-align: left;
                    text-decoration: none;
                    cursor: pointer;
                    --icon-size: 16px;
                    transition: background 0.15s var(--ease-smooth),
                                color 0.15s var(--ease-smooth);
                }
                .item:hover { background: var(--hover); color: var(--text); }
                .item:focus-visible {
                    outline: 2px solid var(--accent);
                    outline-offset: -2px;
                }
                /* Active item: accent tint + accent text — no edge stripe
                   (kit rule: no thick colored borders on rounded surfaces). */
                .item.active {
                    background: var(--accent-tint);
                    color: var(--accent-text);
                    font-weight: 600;
                }
                .item[aria-disabled="true"] {
                    opacity: 0.45;
                    cursor: not-allowed;
                }
                .item span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

                @media (prefers-reduced-motion: reduce) {
                    .item { transition: none; }
                }
            </style>
            <nav id="list" aria-label="${String(t("sidebar.label", "Sections")).replace(/"/g, "&quot;")}"></nav>
        `;
    }
}

customElements.define("sac-sidebar", SacSidebar);
})();
