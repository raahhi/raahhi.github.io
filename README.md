# RAAHHI TOURS

Production website source and GitHub Pages build for **https://raahhi.com**.

- Authoritative deployed baseline: `source/raahhi-tours52.html`.
- `build.mjs` prerenders the route manifest into clean static HTML paths for GitHub Pages.
- The build validates the production origin, absolute canonicals, Open Graph URLs, robots.txt and the 245-URL sitemap before deployment.
- The shared JavaScript is emitted once as `/assets/app.js` so every static route does not duplicate the full application payload.
- Product/catalogue facts remain in the authoritative HTML source; generated `dist/` output is not committed.

GitHub Pages must be enabled with **Settings → Pages → Source: GitHub Actions** before the deployment job can publish.
