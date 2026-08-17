const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const templatesDir = path.join(repoRoot, 'templates');
const pagesDir = path.join(templatesDir, 'pages');

const TOKENS = {
    home: {
        HOME_HREF: '',
        HOME_PREFIX: '',
        NAV_ID_ATTR: ' id="main-nav"',
        NAV_TRANSITION: 'transition duration-300 ease-in-out',
        DOWNLOAD_CTA_HREF: '#',
        DOWNLOAD_CTA_CLASS: 'download-trigger ',
    },
    subpage: {
        HOME_HREF: 'index.html',
        HOME_PREFIX: 'index.html',
        NAV_ID_ATTR: '',
        NAV_TRANSITION: 'transition-colors duration-200',
        DOWNLOAD_CTA_HREF: 'index.html#download-btn',
        DOWNLOAD_CTA_CLASS: '',
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

function build() {
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
