const fs = require('fs');
const path = require('path');
const https = require('https');

const repoRoot = path.resolve(__dirname, '..');
const fontsDir = path.join(repoRoot, 'assets', 'fonts');
const cssDir = path.join(repoRoot, 'assets', 'css');

if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
}

// English-only (Latin) optimized web fonts for minimum footprint and max performance
const FONTS_CONFIG = [
    {
        family: 'Inter',
        subset: 'latin',
        weight: '400 800',
        filename: 'inter-latin.woff2',
        url: 'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2',
        unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
    },
    {
        family: 'JetBrains Mono',
        subset: 'latin',
        weight: '400 800',
        filename: 'jetbrains-mono-latin.woff2',
        url: 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg.woff2',
        unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
    }
];

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download ${url}: status code ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function main() {
    console.log('Downloading English (Latin) fonts to assets/fonts/...');
    const cssBlocks = [];
    const validFilenames = new Set(FONTS_CONFIG.map(f => f.filename));

    // Clean up any extra unneeded font files
    const existingFiles = fs.readdirSync(fontsDir);
    for (const file of existingFiles) {
        if (!validFilenames.has(file)) {
            console.log(`Removing unneeded font file: ${file}`);
            fs.unlinkSync(path.join(fontsDir, file));
        }
    }

    for (const font of FONTS_CONFIG) {
        const destPath = path.join(fontsDir, font.filename);
        if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
            console.log(`Downloading ${font.filename}...`);
            await downloadFile(font.url, destPath);
        } else {
            console.log(`Cached: ${font.filename}`);
        }

        const localFamily = font.family === 'JetBrains Mono' ? "local('JetBrains Mono'), local('JetBrainsMono'), " : "local('Inter'), local('Inter-Regular'), ";
        cssBlocks.push(`/* ${font.family} [${font.subset}] */
@font-face {
  font-family: '${font.family}';
  font-style: normal;
  font-weight: ${font.weight};
  font-display: swap;
  src: ${localFamily}url('../fonts/${font.filename}') format('woff2');
  unicode-range: ${font.unicodeRange};
}`);
    }

    const cssContent = `/* Self-hosted English (Latin) web fonts for Hexprite */
${cssBlocks.join('\n\n')}
`;

    const cssPath = path.join(cssDir, 'fonts.css');
    fs.writeFileSync(cssPath, cssContent, 'utf8');
    console.log(`Generated ${cssPath}`);
}

main().catch(err => {
    console.error('Error downloading fonts:', err);
    process.exit(1);
});
