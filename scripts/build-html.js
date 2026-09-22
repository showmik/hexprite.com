const fs = require('fs');
const path = require('path');
const { getReleaseInfo } = require('./fetch-release');

const repoRoot = path.resolve(__dirname, '..');
const templatesDir = path.join(repoRoot, 'templates');
const pagesDir = path.join(templatesDir, 'pages');

const UMAMI_SCRIPT_URL = process.env.UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js';
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || '5f4ad7ae-d229-4674-bed2-c36a8aab6755';
const UMAMI_DOMAINS = process.env.UMAMI_DOMAINS || 'hexprite.com,www.hexprite.com';

const TOKENS = {
    home: {
        HOME_HREF: '/',
        HOME_PREFIX: '',
        NAV_ID_ATTR: ' id="main-nav"',
        NAV_TRANSITION: 'transition duration-300 ease-in-out',
        DOWNLOAD_CTA_HREF: '#',
        DOWNLOAD_CTA_CLASS: 'download-trigger ',
        LICENSE_CONTENT: '',
        UMAMI_SCRIPT_URL,
        UMAMI_WEBSITE_ID,
        UMAMI_DOMAINS,
    },
    subpage: {
        HOME_HREF: '/',
        HOME_PREFIX: '/',
        NAV_ID_ATTR: '',
        NAV_TRANSITION: 'transition-colors duration-200',
        DOWNLOAD_CTA_HREF: '/#download-btn',
        DOWNLOAD_CTA_CLASS: '',
        LICENSE_CONTENT: '',
        UMAMI_SCRIPT_URL,
        UMAMI_WEBSITE_ID,
        UMAMI_DOMAINS,
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

    const numberedSectionRe = /^\s*(\d+)\.\s+(.+)$/;
    const majorHeadingRe = /^\s*(Preamble|TERMS AND CONDITIONS|How to Apply These Terms to Your New Programs)\s*$/;
    const endTermsRe = /^\s*END OF TERMS AND CONDITIONS\s*$/;
    const bulletRe = /^\s*([a-z]\))\s+(.+)$/;
    const starBulletRe = /^\s*\*\s+(.+)$/;

    let i = 0;

    // Skip the first title line (GNU GENERAL PUBLIC LICENSE) since it's rendered by the <h1> in the template
    while (i < lines.length && !lines[i].includes('GNU GENERAL PUBLIC LICENSE')) i++;
    if (i < lines.length) i++; // skip GNU GENERAL PUBLIC LICENSE

    let currentPara = [];
    let currentBullets = [];
    let inPre = false;
    let preLines = [];

    function flushPara() {
        if (currentPara.length) {
            html.push(`            <p>${currentPara.join(' ')}</p>`);
            currentPara = [];
        }
    }

    function flushBullets() {
        if (currentBullets.length) {
            html.push(`            <ul class="list-disc pl-5 mt-2 space-y-2">`);
            for (const b of currentBullets) {
                html.push(`                <li>${b}</li>`);
            }
            html.push(`            </ul>`);
            currentBullets = [];
        }
    }

    function flushPre() {
        if (preLines.length) {
            html.push(`            <pre class="bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-4 font-mono text-xs overflow-x-auto my-4 text-gray-800 dark:text-gray-200 rounded">${preLines.join('\n')}</pre>`);
            preLines = [];
            inPre = false;
        }
    }

    function flushAll() {
        flushBullets();
        flushPara();
        flushPre();
    }

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (endTermsRe.test(line)) {
            flushAll();
            html.push(`            <hr class="my-8 border-gray-200 dark:border-gray-700" />`);
            i++;
            continue;
        }

        const majorMatch = line.match(majorHeadingRe);
        if (majorMatch) {
            flushAll();
            html.push(`            <h2 class="text-xl font-bold font-mono text-gray-900 dark:text-white mt-8 mb-3">${majorMatch[1]}</h2>`);
            i++;
            continue;
        }

        const numberedMatch = line.match(numberedSectionRe);
        if (numberedMatch) {
            flushAll();
            html.push(`            <h2 class="text-xl font-bold font-mono text-gray-900 dark:text-white mt-8 mb-3">${numberedMatch[1]}. ${numberedMatch[2]}</h2>`);
            i++;
            continue;
        }

        const bulletMatch = line.match(bulletRe) || line.match(starBulletRe);
        if (bulletMatch) {
            flushPara();
            flushPre();
            currentBullets.push(bulletMatch[2] ? `${bulletMatch[1]} ${bulletMatch[2]}` : bulletMatch[1]);
            i++;
            continue;
        }

        // Bullet continuation line
        if (currentBullets.length > 0 && line.startsWith('    ') && trimmed !== '' && !line.startsWith('        ')) {
            currentBullets[currentBullets.length - 1] += ' ' + trimmed;
            i++;
            continue;
        }

        // Check for code / notice blocks (indented 4 spaces after "How to Apply")
        if (trimmed !== '' && line.startsWith('    ') && (trimmed.startsWith('Hexprite') || trimmed.startsWith('Copyright') || trimmed.startsWith('This program') || trimmed.startsWith('<one line') || trimmed.startsWith('<https:'))) {
            flushPara();
            flushBullets();
            inPre = true;
            preLines.push(trimmed);
            i++;
            continue;
        }

        if (inPre && line.startsWith('    ') && trimmed !== '') {
            preLines.push(trimmed);
            i++;
            continue;
        } else if (inPre && trimmed === '') {
            flushPre();
        }

        if (trimmed === '') {
            flushBullets();
            flushPara();
            flushPre();
        } else {
            flushBullets();
            flushPre();
            currentPara.push(trimmed);
        }

        i++;
    }

    flushAll();
    return html.join('\n');
}

async function build() {
    // Resolve dynamic release tokens from GitHub Releases / Cache
    const release = await getReleaseInfo();
    const releaseTokens = {
        VERSION_TAG: release.tag_name,
        VERSION_NUM: release.version,
        DOWNLOAD_EXE_URL: release.download_url,
        RELEASE_URL: release.release_url,
    };

    Object.assign(TOKENS.home, releaseTokens);
    Object.assign(TOKENS.subpage, releaseTokens);

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

build().catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
});
