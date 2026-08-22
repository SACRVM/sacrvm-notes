/**
 * <sac-chip label="work" color="blue" [removable] [selected] [clickable]>
 *
 * A coloured pill. The colour is a
 * palette SLOT NAME ("blue", "orange", …) that resolves to
 * var(--palette-<slot>). Background is a tinted color-mix, so one token per
 * slot serves fill, tint and border in both light and dark themes — and
 * persisted data can store the slot name instead of a hex, which lets a
 * re-theme shift the palette without rewriting stored records.
 *
 * Attributes:
 *   label      — display text.
 *   color      — palette slot. Defaults to "gray" if unknown.
 *   removable  — shows an × button. Click emits 'sac:remove'.
 *   selected   — filter-strip "active" state; brighter ring + saturated bg.
 *   clickable  — pointer cursor + hover affordance (filter-strip mode).
 *   disabled   — inert + dimmed; the × emits nothing.
 *
 * Properties:
 *   disabled   — get/set, reflects the attribute.
 *
 * Events:
 *   sac:remove — e.detail = { label } (only when [removable] is set),
 *                 bubbles + composed.
 */
(function () {

    /** Kit i18n: sac.t when globals.js is loaded, the English fallback when
     *  the component runs standalone. */
    const t = (key, fallback) =>
        (window.sac && window.sac.t) ? window.sac.t(key, fallback) : fallback;

class SacChip extends HTMLElement {
    static get observedAttributes() { return ["label", "color", "removable", "selected", "clickable", "disabled"]; }

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    get disabled() { return this.hasAttribute("disabled"); }
    set disabled(v) { if (v) this.setAttribute("disabled", ""); else this.removeAttribute("disabled"); }

    connectedCallback() {
        if (!this.shadowRoot.firstChild) this._render();
        else this._refresh();
    }

    attributeChangedCallback() {
        if (this.shadowRoot.firstChild) this._refresh();
    }

    _render() {
        // Remove button: tooltip and aria-label share one translation.
        const esc = (s) => String(s).replace(/"/g, "&quot;");
        const L = { remove: esc(t("chip.remove", "Remove")) };
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    --chip-color: var(--palette-gray);
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 9px;
                    border-radius: 999px;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.01em;
                    line-height: 1;
                    background: color-mix(in srgb, var(--chip-color) 18%, transparent);
                    color: var(--chip-color);
                    border: 1px solid color-mix(in srgb, var(--chip-color) 35%, transparent);
                    user-select: none;
                    transition: background 120ms, border-color 120ms, transform 80ms;
                }
                :host([disabled]) { opacity: .5; pointer-events: none; }
                :host([clickable]) { cursor: pointer; }
                :host([clickable]:hover) {
                    background: color-mix(in srgb, var(--chip-color) 30%, transparent);
                    border-color: color-mix(in srgb, var(--chip-color) 55%, transparent);
                }
                :host([selected]) {
                    /* Translucent wash, not a solid fill — the ink follows
                       the theme, not the fill. */
                    background: color-mix(in srgb, var(--chip-color) 40%, transparent);
                    border-color: var(--chip-color);
                    color: var(--text);
                    box-shadow: 0 0 0 1px color-mix(in srgb, var(--chip-color) 60%, transparent);
                }
                .label { white-space: nowrap; }
                .x {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: transparent;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    padding: 0;
                    margin-left: 2px;
                    margin-right: -3px;
                    opacity: 0.6;
                    transition: opacity 100ms, background 100ms;
                    font: inherit;
                }
                :host([removable]) .x { display: inline-flex; }
                .x:hover {
                    opacity: 1;
                    background: color-mix(in srgb, var(--chip-color) 40%, transparent);
                }
                .x svg { width: 10px; height: 10px; }
            </style>
            <span class="label"></span>
            <button type="button" class="x" title="${L.remove}" aria-label="${L.remove}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        this.shadowRoot.querySelector(".x").addEventListener("click", (e) => {
            e.stopPropagation();
            if (this.disabled) return;
            this.dispatchEvent(new CustomEvent("sac:remove", {
                detail: { label: this.getAttribute("label") || "" },
                bubbles: true, composed: true,
            }));
        });
        this._refresh();
    }

    _refresh() {
        const label = this.getAttribute("label") || "";
        const color = this.getAttribute("color") || "gray";
        const labelEl = this.shadowRoot.querySelector(".label");
        if (labelEl) labelEl.textContent = label;
        this.style.setProperty("--chip-color", `var(--palette-${color}, var(--palette-gray))`);
    }
}

customElements.define("sac-chip", SacChip);
})();
