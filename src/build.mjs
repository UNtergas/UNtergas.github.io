#!/usr/bin/env node
/* Markdown -> one static HTML file. No dependencies.
   Usage:  node src/build.mjs          build once into dist/
           node src/build.mjs --watch  rebuild on every save
*/
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync, watch } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');
const SRC     = join(ROOT, 'src');
const DIST    = join(ROOT, 'dist');

/* ---------- inline text ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

// escape first, then the tiny inline grammar:
//   {{term|tooltip}}   **bold**   *italic*   [label](url)
const inline = s => esc(s)
  .replace(/\{\{([^|{}]+)\|([^{}]+)\}\}/g, (_, t, tip) => `<span class="term" tabindex="0" data-tip="${tip.trim()}">${t.trim()}</span>`)
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a class="link" href="$2">$1</a>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

/* ---------- front matter: key: value, [a, b] lists, true/false ---------- */
function frontMatter(raw){
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return [{}, raw];
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;                       // # comments out a key
    const kv = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v))      v = v.slice(1, -1).split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else if (v === 'true')       v = true;
    else if (v === 'false')      v = false;
    else                         v = v.replace(/^["']|["']$/g, '');
    meta[kv[1]] = v;
  }
  return [meta, raw.slice(m[0].length)];
}

/* ---------- body: ## section, ### entry, - bullet ---------- */
function parseBody(body){
  const sections = [];
  let sec = null, entry = null, para = [];

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(' ');
    if (entry && !entry.where)      entry.where = text;
    else if (entry)                 (entry.paras ||= []).push(text);
    else if (sec)                   (sec.paras ||= []).push(text);
    para = [];
  };

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) { flushPara(); continue; }

    const h2 = line.match(/^##\s+(.+?)(?:\s*\{(\w+)\})?$/);
    if (h2 && !line.startsWith('###')) {
      flushPara(); entry = null;
      sec = { heading: h2[1].trim(), kind: h2[2] || 'entries', items: [], rows: [] };
      sections.push(sec);
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      flushPara();
      const [role, when = ''] = h3[1].split('|').map(s => s.trim());
      entry = { role, when, bullets: [] };
      sec.items.push(entry);
      continue;
    }

    if (line.startsWith('- ')) {
      flushPara();
      const text = line.slice(2).trim();
      if (sec.kind === 'grid') {
        const i = text.indexOf(':');
        sec.rows.push([text.slice(0, i).trim(), text.slice(i + 1).trim()]);
      } else if (entry) {
        entry.bullets.push(text);
      } else {
        (sec.loose ||= []).push(text);
      }
      continue;
    }

    para.push(line);
  }
  flushPara();
  return sections;
}

/* ---------- section -> HTML ---------- */
const renderSection = s => {
  if (s.kind === 'grid')
    return `<div class="grid">${s.rows.map(([k, v]) => `<b>${esc(k)}</b><span>${inline(v)}</span>`).join('')}</div>`;

  if (s.kind === 'text')
    return (s.paras || []).map(p => `<p class="about">${inline(p)}</p>`).join('');

  const loose = (s.loose || []).length ? `<ul>${s.loose.map(b => `<li>${inline(b)}</li>`).join('')}</ul>` : '';
  const paras = (s.paras || []).map(p => `<p class="about">${inline(p)}</p>`).join('');
  const items = s.items.map(e => `
      <div class="entry"${e.tip ? ` tabindex="0" data-tip="${esc(e.tip)}"` : ''}>
        <div class="entry-head"><strong>${inline(e.role)}</strong><span class="when">${esc(e.when)}</span></div>
        ${e.where ? `<p class="where">${inline(e.where)}</p>` : ''}
        ${(e.paras || []).map(p => `<p>${inline(p)}</p>`).join('')}
        ${e.bullets.length ? `<ul>${e.bullets.map(b => `<li>${inline(b)}</li>`).join('')}</ul>` : ''}
      </div>`).join('');
  return paras + items + loose;
};

