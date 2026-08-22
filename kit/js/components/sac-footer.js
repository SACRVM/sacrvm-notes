/**
 * <sac-footer brand="MY APP" version="1.0.0" link-href="https://…" link-label="GITHUB">
 *
 * Minimal branded footer. The link only renders when link-href is set —
 * a live demonstration of the no-dead-links rule (never render a control
 * that does nothing).
 *
 * Attributes:
 *   brand      — footer text (uppercase style).
 *   version    — optional version string, rendered as " · v<version>".
 *   link-href  — optional external link.
 *   link-label — text for the link (default "LINK").
 */
(function () {

    /** Kit i18n: sac.t when globals.js is loaded, the English fallback when
     *  the component runs standalone. */
    const t = (key, fallback) =>
        (window.sac && window.sac.t) ? window.sac.t(key, fallback) : fallback;

class SacFooter extends HTMLElement {
    static get observedAttributes() { return ["brand", "version", "link-href", "link-label"]; }

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    connectedCallback()        { this.render(); }
    attributeChangedCallback() { if (this.shadowRoot.firstChild) this.render(); }

    render() {
        const brand   = this.getAttribute("brand") || "";
        const version = this.getAttribute("version");
        const href    = this.getAttribute("link-href");
        const label   = this.getAttribute("link-label") || t("footer.link", "LINK");

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    text-align: center;
                    padding: 1.5rem 1rem;
                    color: var(--text-muted);
                    font-size: 0.75rem;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    border-top: 1px solid var(--border);
                    margin-top: 4rem;
                }
                a {
                    color: inherit;
                    text-decoration: none;
                    margin-left: 0.5rem;
                }
                a:hover { color: var(--accent); }
                .version { opacity: 0.7; }
            </style>
            <span>${brand}</span>
            ${version ? `<span class="version"> · v${version}</span>` : ``}
            ${href ? `<a href="${href}" target="_blank" rel="noopener">${label}</a>` : ``}
        `;
    }
}

customElements.define("sac-footer", SacFooter);
})();
