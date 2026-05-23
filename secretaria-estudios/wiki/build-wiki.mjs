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

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function convertObsidianLinks(text) {
  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
    const cleanTarget = target.replace(/\.md$/i, '');
    const href = `${slugify(cleanTarget)}.html`;
    const linkText = label || cleanTarget.split('/').pop();
    return `<a href="${href}">${escapeHtml(linkText)}</a>`;
  });
}

function stripFrontmatter(text) {
  return text.replace(/^---[\s\S]*?---\s*/, '');
}

function markdownToHtml(markdown) {
  let text = stripFrontmatter(markdown);
  text = convertObsidianLinks(text);

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

function pageTemplate(title, body) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Wiki normativa</title>
  <link rel="stylesheet" href="${SITE_ROOT}/styles.css" />
</head>
<body>
  <header>
    <div class="brand">
      <div class="logo-placeholder">Universidad de Chile</div>
      <div class="logo-placeholder">Facultad de Gobierno</div>
    </div>
    <h1>${title}</h1>
    <p>Wiki normativa de Secretaría de Estudios.</p>
  </header>

  <main class="wrap">
    <section class="tabs" style="padding:28px;">
      <p><a class="btn" href="../../wiki-reglamentos.html">Volver a Wiki de Reglamentos</a></p>
      ${body}
      <div class="notice"><strong>Nota:</strong> página generada desde markdown Obsidian. Revisar fuente normativa antes de usar en decisiones formales.</div>
    </section>
  </main>
</body>
</html>`;
}

function build() {
  ensureDir(OUT_DIR);

  const files = walk(SOURCE_DIR);

  for (const file of files) {
    const relative = path.relative(SOURCE_DIR, file).replace(/\\/g, '/');
    const outputRelative = `${slugify(relative)}.html`;
    const outputPath = path.join(OUT_DIR, outputRelative);
    ensureDir(path.dirname(outputPath));

    const markdown = fs.readFileSync(file, 'utf8');
    const firstHeading = markdown.match(/^#\s+(.+)$/m)?.[1] || path.basename(relative, '.md');
    const html = markdownToHtml(markdown);
    fs.writeFileSync(outputPath, pageTemplate(firstHeading, html), 'utf8');
  }

  console.log(`Wiki generada: ${files.length} páginas HTML en ${OUT_DIR}`);
}

build();
