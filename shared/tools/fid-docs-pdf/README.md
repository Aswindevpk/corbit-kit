# FID Docs PDF (`fiddocs`)

Compiles a `fidtrack`-initialized project's `FID/.../features/LOGIC.md` files into
one publication-ready PDF — a simplified, FID-tree-aware sibling of
[`corbit-docs-pdf`](https://github.com/Aswindevpk/corbit-docs-pdf). Where that tool
compiles a hand-maintained `docs/` folder via a `pdf_manifest.json` you edit, this one
reads the FID tree a project already has (`devtest/fids.json`), so there is no
manifest to keep in sync: the PDF always reflects what's actually there.

Same rendering technique as `corbit-docs-pdf` (so the two produce a matching look):
headless Chrome for Mermaid diagrams and print-to-PDF, PyMuPDF to prune blank pages.

## Install

```bash
pip install git+https://github.com/Aswindevpk/corbit-kit.git#subdirectory=shared/tools/fid-docs-pdf
```

**Prerequisites:** Python 3.10+, Google Chrome or Chromium (auto-detected).

## Usage

Run inside (or point at) a project `fidtrack init` has set up:

```bash
fiddocs --fid FID01.1          # one feature's Logic Document — the normal case:
                                # compile it, get it approved (Phase 4), then build
fiddocs                        # the whole project (handover, Phase 7)
fiddocs -o review.pdf          # custom output path
```

A FID whose `features/LOGIC.md` is still the untouched template (no numbered
acceptance criteria yet) is skipped by default — pass `--include-empty` to force it in
anyway. `--fid FID01` also includes its children (`FID01.1`, `FID01.2`, …).

## Where this fits in the workflow

```
fidtrack path FID01.1   →   write the Logic Document there
                        →   fiddocs --fid FID01.1   (produces the PDF to submit)
                        →   a human approves it
                        →   fidtrack logic FID01.1 <file>   (if it was drafted elsewhere)
                        →   fidtrack start FID01.1   (Phase 5 build begins)
```

See `shared/workflow/README.md` and `shared/tools/devtest/GUIDE.md` at the kit root
for the full flow.

## CLI options

```
fiddocs [project_dir] [--fid FID01.1] [--output out.pdf] [--title "..."]
        [--include-empty] [--no-prune] [--chrome PATH] [--mermaid-js PATH]
```

`project_dir` defaults to the current directory. Mermaid.js is cached in
`~/.cache/mermaid/mermaid.min.js` and downloaded once if missing.
