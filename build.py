#!/usr/bin/env python3
"""Build the standalone QR Studio: inline lib/qrcode.js into src/app.html -> index.html.

JRiSpace | Sylvenson Richard
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
LIB = ROOT / "lib" / "qrcode.js"
SRC = ROOT / "src" / "app.html"
OUT = ROOT / "index.html"


def main() -> int:
    lib = LIB.read_text(encoding="utf-8")
    html = SRC.read_text(encoding="utf-8")
    placeholder = "<!--__QRLIB__-->"
    if placeholder not in html:
        print(f"placeholder {placeholder} missing in src/app.html", file=sys.stderr)
        return 1
    if "</script" in lib.lower():
        print("library contains a </script> sequence; cannot inline safely", file=sys.stderr)
        return 1
    banner = (
        "<script>\n/* qrcode-generator v1.4.4 (Kazuhiko Arase, MIT) — inlined for offline use */\n"
        + lib
        + "\n</script>"
    )
    OUT.write_text(html.replace(placeholder, banner), encoding="utf-8")
    size = OUT.stat().st_size
    print(f"built {OUT} ({size/1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
