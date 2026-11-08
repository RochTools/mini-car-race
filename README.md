# Mini Car Race (PWA)

A 3D car race against an AI rival, packaged as an installable, offline-capable Progressive Web App.

## Put it online (needed to install it)
Browsers only allow installing and offline mode on **HTTPS** (or localhost). Upload this whole folder to any static host:
Netlify (drag and drop the folder at app.netlify.com/drop), Cloudflare Pages, GitHub Pages, Vercel, or your own server.
No build step is needed.

## Try it on your own computer first
    python3 -m http.server 8000      # run inside this folder, then open http://localhost:8000

## Install
- Android / Chrome / Edge: open the site, then use the **Install app** button in the menu (or the browser menu > Install app).
- iPhone / iPad (Safari): tap Share > **Add to Home Screen**.
Installed, it opens full screen in landscape with its own icon.

## Offline
Open the game once while online. The app shell, Three.js and the fonts are then cached by `sw.js`, and the game starts with no internet.

## Updating
Edit `index.html`, then change `VERSION` at the top of `sw.js` (for example `mini-car-race-v2`) so every player gets the new files.

## Files
- `index.html`  the whole game in one file
- `manifest.webmanifest`  name, icons, full-screen landscape, colours
- `sw.js`  service worker (offline cache)
- `icons/`  app icons (regular, maskable, Apple, favicon)
- `src/sim.js`, `src/main.js`  readable source that `index.html` is built from (sim.js = track, physics, AI, laps; main.js = graphics, HUD, menus, audio)

## Fully self-hosted (optional)
To avoid the CDN completely, download three@0.170.0 (`build/three.module.min.js`, `examples/jsm/`) into a `vendor/` folder,
change the `importmap` in `index.html` to `./vendor/...`, and add those files to `SHELL` in `sw.js`.
