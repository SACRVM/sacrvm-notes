/**
 * <sac-section title="FILTERS">
 *   …controls…
 * </sac-section>
 *
 * Sidebar group separator with uppercase title + thin border.
 *
 * Attributes:
 *   title — uppercase heading text.
 */
class SacSection extends HTMLElement {
    static get observedAttributes() { return ["title"]; }

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    connectedCallback()        { this.render(); }
    attributeChangedCallback() { this.render(); }

    render() {
        const title = this.getAttribute("title") || "";
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    margin-bottom: 1.5rem;
                }
                .title {
                    font-family: 'Outfit', sans-serif;
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    color: var(--text-dim);
                    text-transform: uppercase;
                    margin-bottom: 0.75rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid var(--border);
                }
                .body {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
            </style>
            <div class="title">${title}</div>
            <div class="body"><slot></slot></div>
        `;
    }
}

customElements.define("sac-section", SacSection);
