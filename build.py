#!/usr/bin/env python3
"""Build the standalone Code Studio: inline lib/qrcode.js, src/i18n.js and src/app.js into
src/app.html -> index.html, then pin every inline <script>/<style> with a SHA-256 hash in a
strict Content-Security-Policy meta tag.

JRiSpace | Sylvenson Richard
"""
import base64
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
LIB = ROOT / "lib" / "qrcode.js"
I18N = ROOT / "src" / "i18n.js"
APP = ROOT / "src" / "app.js"
SRC = ROOT / "src" / "app.html"
OUT = ROOT / "index.html"

LIB_TOKEN = "<!--__QRLIB__-->"
I18N_TOKEN = "<!--__I18NJS__-->"
APP_TOKEN = "<!--__APPJS__-->"
CSP_TOKEN = "<!--__CSP__-->"


def sha256_token(body: str) -> str:
    digest = hashlib.sha256(body.encode("utf-8")).digest()
    return "'sha256-" + base64.b64encode(digest).decode("ascii") + "'"


def build_csp(html: str) -> str:
    """Hash every inline script/style block; nothing else may execute or apply."""
    scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S)
    styles = re.findall(r"<style[^>]*>(.*?)</style>", html, re.S)
    script_src = " ".join(dict.fromkeys(sha256_token(s) for s in scripts))
    style_src = " ".join(dict.fromkeys(sha256_token(s) for s in styles))
    parts = [
        "default-src 'none'",
        "script-src " + (script_src or "'none'"),
        "style-src " + (style_src or "'none'"),
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "media-src 'none'",
        "connect-src 'none'",
        "form-action 'none'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "manifest-src 'self'",
    ]
    return '<meta http-equiv="Content-Security-Policy" content="' + "; ".join(parts) + '">'


def main() -> int:
    lib = LIB.read_text(encoding="utf-8")
    i18n = I18N.read_text(encoding="utf-8")
    app = APP.read_text(encoding="utf-8")
    html = SRC.read_text(encoding="utf-8")

    for token in (LIB_TOKEN, I18N_TOKEN, APP_TOKEN, CSP_TOKEN):
        if token not in html:
            print(f"placeholder {token} missing in src/app.html", file=sys.stderr)
            return 1
    for name, body in (("lib/qrcode.js", lib), ("src/i18n.js", i18n), ("src/app.js", app)):
        if "</script" in body.lower():
            print(f"{name} contains a </script> sequence; cannot inline safely", file=sys.stderr)
            return 1

    lib_block = (
        "<script>\n/* qrcode-generator v1.4.4 (Kazuhiko Arase, MIT) — inlined for offline use */\n"
        + lib
        + "\n</script>"
    )
    i18n_block = "<script>\n" + i18n + "\n</script>"
    app_block = "<script>\n" + app + "\n</script>"

    out = (html.replace(LIB_TOKEN, lib_block)
               .replace(I18N_TOKEN, i18n_block)
               .replace(APP_TOKEN, app_block))

    csp = build_csp(out)
    out = out.replace(CSP_TOKEN, csp)

    OUT.write_text(out, encoding="utf-8")
    size = OUT.stat().st_size
    n_scripts = len(re.findall(r"'sha256-", csp))
    print(f"built {OUT} ({size/1024:.1f} KB) — CSP pins {n_scripts} inline blocks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
