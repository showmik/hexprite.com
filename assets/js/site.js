// Clean URL: Strip /index.html from address bar if present
if (typeof window !== 'undefined' && window.location && window.location.pathname.endsWith('/index.html')) {
    const cleanPath = window.location.pathname.replace(/\/index\.html$/, '/') + window.location.search + window.location.hash;
    window.history.replaceState(null, '', cleanPath);
}

// --- Theme Toggle Logic ---
const themeToggleBtns = [
    document.getElementById('theme-toggle'),
    document.getElementById('theme-toggle-mobile')
].filter(el => el);

const themeToggleDarkIcons = [
    document.getElementById('theme-toggle-dark-icon'),
    document.getElementById('theme-toggle-dark-icon-mobile')
].filter(el => el);

const themeToggleLightIcons = [
    document.getElementById('theme-toggle-light-icon'),
    document.getElementById('theme-toggle-light-icon-mobile')
].filter(el => el);

// Set initial icon state
const isDark = localStorage.getItem('color-theme') === 'dark' ||
    (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);

if (isDark) {
    themeToggleLightIcons.forEach(icon => icon.classList.remove('hidden'));
} else {
    themeToggleDarkIcons.forEach(icon => icon.classList.remove('hidden'));
}

themeToggleBtns.forEach(btn => {
    btn.addEventListener('click', function () {
        // Toggle icons inside both buttons
        themeToggleDarkIcons.forEach(icon => icon.classList.toggle('hidden'));
        themeToggleLightIcons.forEach(icon => icon.classList.toggle('hidden'));

        const willBeDark = !document.documentElement.classList.contains('dark');

        if (willBeDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('color-theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('color-theme', 'light');
        }

        if (window.umami) {
            window.umami.track('theme-toggle', { mode: willBeDark ? 'dark' : 'light' });
        }

        // Trigger download button pop animation
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.classList.remove('animate-pop-jump');
            void downloadBtn.offsetWidth; // Trigger reflow
            downloadBtn.classList.add('animate-pop-jump');
        }
    });
});

// --- Mobile Menu Logic ---
const btn = document.getElementById('mobile-menu-btn');
const menu = document.getElementById('mobile-menu');

if (btn && menu) {
    const closeMobileMenu = () => {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
    };

    const toggleMobileMenu = () => {
        const isHidden = menu.classList.toggle('hidden');
        btn.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
    };

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobileMenu();
    });

    // Close mobile menu when a link is clicked
    const mobileLinks = menu.querySelectorAll('a');
    mobileLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });

    // Close when clicking outside the menu
    document.addEventListener('click', (e) => {
        if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
            closeMobileMenu();
        }
    });

    // Close on Escape key press
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !menu.classList.contains('hidden')) {
            closeMobileMenu();
        }
    });
}

// Fetch GitHub Stars with caching and rate-limit fallback
const starCountEl = document.getElementById('github-star-count');
const cachedStars = localStorage.getItem('hexprite-github-stars');

if (cachedStars && starCountEl) {
    starCountEl.innerText = cachedStars;
}

const fetchStars = async () => {
    const fetchOptions = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? { signal: AbortSignal.timeout(4000) }
        : {};
    try {
        const res = await fetch('https://api.github.com/repos/showmik/hexprite', fetchOptions);
        if (!res.ok) throw new Error('GitHub API Error or Rate Limited');
        const data = await res.json();
        return data.stargazers_count;
    } catch (error) {
        console.warn('GitHub API failed, falling back to Shields.io:', error);
        const res = await fetch('https://img.shields.io/github/stars/showmik/hexprite.json', fetchOptions);
        if (!res.ok) throw new Error('Shields.io API Error');
        const data = await res.json();
        return data.value;
    }
};

fetchStars().then(stars => {
    if (stars !== undefined && starCountEl) {
        const starsFormatted = typeof stars === 'number' ? stars.toLocaleString() : stars;
        starCountEl.innerText = starsFormatted;
        localStorage.setItem('hexprite-github-stars', starsFormatted);
    }
}).catch(error => {
    console.warn('All star fetch methods failed:', error);
    if (starCountEl && !cachedStars) {
        starCountEl.innerText = 'Star';
    }
});

