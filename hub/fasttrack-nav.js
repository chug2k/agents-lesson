/* Fast Track shared nav strip.
 * Each site includes:  <script src="https://<hub-host>/fasttrack-nav.js" data-track="vibecoding|skills|agents" defer></script>
 * Renders a slim Trailhead-styled bar above the site's own header. Styles are
 * scoped inside a shadow root so host-site CSS can't leak in (or out).
 */
(() => {
  const HUB_URL = "/"; // same-origin when proxied; replace with hub host if sites stay on separate subdomains
  const SITES = {
    vibecoding: { label: "Vibe Coding", url: "/vibecoding/" },
    skills: { label: "Skills Series", url: "/skills/" },
    agents: { label: "Agents", url: "/agents/" },
  };
  const current = document.currentScript?.dataset?.track || "";

  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; display: block; }
      .bar {
        display: flex; align-items: center; gap: 16px;
        padding: 0 24px; height: 44px;
        background: #ffffff; border-bottom: 1px solid #E7E9ED;
        font: 600 13px/1 "IBM Plex Mono", ui-monospace, monospace;
      }
      a { text-decoration: none; }
      .wordmark { color: #162950; font-family: "Manrope", -apple-system, sans-serif; font-size: 15px; font-weight: 700; }
      .wordmark span { color: #1075DC; }
      .tracks { display: flex; gap: 4px; flex: 1; min-width: 0; overflow-x: auto; }
      .tracks a { color: #646E82; padding: 6px 10px; border-radius: 8px; white-space: nowrap; }
      .tracks a:hover { color: #1075DC; background: #DCF2FA; }
      .tracks a[aria-current="true"] { color: #1075DC; background: #DCF2FA; }
      @media (prefers-color-scheme: dark) {
        .bar { background: #23201a; border-bottom-color: rgba(255,255,255,.09); }
        .wordmark { color: #f4efe4; }
        .wordmark span, .tracks a:hover, .tracks a[aria-current="true"] { color: #2dd4bf; }
        .tracks a { color: #a89e8c; }
        .tracks a:hover, .tracks a[aria-current="true"] { background: #123c39; }
      }
    </style>
    <nav class="bar" aria-label="Fast Track programs">
      <a class="wordmark" href="${HUB_URL}">Anduin <span>AI Learning</span></a>
      <div class="tracks">
        ${Object.entries(SITES)
          .map(
            ([key, s]) =>
              `<a href="${s.url}" ${key === current ? 'aria-current="true"' : ""}>${s.label}</a>`
          )
          .join("")}
      </div>
    </nav>`;
  document.body.prepend(host);
})();
