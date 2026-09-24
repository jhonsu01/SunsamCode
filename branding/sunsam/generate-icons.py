#!/usr/bin/env python3
"""Genera todos los iconos de empaquetado de Sunsam Code a partir del logo fuente.

Uso (desde la raíz del repo):
    python3 branding/sunsam/generate-icons.py

Requiere Pillow (`pip install pillow`). Es idempotente: se puede volver a ejecutar
después de cada sincronización con upstream para restaurar los iconos de marca si
upstream los reemplazó.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "branding" / "sunsam" / "sunsam-app-icon-1024.png"
DESKTOP_BUILD = ROOT / "packages" / "desktop" / "build"
WEB_PUBLIC = ROOT / "packages" / "web" / "public"
REPO_LOGO = ROOT / "public" / "logo" / "icons"

ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]


def load_source() -> Image.Image:
    image = Image.open(SOURCE).convert("RGBA")
    if image.size != (1024, 1024):
        image = image.resize((1024, 1024), Image.LANCZOS)
    return image


def main() -> None:
    source = load_source()

    for name in ("icon.png", "icon_windows.png", "icon_installer.png"):
        source.save(DESKTOP_BUILD / name, format="PNG", optimize=True)

    icons_dir = DESKTOP_BUILD / "icons"
    icons_dir.mkdir(parents=True, exist_ok=True)
    for size in LINUX_SIZES:
        source.resize((size, size), Image.LANCZOS).save(
            icons_dir / f"{size}x{size}.png", format="PNG", optimize=True
        )

    for name in ("icon.ico", "icon_installer.ico"):
        source.save(DESKTOP_BUILD / name, format="ICO", sizes=ICO_SIZES)
    source.save(WEB_PUBLIC / "favicon.ico", format="ICO", sizes=ICO_SIZES)

    for name in ("icon.icns", "icon_installer.icns"):
        source.save(DESKTOP_BUILD / name, format="ICNS")

    # Logos del repositorio (README y material público).
    REPO_LOGO.mkdir(parents=True, exist_ok=True)
    for size in (16, 24, 32, 48, 64, 128, 256, 512, 1024):
        source.resize((size, size), Image.LANCZOS).save(
            REPO_LOGO / f"{size}x{size}.png", format="PNG", optimize=True
        )
    source.save(REPO_LOGO / "icon.ico", format="ICO", sizes=ICO_SIZES)
    source.save(REPO_LOGO / "icon.icns", format="ICNS")
    source.resize((1024, 1024), Image.LANCZOS).save(ROOT / "public" / "icon_512@2x.png", format="PNG", optimize=True)

    print(f"Sunsam icons regenerated from {SOURCE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