/* ---------- page -> one face of the sheet ---------- */
function renderPage(page, i, total, site){
  const { meta, sections } = page;
  const titleLines = [].concat(meta.title || 'Untitled').map(esc).join('<br>');
  const stamp = meta.stamp
    ? `<div class="stamp"${meta.stampTip ? ` tabindex="0" data-tip="${esc(meta.stampTip)}"` : ''}>${[].concat(meta.stamp).map(esc).join('<br>')}</div>`
    : '';
  const contact = meta.contact === true
    ? `<p class="meta">${(site.contact || []).map(c => c.href
        ? `<a href="${esc(c.href)}"${c.tip ? ` data-tip="${esc(c.tip)}"` : ''}>${esc(c.text)}</a>`
        : `<span${c.tip ? ` tabindex="0" data-tip="${esc(c.tip)}"` : ''}>${esc(c.text)}</span>`).join('')}</p>`
    : '';

  return `<article class="face ${i === 0 ? 'front' : 'back'}">
      ${stamp}
      <div class="body">
        <h1>${titleLines}</h1>
        ${meta.role ? `<p class="role">${inline(meta.role)}</p>` : ''}
        ${contact}
        ${sections.map(s => `<section><h2>${esc(s.heading)}</h2>${renderSection(s)}</section>`).join('')}
      </div>
      <p class="page-no">${i + 1} / ${total}</p>
      ${meta.sign ? `<p class="sign">${esc(meta.sign)}</p>` : ''}
    </article>`;
}

/* ---------- build ---------- */
function build(){
  const site  = JSON.parse(readFileSync(join(CONTENT, 'site.json'), 'utf8'));
  const files = readdirSync(CONTENT).filter(f => f.endsWith('.md')).sort();

  const pages = files.map(f => {
    const [meta, body] = frontMatter(readFileSync(join(CONTENT, f), 'utf8'));
    return { meta, sections: parseBody(body), file: f };
  });

  if (pages.length > 2)
    console.warn(`! ${pages.length} pages found, a sheet has 2 faces. Ignored: ${pages.slice(2).map(p => p.file).join(', ')}`);

  /* download buttons point at PDFs living in content/, never at the 3D page */
  const downloads = (site.downloads || []).filter(d => {
    const there = existsSync(join(CONTENT, d.file));
    if (!there) console.warn(`! missing content/${d.file} — "${d.label}" button not rendered`);
    return there;
  });
  const buttons = downloads.map(d =>
    `  <a class="btn download" href="${esc(d.file)}" download${d.tip ? ` data-tip="${esc(d.tip)}"` : ''}>${esc(d.label)}</a>`
  ).join('\n');

  const html = readFileSync(join(SRC, 'template.html'), 'utf8')
    .replace(/__TITLE__/g,       esc(site.title))
    .replace(/__DESCRIPTION__/g, esc(site.description))
    .replace(/__OG_IMAGE__/g,    esc(site.ogImage || ''))
    .replace('__STYLE__',     readFileSync(join(SRC, 'style.css'), 'utf8'))
    .replace('__SCRIPT__',    readFileSync(join(SRC, 'sheet.js'), 'utf8'))
    .replace('__DOWNLOADS__', buttons)
    .replace('__PAGES__',     pages.slice(0, 2).map((p, i) => renderPage(p, i, pages.length, site)).join('\n'));

  mkdirSync(DIST, { recursive: true });
  writeFileSync(join(DIST, 'index.html'), html);

  /* copy every PDF plus the optional extras */
  const assets = readdirSync(CONTENT).filter(f => f.endsWith('.pdf'))
    .concat(['og.png', 'CNAME'].filter(f => existsSync(join(CONTENT, f))));
  for (const a of assets) copyFileSync(join(CONTENT, a), join(DIST, a));

  console.log(`built dist/index.html — ${files.length} page(s), ${downloads.length} download(s), ${(html.length/1024).toFixed(1)} kB`);
}

build();

if (process.argv.includes('--watch')) {
  console.log('watching content/ and src/ ...');
  let t;
  for (const dir of [CONTENT, SRC])
    watch(dir, () => { clearTimeout(t); t = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 80); });
}
