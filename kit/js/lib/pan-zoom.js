/* SACRVM APPKIT — shared synchronized pan & zoom.
 * Scroll-wheel zoom (anchored at the cursor) + left-mouse drag to pan.
 * Drives several panes from ONE shared transform so side-by-side views move
 * together. Middle-drag always pans (never conflicts with edit tools);
 * double-click resets.
 *
 * Usage (classic global, works from both classic and module scripts):
 *   const pz = sac.setupPanZoom({ panes: [{ pane: el, layer: el }, ...] });
 *   pz.reset();   // e.g. when a new image loads
 *
 * Each `layer` must fill its `pane` (position:absolute; inset:0;
 * transform-origin:0 0 — the kit's .pz-layer class does exactly this).
 */
(function () {
    if (!window.sac) { console.warn("[sac.setupPanZoom] globals.js must load first — pan/zoom unavailable."); return; }
    function setupPanZoom({ panes, minScale = 0.2, maxScale = 24, enabled, onChange }) {
        let scale = 1, tx = 0, ty = 0;
        const active = () => (typeof enabled !== 'function') || enabled();

        function apply() {
            const t = `translate(${tx}px, ${ty}px) scale(${scale})`;
            panes.forEach((p) => { p.layer.style.transform = t; });
            if (typeof onChange === 'function') onChange(scale);
        }
        function reset() { scale = 1; tx = 0; ty = 0; apply(); }

        panes.forEach(({ pane }) => {
            pane.addEventListener('wheel', (e) => {
                if (!active()) return;
                e.preventDefault();
                const rect = pane.getBoundingClientRect();
                const px = e.clientX - rect.left;
                const py = e.clientY - rect.top;
                const factor = Math.exp(-e.deltaY * 0.0015);
                const ns = Math.min(maxScale, Math.max(minScale, scale * factor));
                // Keep the point under the cursor fixed.
                tx = px - (px - tx) * (ns / scale);
                ty = py - (py - ty) * (ns / scale);
                scale = ns;
                apply();
            }, { passive: false });

            pane.addEventListener('mousedown', (e) => {
                // Left button (0) pans in pan-mode; middle button (1) pans in
                // ANY mode (industry standard: middle-drag pan never conflicts
                // with edit tools).
                if (!active() || (e.button !== 0 && e.button !== 1)) return;
                e.preventDefault();
                const sx = e.clientX, sy = e.clientY, ox = tx, oy = ty;
                pane.classList.add('grabbing');
                const move = (ev) => { tx = ox + (ev.clientX - sx); ty = oy + (ev.clientY - sy); apply(); };
                const up = () => {
                    window.removeEventListener('mousemove', move);
                    window.removeEventListener('mouseup', up);
                    pane.classList.remove('grabbing');
                };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
            });

            // Double-click resets the view.
            pane.addEventListener('dblclick', () => { if (active()) reset(); });
        });

        apply();
        return { reset, apply };
    }

    sac.setupPanZoom = setupPanZoom;
})();
