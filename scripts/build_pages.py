"""
Renders index.html (English, at the repo root) and <lang>/index.html for
every other locale from templates/page.html + locales/<lang>.json.

Local authoring tool only -- not part of deployment. GitHub Pages still
just serves whatever static HTML ends up committed; nothing runs this at
request time or in CI. Re-run after editing templates/page.html or any
locales/*.json file:

    python scripts/build_pages.py
"""
import datetime
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = "https://keepmetube.t3tracon.com.tr"

# code -> (URL path segment, og:locale, human name for comments/logging)
LANGUAGES = {
    "en": ("", "en_US", "English"),
    "tr": ("tr", "tr_TR", "Türkçe"),
    "es": ("es", "es_ES", "Español"),
    "fr": ("fr", "fr_FR", "Français"),
    "de": ("de", "de_DE", "Deutsch"),
    "pt": ("pt", "pt_BR", "Português"),
    "ar": ("ar", "ar_AR", "العربية"),
    "ja": ("ja", "ja_JP", "日本語"),
    "ko": ("ko", "ko_KR", "한국어"),
    "zh": ("zh", "zh_CN", "中文"),
}


def page_url(lang):
    segment, _, _ = LANGUAGES[lang]
    return f"{SITE_URL}/{segment + '/' if segment else ''}"


def hreflang_block(current_lang):
    lines = []
    for lang in LANGUAGES:
        lines.append(f'<link rel="alternate" hreflang="{lang}" href="{page_url(lang)}">')
    lines.append(f'<link rel="alternate" hreflang="x-default" href="{page_url("en")}">')
    return "\n".join(lines)


def render(template, values):
    out = template
    for key in sorted(values, key=len, reverse=True):
        out = out.replace("{{" + key + "}}", str(values[key]))
    remaining = [tok for tok in out.split("{{")[1:] if "}}" in tok]
    if remaining:
        missing = sorted({tok.split("}}")[0] for tok in remaining})
        raise ValueError(f"template placeholders left unfilled: {missing}")
    return out


def build_sitemap():
    today = datetime.date.today().isoformat()
    alt_links = "\n".join(
        f'    <xhtml:link rel="alternate" hreflang="{lang}" href="{page_url(lang)}"/>'
        for lang in LANGUAGES
    )
    alt_links += f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{page_url("en")}"/>'

    entries = []
    for lang in LANGUAGES:
        entries.append(
            "  <url>\n"
            f"    <loc>{page_url(lang)}</loc>\n"
            f"{alt_links}\n"
            f"    <lastmod>{today}</lastmod>\n"
            "    <changefreq>weekly</changefreq>\n"
            "    <priority>1.0</priority>\n"
            "  </url>"
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    out_path = os.path.join(ROOT, "sitemap.xml")
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(xml)
    print("wrote sitemap.xml")


def main():
    with open(os.path.join(ROOT, "templates", "page.html"), "r", encoding="utf-8") as f:
        template = f.read()

    for lang, (segment, og_locale, name) in LANGUAGES.items():
        locale_path = os.path.join(ROOT, "locales", f"{lang}.json")
        with open(locale_path, "r", encoding="utf-8") as f:
            strings = json.load(f)

        values = dict(strings)
        values["canonical_url"] = page_url(lang)
        values["og_locale"] = og_locale
        values["hreflang_block"] = hreflang_block(lang)

        html = render(template, values)

        out_dir = os.path.join(ROOT, segment) if segment else ROOT
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "index.html")
        with open(out_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(html)
        rel = os.path.relpath(out_path, ROOT)
        print(f"wrote {rel}  ({lang})")

    build_sitemap()


if __name__ == "__main__":
    main()
