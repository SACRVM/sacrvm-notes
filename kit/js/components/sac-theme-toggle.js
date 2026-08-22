/**
 * <sac-theme-toggle>
 *
 * Self-contained three-way pill switch for the page theme: Dark / Light /
 * Auto. Reads/writes localStorage and flips document.documentElement's
 * data-theme itself — drop one instance anywhere (typically the sac-nav
 * "context" slot) and it themes the whole page. Buttons are shadow-internal;
 * nothing here is slotted.
 *
 * Semantics:
 *   dark  — removes data-theme from <html> (the kit's default ground).
 *   light — <html data-theme="light">.
 *   auto  — <html data-theme="auto"> (caller/CSS decides what "auto" means).
 *
 * Persistence: localStorage key "sac-theme" holds "light" or "auto"; any
 * other value — including no key at all — means dark, and choosing "dark"
 * is stored by removing the key rather than writing it.
 *
 * On connect: reads the stored theme, applies it, and highlights the
 * matching button.
 *
 * Properties:
 *   theme — get/set "dark" | "light" | "auto". Setting applies + persists
 *           + re-highlights the pill; it does not dispatch the change
 *           event (that's reserved for user clicks, same split as
 *           sac-slider's attribute-vs-interaction event model).
 *
 * Events:
 *   sac:change — fired on user click only (never on a programmatic .theme set);
 *                detail = { value: theme }, bubbles (not composed).
 */
(function () {

    /** Kit i18n: sac.t when globals.js is loaded, the English fallback when
     *  the component runs standalone. */
    const t = (key, fallback) =>
        (window.sac && window.sac.t) ? window.sac.t(key, fallback) : fallback;

class SacThemeToggle extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this._theme = "dark";
    }

    connectedCallback() {
        if (!this.shadowRoot.firstChild) this._render();
        const stored = localStorage.getItem("sac-theme");
        const theme = stored === "light" || stored === "auto" ? stored : "dark";
        this._apply(theme);
        this._theme = theme;
        this._highlight(theme);
    }

    get theme() { return this._theme; }
    set theme(v) {
        const theme = v === "light" || v === "auto" ? v : "dark";
        this._apply(theme);
        this._persist(theme);
        this._theme = theme;
        this._highlight(theme);
    }

    _apply(theme) {
        const root = document.documentElement;
        if (theme === "light") root.setAttribute("data-theme", "light");
        else if (theme === "auto") root.setAttribute("data-theme", "auto");
        else root.removeAttribute("data-theme");
    }

    _persist(theme) {
        if (theme === "dark") localStorage.removeItem("sac-theme");
        else localStorage.setItem("sac-theme", theme);
    }

    /** Update the active button in place — no re-render. */
    _highlight(theme) {
        this.shadowRoot.querySelectorAll("button").forEach((btn) => {
            const active = btn.dataset.theme === theme;
            btn.classList.toggle("active", active);
            btn.setAttribute("aria-pressed", String(active));
        });
    }

    _select(theme) {
        this._apply(theme);
        this._persist(theme);
        this._theme = theme;
        this._highlight(theme);
        // Value control (the picked theme). Only _select() — a user click —
        // dispatches; the `theme` setter (used by apps.js to SYNC the toggle)
        // stays silent, or that sync would loop. Bubbles, not composed.
        this.dispatchEvent(new CustomEvent("sac:change", {
            detail: { value: theme },
            bubbles: true,
            composed: false,
        }));
    }

    _render() {
        // Kit strings land in TEXT positions of the template below.
        const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
        const L = {
            dark:  esc(t("theme-toggle.dark",  "Dark")),
            light: esc(t("theme-toggle.light", "Light")),
            auto:  esc(t("theme-toggle.auto",  "Auto")),
        };
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: inline-flex; }
                .pill {
                    display: inline-flex;
                    gap: 4px;
                    background: var(--field);
                    /* Same hairline as sac-segmented-control: keeps the track
                       visible on light ground so the inset active segment
                       reads as inset, not shorter. */
                    border: 1px solid var(--border);
                    border-radius: var(--radius-m);
                    padding: 2px;
                }
                button {
                    appearance: none;
                    border: none;
                    background: none;
                    cursor: pointer;
                    font: inherit;
                    font-size: 0.72rem;
                    font-weight: 600;
                    padding: 4px 10px;
                    border-radius: var(--radius-s);
                    color: var(--text-muted);
                    transition: color 0.15s var(--ease-smooth), background 0.15s var(--ease-smooth);
                }
                button:hover { color: var(--text); }
                button.active {
                    background: var(--accent-fill);
                    color: var(--on-accent);
                }
                @media (prefers-reduced-motion: reduce) {
                    button { transition: none; }
                }
            </style>
            <div class="pill">
                <button type="button" data-theme="dark">${L.dark}</button>
                <button type="button" data-theme="light">${L.light}</button>
                <button type="button" data-theme="auto">${L.auto}</button>
            </div>
        `;
        this.shadowRoot.querySelectorAll("button").forEach((btn) => {
            btn.addEventListener("click", () => this._select(btn.dataset.theme));
        });
    }
}

customElements.define("sac-theme-toggle", SacThemeToggle);
})();
