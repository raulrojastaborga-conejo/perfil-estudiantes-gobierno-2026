import fs from 'fs';
import path from 'path';

const SOURCE_DIR = path.resolve('obsidian/Reglamentos/wiki');
const OUT_DIR = path.resolve('secretaria-estudios/wiki/generated');
const SITE_ROOT = '../..';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(filePath) {
  return filePath
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .replace(/^wiki\//, '')
    .split('/')
    .map(part => part
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    )
    .join('/');
}

function normalizeTarget(target) {
  return slugify(target.replace(/\.md$/i, '').replace(/^wiki\//, ''));
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripFrontmatter(text) {
  return text.replace(/^---[\s\S]*?---\s*/, '');
}

function extractTitle(markdown, fallback) {
  return markdown.match(/^#\s+(.+)$/m)?.[1] || fallback;
}

function extractObsidianLinks(markdown) {
  const links = [];
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match;

  while ((match = re.exec(markdown)) !== null) {
    links.push(normalizeTarget(match[1]));
  }

  return links;
}

function convertObsidianLinks(text, currentSlug = '') {
  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    const cleanTarget = target.replace(/\.md$/i, '');
    const targetSlug = normalizeTarget(cleanTarget);
    const href = relativeHref(currentSlug, targetSlug);
    const linkText = label || cleanTarget.split('/').pop();
    return `<a href="${href}">${escapeHtml(linkText)}</a>`;
  });
}

function relativeHref(fromSlug, toSlug) {
  const fromDir = path.posix.dirname(fromSlug);
  let href = path.posix.relative(fromDir === '.' ? '' : fromDir, `${toSlug}.html`);
  if (!href.startsWith('.')) href = `./${href}`;
  return href;
}

function markdownToHtml(markdown, currentSlug) {
  let text = stripFrontmatter(markdown);
  text = convertObsidianLinks(text, currentSlug);

  const lines = text.split(/\r?\n/);
  let html = '';
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      continue;
    }

    if (line.startsWith('# ')) {
      if (inList) { html += '</ul>\n'; inList = false; }
      html += `<h1>${line.slice(2)}</h1>\n`;
    } else if (line.startsWith('## ')) {
      if (inList) { html += '</ul>\n'; inList = false; }
      html += `<h2>${line.slice(3)}</h2>\n`;
    } else if (line.startsWith('### ')) {
      if (inList) { html += '</ul>\n'; inList = false; }
      html += `<h3>${line.slice(4)}</h3>\n`;
    } else if (line.startsWith('- ')) {
      if (!inList) {
        html += '<ul>\n';
        inList = true;
      }
      html += `<li>${line.slice(2)}</li>\n`;
    } else {
      if (inList) { html += '</ul>\n'; inList = false; }
      html += `<p>${line}</p>\n`;
    }
  }

  if (inList) html += '</ul>\n';
  return html;
}

function backlinksHtml(currentSlug, backlinks, pages) {
  const incoming = backlinks.get(currentSlug) || [];
  if (incoming.length === 0) return '';

  const items = incoming
    .sort((a, b) => pages.get(a).title.localeCompare(pages.get(b).title, 'es'))
    .map(sourceSlug => {
      const source = pages.get(sourceSlug);
      return `<li><a href="${relativeHref(currentSlug, sourceSlug)}">${escapeHtml(source.title)}</a></li>`;
    })
    .join('\n');

  return `
      <h2>Mencionada en</h2>
      <ul>
        ${items}
      </ul>`;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath);
  }

  return files;
}

function stylesheetHref(currentSlug) {
  const depth = currentSlug.split('/').length;
  return `${'../'.repeat(depth)}${SITE_ROOT}/styles.css`.replace(/\/\.\//g, '');
}

function wikiHomeHref(currentSlug) {
  const depth = currentSlug.split('/').length;
  return `${'../'.repeat(depth)}../../wiki-reglamentos.html`;
}

function pageTemplate(title, body, currentSlug, backlinksBlock) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — Wiki normativa</title>
  <link rel="stylesheet" href="${stylesheetHref(currentSlug)}" />
</head>
<body>
  <header>
    <div class="brand">
      <div class="logo-placeholder">Universidad de Chile</div>
      <div class="logo-placeholder">Facultad de Gobierno</div>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <p>Wiki normativa de Secretaría de Estudios.</p>
  </header>

  <main class="wrap">
    <section class="tabs" style="padding:28px;">
      <p><a class="btn" href="${wikiHomeHref(currentSlug)}">Volver a Wiki de Reglamentos</a></p>
      ${body}
      ${backlinksBlock}
      <div class="notice"><strong>Nota:</strong> página generada desde markdown Obsidian. Revisar fuente normativa antes de usar en decisiones formales.</div>
    </section>
  </main>
</body>
</html>`;
}

function buildBacklinks(pages) {
  const backlinks = new Map();

  for (const [sourceSlug, page] of pages) {
    for (const targetSlug of page.links) {
      if (!backlinks.has(targetSlug)) backlinks.set(targetSlug, []);
      if (!backlinks.get(targetSlug).includes(sourceSlug)) {
        backlinks.get(targetSlug).push(sourceSlug);
      }
    }
  }

  return backlinks;
}

function build() {
  ensureDir(OUT_DIR);

  const files = walk(SOURCE_DIR);
  const pages = new Map();

  for (const file of files) {
    const relative = path.relative(SOURCE_DIR, file).replace(/\\/g, '/');
    const slug = slugify(relative);
    const markdown = fs.readFileSync(file, 'utf8');
    const title = extractTitle(markdown, path.basename(relative, '.md'));
    const links = extractObsidianLinks(markdown);
    pages.set(slug, { file, relative, slug, markdown, title, links });
  }

  const backlinks = buildBacklinks(pages);

  for (const page of pages.values()) {
    const outputPath = path.join(OUT_DIR, `${page.slug}.html`);
    ensureDir(path.dirname(outputPath));

    const html = markdownToHtml(page.markdown, page.slug);
    const backlinksBlock = backlinksHtml(page.slug, backlinks, pages);
    fs.writeFileSync(outputPath, pageTemplate(page.title, html, page.slug, backlinksBlock), 'utf8');
  }

  console.log(`Wiki generada: ${files.length} páginas HTML en ${OUT_DIR}`);
  console.log(`Backlinks calculados para ${backlinks.size} páginas referenciadas.`);
}

build();
