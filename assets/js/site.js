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
    try {
        const res = await fetch('https://api.github.com/repos/showmik/hexprite');
        if (!res.ok) throw new Error('GitHub API Error or Rate Limited');
        const data = await res.json();
        return data.stargazers_count;
    } catch (error) {
        console.warn('GitHub API failed, falling back to Shields.io:', error);
        const res = await fetch('https://img.shields.io/github/stars/showmik/hexprite.json');
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
