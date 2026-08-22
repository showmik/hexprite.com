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

btn.addEventListener('click', () => {
    menu.classList.toggle('hidden');
});

// Close mobile menu when a link is clicked
const mobileLinks = menu.querySelectorAll('a');
mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
        menu.classList.add('hidden');
    });
});

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
    const versionBadges = document.querySelectorAll('.version-badge');
    const directDownloadLink = document.getElementById('direct-download-link');

    const updateDOMRelease = (tag, downloadUrl) => {
        if (tag) {
            versionBadges.forEach(el => {
                el.innerText = tag;
            });
            if (directDownloadLink) {
                directDownloadLink.setAttribute('data-umami-event-version', tag);
            }
        }
        if (downloadUrl && directDownloadLink) {
            directDownloadLink.setAttribute('href', downloadUrl);
        }
    };

    // 1. Check localStorage cached release
    try {
        const cachedRaw = localStorage.getItem('hexprite-cached-release');
        if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            const isFresh = cached.cachedAt && (Date.now() - cached.cachedAt < 3600000); // 1 hour TTL
            if (cached.tag_name) {
                updateDOMRelease(cached.tag_name, cached.download_url);
            }
            if (isFresh) return; // Fresh cache, skip network request
        }
    } catch (e) {
        // Silently ignore storage issues
    }

    // 2. Multi-tier background release fetch
    const fetchOptions = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? { signal: AbortSignal.timeout(4000) }
        : {};

    const fetchRelease = async () => {
        // Tier 1: Try GitHub REST API
        try {
            const res = await fetch('https://api.github.com/repos/showmik/hexprite/releases?per_page=5', fetchOptions);
            if (res.ok) {
                const releases = await res.json();
                if (Array.isArray(releases) && releases.length > 0) {
                    const latest = releases.find(r => !r.draft);
                    if (latest && latest.tag_name) {
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
            // Proceed to Tier 2 fallback
        }

        // Tier 2: Try Shields.io (No rate limit, global CORS)
        try {
            const res = await fetch('https://img.shields.io/github/v/release/showmik/hexprite.json?include_prereleases', fetchOptions);
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
        if (!info) return;
        updateDOMRelease(info.tag, info.downloadUrl);
        try {
            localStorage.setItem('hexprite-cached-release', JSON.stringify({
                tag_name: info.tag,
                download_url: info.downloadUrl,
                cachedAt: Date.now()
            }));
        } catch (e) {}
    }).catch(() => {});
})();