// --- Dynamic Release & Version Sync ---
(function() {
    // SemVer comparison: returns > 0 if a > b, < 0 if a < b, 0 if equal
    function compareSemver(a, b) {
        if (!a && !b) return 0;
        if (!a) return -1;
        if (!b) return 1;
        const cleanA = a.replace(/^v/, '').trim();
        const cleanB = b.replace(/^v/, '').trim();
        const [numA, preA] = cleanA.split('-');
        const [numB, preB] = cleanB.split('-');
        const partsA = (numA || '').split('.').map(n => parseInt(n, 10) || 0);
        const partsB = (numB || '').split('.').map(n => parseInt(n, 10) || 0);
        for (let i = 0; i < 3; i++) {
            const diff = (partsA[i] || 0) - (partsB[i] || 0);
            if (diff !== 0) return diff;
        }
        if (!preA && preB) return 1;  // non-prerelease > prerelease (e.g. 0.2.0 > 0.2.0-beta)
        if (preA && !preB) return -1;
        if (preA && preB) return preA.localeCompare(preB, undefined, { numeric: true, sensitivity: 'base' });
        return 0;
    }

    const updateDOMRelease = (tag, downloadUrl) => {
        const displayTag = tag ? (tag.startsWith('v') ? tag : 'v' + tag) : '';
        if (displayTag) {
            document.querySelectorAll('.version-badge').forEach(el => {
                el.innerText = displayTag;
            });
        }
        const directLink = document.getElementById('direct-download-link');
        if (directLink) {
            if (displayTag) directLink.setAttribute('data-umami-event-version', displayTag);
            if (downloadUrl) directLink.setAttribute('href', downloadUrl);
        }
        // Expose globally so modals or other scripts can always access the latest release
        window.__hexprite_release = {
            tag_name: displayTag || tag,
            download_url: downloadUrl
        };
    };

    // If DOM is still loading when script executes, re-apply once DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (window.__hexprite_release) {
                updateDOMRelease(window.__hexprite_release.tag_name, window.__hexprite_release.download_url);
            }
        });
    }

    // Track highest version seen so far (start with what is already rendered in the HTML)
    const initialBadge = document.querySelector('.version-badge');
    let currentVersion = initialBadge ? initialBadge.innerText.trim() : '';

    // 1. Stale-While-Revalidate: Check localStorage cached release
    let shouldSkipNetwork = false;
    try {
        const cachedRaw = localStorage.getItem('hexprite-cached-release');
        if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (cached.tag_name) {
                // Only apply cached version if it's not older than the rendered HTML
                if (compareSemver(cached.tag_name, currentVersion) >= 0) {
                    currentVersion = cached.tag_name;
                    updateDOMRelease(cached.tag_name, cached.download_url);
                }
            }
            // Skip network only if cache is very fresh (less than 60 seconds old)
            if (cached.cachedAt && (Date.now() - cached.cachedAt < 60000)) {
                shouldSkipNetwork = true;
            }
        }
    } catch (e) {
        // Silently ignore storage issues
    }

    if (shouldSkipNetwork) return;

    // 2. Multi-tier background release fetch
    const fetchOptions = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? { signal: AbortSignal.timeout(5000) }
        : {};

    const fetchRelease = async () => {
        // Tier 1: Try GitHub REST API with SemVer sorting
        try {
            const res = await fetch('https://api.github.com/repos/showmik/hexprite/releases?per_page=10', fetchOptions);
            if (res.ok) {
                const releases = await res.json();
                if (Array.isArray(releases) && releases.length > 0) {
                    const validReleases = releases.filter(r => !r.draft && r.tag_name);
                    if (validReleases.length > 0) {
                        // Sort by SemVer descending to always pick the highest version
                        validReleases.sort((a, b) => compareSemver(b.tag_name, a.tag_name));
                        const latest = validReleases[0];
                        const tag = latest.tag_name;
                        const versionNum = tag.replace(/^v/, '');
                        let downloadUrl = '';

                        if (Array.isArray(latest.assets) && latest.assets.length > 0) {
                            const exeAssets = latest.assets.filter(a => a.name && a.name.toLowerCase().endsWith('.exe'));
                            const setupAsset = exeAssets.find(a => a.name.toLowerCase().includes('setup')) || exeAssets[0];
                            if (setupAsset && setupAsset.browser_download_url) {
                                downloadUrl = setupAsset.browser_download_url;
                            }
                        }

                        if (!downloadUrl) {
                            downloadUrl = `https://github.com/showmik/hexprite/releases/download/${tag}/Hexprite-Setup-${versionNum}-x64.exe`;
                        }

                        return { tag, downloadUrl };
                    }
                }
            }
        } catch (err) {
            // Proceed to Tier 2
        }

        // Tier 2: Try same-origin static release.json (no CORS, no rate limit)
        try {
            const res = await fetch('data/release.json', fetchOptions);
            if (res.ok) {
                const data = await res.json();
                if (data && data.tag_name && data.download_url) {
                    return { tag: data.tag_name, downloadUrl: data.download_url };
                }
            }
        } catch (err) {
            // Proceed to Tier 3
        }

        // Tier 3: Try Shields.io (No rate limit, global CORS)
        try {
            const res = await fetch('https://img.shields.io/github/v/release/showmik/hexprite.json?include_prereleases&sort=semver', fetchOptions);
            if (res.ok) {
                const data = await res.json();
                const tag = data.value || data.message;
                if (tag && tag !== 'no releases') {
                    const versionNum = tag.replace(/^v/, '');
                    const downloadUrl = `https://github.com/showmik/hexprite/releases/download/${tag}/Hexprite-Setup-${versionNum}-x64.exe`;
                    return { tag, downloadUrl };
                }
            }
        } catch (err) {
            // Silently ignore
        }

        return null;
    };

    fetchRelease().then(info => {
        if (!info || !info.tag) return;
        // Never downgrade the DOM
        if (compareSemver(info.tag, currentVersion) >= 0) {
            currentVersion = info.tag;
            updateDOMRelease(info.tag, info.downloadUrl);
        }
        try {
            localStorage.setItem('hexprite-cached-release', JSON.stringify({
                tag_name: info.tag,
                download_url: info.downloadUrl,
                cachedAt: Date.now()
            }));
        } catch (e) {}
    }).catch(() => {});
})();

