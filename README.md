# CV as a sheet of paper

A one-page site: an A4 sheet floating in 3D that you can spin, zoom and flip.
Content is Markdown. The build turns it into a single static `dist/index.html`.
No dependencies, no bundler, no framework.

## Edit

| Want to change | File |
|---|---|
| Any CV text | `content/01-front.md`, `content/02-back.md` |
| Name, email, links, page title, OG image | `content/site.json` |
| Download buttons and the PDFs they serve | `content/site.json` + the PDF files in `content/` |
| Colours, type, spacing | `src/style.css` |
| Spin / zoom / flip behaviour | `src/sheet.js` |
| HTML shell and meta tags | `src/template.html` |

```bash
npm run build   # -> dist/index.html
npm run dev     # rebuild on every save, then reload dist/index.html
```

`dist/` is generated and git-ignored. CI rebuilds it on every push.

## Markdown grammar

```md
---
title: [Nguyen, Anh Tuan]      # each item is one line of the big heading
role: Full-stack engineer      # italic line under the name
contact: true                  # print the contact row from site.json
# stamp: [Available, Nov 2026] # round mark; delete or # it out to remove
# stampTip: Contract ends October 2026.
sign: Turn the page.           # small italic note, bottom right
---

## About {text}                # paragraphs

Free prose here.

## Experience                  # default: entries

### Role title | 05/2026 — present
Organisation — city            # first line after the heading = the italic line

- bullet
- bullet

## Skills {grid}               # label: value rows

- Backend: Node.js, Express
```

Inline, in any text:

| Syntax | Result |
|---|---|
| `{{term\|explanation}}` | dotted term, tooltip floats above the paper on hover |
| `[label](https://…)` | link |
| `**bold**`, `*italic*` | bold, italic |

## Downloads

The buttons serve real files, never a print of the 3D page:

```json
"downloads": [
  { "label": "CV — English (PDF)", "file": "cv-en.pdf", "tip": "The printable one-pager." },
  { "label": "CV — Français (PDF)", "file": "cv-fr.pdf" }
]
```

Put `cv-en.pdf` and `cv-fr.pdf` in `content/`. Every `.pdf` there is copied to `dist/`.
A button whose file is missing is dropped from the page, with a warning in the build log,
so a recruiter never hits a 404.

## Sizing

A sheet has two faces, so `content/` holds two `.md` files; more are ignored with a
warning. Type auto-shrinks from 16px down to 10.5px until a page fits its margins, so bullets can
be added freely. If text still overflows, that page is genuinely too long — cut it.

Margins are fixed at 74 / 84 / 112 px of a 720x1018 sheet and scale with it, so they stay
proportional at every zoom level. The 112px bottom band holds the page number and the
sign-off line, which is why body text never reaches the paper edge.

Zoom changes the sheet's width, height and font size — not a CSS `scale()` — so the
browser re-renders the type at each step instead of stretching pixels. Zoom floor is the
fitted size; "Lay it flat" animates back to it, square on.

## Deploy

`dist/` is a plain static folder with relative paths only, so any static host serves it.

| Host | Setup | URL |
|---|---|---|
| GitHub Pages | Settings → Pages → Source: GitHub Actions (workflow included) | `user.github.io` or `user.github.io/repo/` |
| Vercel | Import repo, config in `vercel.json` | `project.vercel.app` |
| Netlify | Import repo, config in `netlify.toml` | `project.netlify.app` |
| Cloudflare Pages | Build command `node src/build.mjs`, output `dist` | `project.pages.dev` |

Build command is the same everywhere: `node src/build.mjs`, publish `dist`.
There are no dependencies, so the install step is a no-op.

Custom domain: on GitHub Pages put a `CNAME` file in `content/` (it gets copied to `dist/`);
on the others set it in the dashboard and delete the `CNAME` file.

If the site lives under a subpath (`user.github.io/cv/`), everything still works — asset
links are relative — but set `ogImage` in `content/site.json` to the full URL including
the subpath, since Open Graph needs absolute URLs.
