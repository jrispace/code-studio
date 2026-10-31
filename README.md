# Code Studio — JRiSpace

**Live:** https://codestudio.jrispace.com

Offline QR / code generator. One HTML file, no server, no network, no tracking.

**Languages:** English (default), Kreyòl, Français, Español, Português — switch in the header,
or deep-link with `?lang=ht` / `fr` / `es` / `pt`. The choice is remembered; translations live in
`src/i18n.js` (English is the source, other languages fall back key by key).

## Use

Double-click `index.html` (or open it in Chrome). Nothing to install.

- Type any text or URL — a bare domain (`example.com/promo`) gets `https://` added,
  an email gets `mailto:`.
- Pick error correction: `H` (30% recovery) is the default and is required when you
  add a center logo.
- Export **PNG** at any size (100–4000 px), **SVG** (vector, print-ready), or copy
  the image straight to the clipboard.
- Optional center logo, transparent background, custom colors.

## Build

`index.html` is generated — edit the source, then rebuild:

```bash
python3 build.py       # src/app.html + lib/qrcode.js -> index.html
```

- `src/app.html` — the app shell, styles and logic (edit this)
- `lib/qrcode.js` — qrcode-generator v1.4.4, Kazuhiko Arase, MIT
- `index.html` — standalone build, library inlined for `file://` use

## Security (A+ gate)

- Strict **hash-pinned CSP** generated at build time: `default-src 'none'`, `script-src`/`style-src`
  pin every inline block by SHA-256, `img-src 'self' data: blob:`, `connect-src 'none'`,
  `form-action 'none'`, `base-uri 'none'`, `object-src 'none'`. No `unsafe-inline`, no `unsafe-eval`.
- No inline `on*=` handlers, no `eval`, no `document.write`, no `innerHTML` with user data
  (everything passes through an `& < > " '` escaper).
- Input caps on every field (`maxlength` + code-level `slice`), chat answers stripped of control
  characters, logo upload gated on MIME type and an 8 MB ceiling.
- Zero network calls: the QR library is vendored and inlined, so `connect-src 'none'` holds.
- External links use `rel="noopener noreferrer"`; referrer policy is `strict-origin-when-cross-origin`.
- Verified with `~/scripts/ai-security-check.sh .` (0 blocking findings) and a live header check.

## Hosting

GitHub Pages from `main` / root, custom domain `codestudio.jrispace.com`.

- `CNAME` in this repo pins the custom domain for Pages.
- DNS (Cloudflare zone `jrispace.com`): `CNAME codestudio → jrispace.github.io`,
  **proxied** so Cloudflare terminates TLS with the `*.jrispace.com` Universal SSL
  certificate and forwards to GitHub over HTTPS (zone SSL mode: Full).
- GitHub's own certificate for the custom domain stays "unverified", so the
  Cloudflare edge is what makes HTTPS available to visitors.

## Verified

Tested in headless Chrome and decoded with ZXing:

- canvas PNG → `https://bit.ly/4x59SvP`, ECC H
- PNG with a center logo → decodes identically
- SVG path matrix matches the canvas cell-for-cell, and the rendered SVG decodes
- transparent background → corner alpha 0
- empty input / bad input → no crash, meta resets to `—`

Sylvenson Richard · JRiSpace · https://jrispace.com
