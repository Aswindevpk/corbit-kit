#!/usr/bin/env python3
"""
FID Logic Document PDF Compiler
================================
A simplified, FID-tree-aware sibling of corbit-docs-pdf: instead of a hand-maintained
docs/ folder and pdf_manifest.json, it walks the FID/ tree a `fidtrack`-initialized
project already has (reading devtest/fids.json for the canonical order and names) and
compiles every FID's features/LOGIC.md into one publication-ready PDF, in FID order.

No manifest file: the PDF always reflects the live FID tree. Use --fid to compile a
single feature (the normal case: one Logic Document, submitted for Phase 4 approval
before building starts). Omit it to compile the whole project (Phase 7 handover, or
an all-up review).

Usage:
    fiddocs                          # whole project, from the current directory
    fiddocs --fid FID01.1            # just FID01.1 (and its children, if any)
    fiddocs /path/to/project -o out.pdf
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from datetime import datetime
from pathlib import Path

import markdown
import pymupdf

FID_RE = re.compile(r"^FID\d{2}(?:\.\d+)*$")


def fid_sort_key(fid_id: str):
    """Numeric, depth-correct order: FID2 < FID10, FID1.2 < FID1.10, parent before child."""
    return [int(p) for p in fid_id[3:].split(".")]


def find_chrome() -> str:
    """Auto-detect Google Chrome or Chromium across platforms."""
    import os

    env_chrome = os.environ.get("CHROME_PATH")
    if env_chrome and Path(env_chrome).exists():
        return env_chrome

    candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
    ]
    for c in candidates:
        if Path(c).exists():
            return c
    for cmd in ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"]:
        found = shutil.which(cmd)
        if found:
            return found
    raise FileNotFoundError(
        "Google Chrome or Chromium not found. Install it, or set the CHROME_PATH environment variable."
    )


def resolve_mermaid_js(preferred_path: Path | None = None) -> str:
    """CLDS requires a visual flow per feature; LOGIC.md may contain ```mermaid blocks."""
    search_paths = [preferred_path] if preferred_path else []
    search_paths += [Path.cwd() / "mermaid.min.js", Path(__file__).resolve().parent / "mermaid.min.js", Path.home() / ".cache" / "mermaid" / "mermaid.min.js"]
    for p in search_paths:
        if p and p.exists() and p.is_file():
            try:
                return p.read_text(encoding="utf-8")
            except Exception as e:
                print(f"Warning: failed reading {p}: {e}")

    cache_file = Path.home() / ".cache" / "mermaid" / "mermaid.min.js"
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    try:
        print(f"Downloading mermaid.min.js into {cache_file} ...")
        urllib.request.urlretrieve("https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js", cache_file)
        return cache_file.read_text(encoding="utf-8")
    except Exception as e:
        print(f"Warning: could not download mermaid.min.js: {e}. Falling back to a CDN <script> tag.")
        return ""


def load_registry(project_dir: Path):
    """devtest/fids.json if present: {id: {name, slug}}, in registry order. None otherwise."""
    f = project_dir / "devtest" / "fids.json"
    if not f.exists():
        return None
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Warning: couldn't parse {f}: {e}")
        return None
    return {row["id"]: row for row in data.get("fids", [])}


def project_title(project_dir: Path) -> str:
    cfg = project_dir / "devtest" / "config.json"
    if cfg.exists():
        try:
            return json.loads(cfg.read_text(encoding="utf-8")).get("project") or project_dir.name
        except Exception:
            pass
    return project_dir.name


def discover_logic_docs(project_dir: Path, only_fid: str | None):
    """Walk FID/ for every features/LOGIC.md. Returns [(fid_id, name, Path)], in FID order."""
    fid_root = project_dir / "FID"
    if not fid_root.exists():
        raise FileNotFoundError(f"No FID/ directory in {project_dir}. Run this inside a fidtrack-initialized project.")

    registry = load_registry(project_dir)
    found: dict[str, Path] = {}
    for logic_md in fid_root.rglob("features/LOGIC.md"):
        folder = logic_md.parent.parent.name  # e.g. "FID01.1-registration"
        m = re.match(r"^(FID\d+(?:\.\d+)*)-", folder)
        if not m:
            print(f"Warning: can't read a FID id from folder name, skipping: {folder}")
            continue
        found[m.group(1)] = logic_md

    if registry is not None:
        ids = [fid for fid in registry if fid in found]
        for fid in found:
            if fid not in registry:
                ids.append(fid)
    else:
        ids = sorted(found, key=fid_sort_key)

    if only_fid:
        if not FID_RE.match(only_fid):
            raise ValueError(f'"{only_fid}" is not a valid FID (expected e.g. FID01.1)')
        ids = [fid for fid in ids if fid == only_fid or fid.startswith(only_fid + ".")]
        if not ids:
            raise FileNotFoundError(f"No features/LOGIC.md found under {only_fid}.")

    out = []
    for fid in ids:
        name = (registry.get(fid, {}).get("name") if registry else None) or fid
        out.append((fid, name, found[fid]))
    return out


def is_empty_logic_doc(text: str) -> bool:
    """True if LOGIC.md still looks like the fidtrack-generated template: no numbered
    acceptance criteria and no filled-in overview bullets."""
    section6 = text.split("## 6. Acceptance Criteria", 1)
    tail = section6[1] if len(section6) > 1 else ""
    has_numbered_ac = bool(re.search(r"^\s*\d+\.\s+\S", tail, re.MULTILINE))
    has_overview = bool(re.search(r"^\s*-\s*(Description|Actor|Trigger):[ \t]*\S", text, re.MULTILINE))
    return not has_numbered_ac and not has_overview


def extract_and_convert_markdown(md_text: str) -> str:
    """Pull out ```mermaid blocks for client-side rendering, convert the rest normally."""
    parts = []
    in_code = False
    code_lang = ""
    code_buf: list[str] = []
    for line in md_text.split("\n"):
        stripped = line.strip()
        if stripped.startswith("```"):
            if in_code:
                in_code = False
                code_str = "\n".join(code_buf)
                if code_lang == "mermaid":
                    parts.append(f'\n\n<div class="mermaid-wrap"><div class="mermaid">\n{code_str}\n</div></div>\n\n')
                else:
                    parts.append(f"\n\n```{code_lang}\n{code_str}\n```\n\n")
                code_buf = []
                code_lang = ""
            else:
                in_code = True
                code_lang = stripped[3:].strip()
                code_buf = []
            continue
        (code_buf if in_code else parts).append(line if in_code else line + "\n")
    return markdown.markdown("".join(parts), extensions=["tables", "fenced_code", "nl2br"])


CSS_STYLES = """
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 10pt; color: #1e293b; line-height: 1.5; margin: 0; background: #ffffff;
}
.cover-page { height: 92vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 30px; break-after: page; page-break-after: always; }
.toc-section { padding: 20px 0; break-after: page; page-break-after: always; }
.doc-section { padding: 10px 0; break-after: page; page-break-after: always; }
.doc-section:last-of-type { break-after: auto; page-break-after: auto; }
h1, h2, h3, h4, h5, h6 { break-after: avoid; page-break-after: avoid; color: #0f172a; }
h1 { font-size: 16pt; font-weight: 700; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px; margin: 12px 0 10px; }
h2 { font-size: 13pt; font-weight: 600; margin: 14px 0 6px; }
h3 { font-size: 11pt; font-weight: 600; margin: 12px 0 5px; }
h4 { font-size: 10pt; font-weight: 600; margin: 10px 0 4px; }
p { margin: 5px 0; }
.badge { display: inline-block; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; margin-bottom: 6px; letter-spacing: 0.5px; }
blockquote { margin: 8px 0; padding: 8px 14px; background: #f8fafc; border-left: 4px solid #f59e0b; border-radius: 0 6px 6px 0; font-size: 9pt; color: #334155; }
blockquote p { margin: 3px 0; }
ul, ol { margin: 5px 0; padding-left: 20px; }
li { margin: 2px 0; }
hr { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 8.5pt; break-inside: avoid; page-break-inside: avoid; }
th { background: #f1f5f9; color: #0f172a; font-weight: 600; text-align: left; padding: 5px 8px; border: 1px solid #cbd5e1; }
td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
tr:nth-child(even) td { background: #f8fafc; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 8.5pt; background: #f1f5f9; color: #0f172a; padding: 2px 4px; border-radius: 3px; }
pre { background: #0f172a; color: #f8fafc; padding: 8px 12px; border-radius: 6px; font-size: 8pt; line-height: 1.4; overflow-x: auto; break-inside: avoid; page-break-inside: avoid; }
pre code { background: transparent; color: inherit; padding: 0; }
.mermaid-wrap { background: #ffffff !important; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin: 12px 0; text-align: center; break-inside: avoid !important; page-break-inside: avoid !important; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.mermaid, .mermaid-wrap div { background: transparent !important; color: #0f172a !important; break-inside: avoid !important; page-break-inside: avoid !important; }
.mermaid-wrap svg { max-width: 100% !important; max-height: 480px !important; width: auto !important; height: auto !important; display: inline-block !important; margin: 0 auto !important; background: #ffffff !important; }
.mermaid-wrap svg text { fill: #0f172a !important; font-weight: 500; }
.cover-badge { background: #fef3c7; color: #92400e; font-weight: 700; font-size: 11pt; padding: 6px 20px; border-radius: 9999px; letter-spacing: 2px; border: 1px solid #fde68a; margin-bottom: 20px; }
.cover-title { font-size: 28pt; font-weight: 800; color: #0f172a; margin: 0 0 10px; letter-spacing: -0.5px; }
.cover-sub { font-size: 13pt; font-weight: 400; color: #475569; max-width: 550px; margin: 0 0 32px; line-height: 1.4; }
.cover-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 24px; text-align: left; font-size: 9.5pt; color: #334155; width: 480px; }
.cover-box p { margin: 4px 0; }
.toc-list { columns: 2; column-gap: 28px; font-size: 9.5pt; line-height: 1.85; padding-left: 20px; }
.toc-list a { color: #2563eb; text-decoration: none; }
"""


def build_full_html(items: list[tuple[str, str, Path]], title: str, subtitle: str, mermaid_code: str) -> str:
    sections_html, toc_items = [], []
    for idx, (fid, name, path) in enumerate(items):
        raw_md = path.read_text(encoding="utf-8")
        converted = extract_and_convert_markdown(raw_md)
        toc_items.append(f'<li><a href="#section-{idx}">{fid} — {name}</a></li>')
        sections_html.append(f'<section class="doc-section" id="section-{idx}"><div class="badge">{fid}</div>{converted}</section>')

    current_date_str = datetime.now().strftime("%B %Y")
    mermaid_script_tag = f"<script>{mermaid_code}</script>" if mermaid_code else '<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>'

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>{title}</title><style>{CSS_STYLES}</style>
{mermaid_script_tag}
<script>
mermaid.initialize({{
  startOnLoad: true, theme: 'default',
  themeVariables: {{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: '13px',
    primaryColor: '#e0f2fe', primaryTextColor: '#0f172a', primaryBorderColor: '#0284c7', lineColor: '#334155',
    secondaryColor: '#fef3c7', tertiaryColor: '#f1f5f9', edgeLabelBackground: '#ffffff', nodeTextColor: '#0f172a',
    clusterBkg: '#f8fafc', clusterBorder: '#cbd5e1' }},
  flowchart: {{ useMaxWidth: true, htmlLabels: true, curve: 'basis' }}, sequence: {{ useMaxWidth: true }}, er: {{ useMaxWidth: true }}
}});
</script>
</head><body>
<div class="cover-page">
  <div class="cover-badge">LOGIC DOCUMENT{"S" if len(items) > 1 else ""}</div>
  <div class="cover-title">{title}</div>
  <div class="cover-sub">{subtitle}</div>
  <div class="cover-box">
    <p><strong>Standard:</strong> COR Logic Document Standard (CLDS)</p>
    <p><strong>Scope:</strong> {len(items)} feature{"s" if len(items) != 1 else ""}</p>
    <p><strong>Date:</strong> {current_date_str}</p>
  </div>
</div>
<div class="toc-section"><h2>Table of Contents</h2><ol class="toc-list">{''.join(toc_items)}</ol></div>
{''.join(sections_html)}
</body></html>"""


def generate_pdf(project_dir: Path, only_fid, output_pdf, title, include_empty, mermaid_js_path, chrome_path, prune):
    project_dir = project_dir.resolve()
    print("=" * 60)
    print(" FID Logic Document PDF Compiler")
    print("=" * 60)

    items = discover_logic_docs(project_dir, only_fid)
    skipped = []
    if not include_empty:
        kept = []
        for fid, name, path in items:
            if is_empty_logic_doc(path.read_text(encoding="utf-8")):
                skipped.append(fid)
            else:
                kept.append((fid, name, path))
        items = kept
    if not items:
        print("Nothing to compile: every matching LOGIC.md is still the empty template." if skipped else "No LOGIC.md files found.")
        sys.exit(1)

    proj_title = project_title(project_dir)
    doc_title = title or (f"{items[0][0]} — {items[0][1]}" if only_fid else f"{proj_title} Logic Documentation")
    subtitle = "Business Logic, Workflow State and Acceptance Criteria" if only_fid else f"Complete Feature Specification Set — {proj_title}"

    final_output = (project_dir / output_pdf) if output_pdf and not Path(output_pdf).is_absolute() else (Path(output_pdf) if output_pdf else None)
    if final_output is None:
        final_output = project_dir / (f"{items[0][0]}-logic-document.pdf" if only_fid else f"{re.sub(r'[^A-Za-z0-9_-]+', '-', proj_title).strip('-').lower()}_logic_documentation.pdf")

    print(f"\nCompiling {len(items)} feature(s):")
    for fid, name, _ in items:
        print(f"   {fid}  {name}")
    if skipped:
        print(f"Skipped (still the empty template, use --include-empty to force): {', '.join(skipped)}")

    chrome = chrome_path or find_chrome()
    print(f"\nChrome: {chrome}")
    mermaid_code = resolve_mermaid_js(mermaid_js_path)

    full_html = build_full_html(items, doc_title, subtitle, mermaid_code)

    tmp_dir = Path(tempfile.gettempdir())
    import os as _os

    tmp_source = tmp_dir / f"fiddocs_source_{_os.getpid()}.html"
    tmp_rendered = tmp_dir / f"fiddocs_rendered_{_os.getpid()}.html"
    raw_pdf = tmp_dir / f"fiddocs_raw_{_os.getpid()}.pdf"
    try:
        tmp_source.write_text(full_html, encoding="utf-8")

        print("Rendering Mermaid diagrams via headless Chrome...")
        rendered = subprocess.check_output(
            [chrome, "--headless", "--disable-gpu", "--virtual-time-budget=15000", "--dump-dom", tmp_source.as_uri()],
            stderr=subprocess.DEVNULL,
        ).decode("utf-8")
        rendered = rendered.replace("</head>", f"<style>{CSS_STYLES}</style></head>") if "</head>" in rendered else f"<html><head><style>{CSS_STYLES}</style></head><body>{rendered}</body></html>"
        tmp_rendered.write_text(rendered, encoding="utf-8")

        print("Printing PDF...")
        subprocess.check_call(
            [chrome, "--headless", "--disable-gpu", f"--print-to-pdf={raw_pdf}", "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw", tmp_rendered.as_uri()],
            stderr=subprocess.DEVNULL,
        )

        final_output.parent.mkdir(parents=True, exist_ok=True)
        if prune:
            print("Pruning blank artifact pages...")
            doc = pymupdf.open(str(raw_pdf))
            keep = [i for i, page in enumerate(doc) if not (len(page.get_text().strip()) == 0 and len(page.get_images()) == 0 and len(page.get_drawings()) <= 10)]
            clean = pymupdf.open()
            clean.insert_pdf(doc, from_page=0, to_page=len(doc) - 1)
            for i in sorted(set(range(len(doc))) - set(keep), reverse=True):
                clean.delete_page(i)
            clean.save(str(final_output))
            clean.close()
            doc.close()
        else:
            shutil.copy2(raw_pdf, final_output)

        pages = len(pymupdf.open(str(final_output)))
        size_mb = final_output.stat().st_size / (1024 * 1024)
        print("\n" + "=" * 60)
        print(f" PDF ready: {final_output}")
        print(f" Pages: {pages}   Size: {size_mb:.2f} MB")
        print("=" * 60)
    finally:
        for f in (tmp_source, tmp_rendered, raw_pdf):
            if f.exists():
                try:
                    f.unlink()
                except Exception:
                    pass


def main():
    parser = argparse.ArgumentParser(description="Compile one or every FID's LOGIC.md into a publication-ready PDF.")
    parser.add_argument("project_dir", nargs="?", default=".", type=Path, help="Project root (default: current directory)")
    parser.add_argument("--fid", type=str, default=None, help="Compile only this FID (and its children). Omit for the whole project.")
    parser.add_argument("--output", "-o", type=str, default=None, help="Output PDF path (default: <project>_logic_documentation.pdf, or <FID>-logic-document.pdf with --fid)")
    parser.add_argument("--title", "-t", type=str, default=None, help="Cover page title override")
    parser.add_argument("--include-empty", action="store_true", help="Also include FIDs whose LOGIC.md is still the untouched template")
    parser.add_argument("--mermaid-js", type=Path, default=None)
    parser.add_argument("--chrome", type=str, default=None)
    parser.add_argument("--no-prune", action="store_true", help="Skip blank-page pruning")
    args = parser.parse_args()

    try:
        generate_pdf(
            project_dir=args.project_dir,
            only_fid=args.fid,
            output_pdf=args.output,
            title=args.title,
            include_empty=args.include_empty,
            mermaid_js_path=args.mermaid_js,
            chrome_path=args.chrome,
            prune=not args.no_prune,
        )
    except (FileNotFoundError, ValueError) as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
