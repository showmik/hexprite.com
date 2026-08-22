const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const templatesDir = path.join(repoRoot, 'templates');
const pagesDir = path.join(templatesDir, 'pages');

const UMAMI_SCRIPT_URL = process.env.UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js';
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || '5f4ad7ae-d229-4674-bed2-c36a8aab6755';

const TOKENS = {
    home: {
        HOME_HREF: '',
        HOME_PREFIX: '',
        NAV_ID_ATTR: ' id="main-nav"',
        NAV_TRANSITION: 'transition duration-300 ease-in-out',
        DOWNLOAD_CTA_HREF: '#',
        DOWNLOAD_CTA_CLASS: 'download-trigger ',
        LICENSE_CONTENT: '',
        UMAMI_SCRIPT_URL,
        UMAMI_WEBSITE_ID,
    },
    subpage: {
        HOME_HREF: 'index.html',
        HOME_PREFIX: 'index.html',
        NAV_ID_ATTR: '',
        NAV_TRANSITION: 'transition-colors duration-200',
        DOWNLOAD_CTA_HREF: 'index.html#download-btn',
        DOWNLOAD_CTA_CLASS: '',
        LICENSE_CONTENT: '',
        UMAMI_SCRIPT_URL,
        UMAMI_WEBSITE_ID,
    },
};

const INCLUDE_RE = /<!--\s*include:(\S+?)\s*-->/g;

function resolveIncludes(content) {
    let result = content;
    while (INCLUDE_RE.test(result)) {
        INCLUDE_RE.lastIndex = 0;
        result = result.replace(INCLUDE_RE, (_match, includePath) => {
            const partialPath = path.join(templatesDir, includePath);
            return fs.readFileSync(partialPath, 'utf8');
        });
    }
    return result;
}

function applyTokens(content, tokens) {
    let result = content;
    for (const [key, value] of Object.entries(tokens)) {
        result = result.replaceAll(`{{${key}}}`, value);
    }
    const leftover = result.match(/\{\{[A-Z_]+\}\}/);
    if (leftover) {
        throw new Error(`Unresolved template token ${leftover[0]} left in output`);
    }
    return result;
}

function licenseToHtml() {
    const raw = fs.readFileSync(path.join(repoRoot, 'LICENSE'), 'utf8');
    const lines = raw.split(/\r?\n/);
    const html = [];
    const sectionHeadingRe = /^(\d+)\.\s+(.+)$/;

    let i = 0;

    // Line 1: title — rendered by the <h1> in the template, skip it
    i++;

    // Skip blank lines after title
    while (i < lines.length && lines[i].trim() === '') i++;

    // Preamble paragraphs (copyright, intro) — collect until first numbered section
    let paraLines = [];
    while (i < lines.length && !sectionHeadingRe.test(lines[i])) {
        if (lines[i].trim() === '') {
            if (paraLines.length) {
                html.push(`            <p>${paraLines.join(' ')}</p>`);
                paraLines = [];
            }
        } else {
            paraLines.push(lines[i].trim());
        }
        i++;
    }
    if (paraLines.length) {
        html.push(`            <p>${paraLines.join(' ')}</p>`);
        paraLines = [];
    }

    // Numbered sections
    while (i < lines.length) {
        const headingMatch = lines[i].match(sectionHeadingRe);
        if (headingMatch) {
            html.push('');
            html.push(`            <h2 class="text-xl font-bold font-mono text-gray-900 dark:text-white mt-8">${headingMatch[1]}. ${headingMatch[2]}</h2>`);
            i++;

            let bullets = [];
            paraLines = [];

            while (i < lines.length && !sectionHeadingRe.test(lines[i])) {
                const line = lines[i];

                if (line.startsWith('* ')) {
                    // Flush any pending paragraph
                    if (paraLines.length) {
                        html.push(`            <p>${paraLines.join(' ')}</p>`);
                        paraLines = [];
                    }
                    bullets.push(line.slice(2).trim());
                } else if (line.startsWith('  ') && bullets.length) {
                    // Continuation line of the last bullet
                    bullets[bullets.length - 1] += ' ' + line.trim();
                } else if (line.trim() === '') {
                    // Flush bullets
                    if (bullets.length) {
                        html.push(`            <ul class="list-disc pl-5 mt-2 space-y-2">`);
                        for (const b of bullets) html.push(`                <li>${b}</li>`);
                        html.push(`            </ul>`);
                        bullets = [];
                    }
                    // Flush paragraph
                    if (paraLines.length) {
                        html.push(`            <p>${paraLines.join(' ')}</p>`);
                        paraLines = [];
                    }
                } else {
                    paraLines.push(line.trim());
                }
                i++;
            }

            // Flush any remaining content at end of section
            if (bullets.length) {
                html.push(`            <ul class="list-disc pl-5 mt-2 space-y-2">`);
                for (const b of bullets) html.push(`                <li>${b}</li>`);
                html.push(`            </ul>`);
            }
            if (paraLines.length) {
                html.push(`            <p>${paraLines.join(' ')}</p>`);
            }
        } else {
            i++;
        }
    }

    return html.join('\n');
}

function build() {
    // Generate LICENSE_CONTENT from the plain-text LICENSE file
    TOKENS.subpage.LICENSE_CONTENT = licenseToHtml();

    const pageFiles = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.html'));

    for (const fileName of pageFiles) {
        const isHome = fileName === 'index.html';
        const tokens = isHome ? TOKENS.home : TOKENS.subpage;

        const template = fs.readFileSync(path.join(pagesDir, fileName), 'utf8');
        const withIncludes = resolveIncludes(template);
        const output = applyTokens(withIncludes, tokens);

        fs.writeFileSync(path.join(repoRoot, fileName), output);
        console.log(`Built ${fileName}`);
    }
}

build();
