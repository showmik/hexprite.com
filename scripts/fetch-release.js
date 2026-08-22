const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const cacheFile = path.join(repoRoot, "data", "release.json");

const FALLBACK_RELEASE = {
    tag_name: "v0.1.1-beta",
    version: "0.1.1-beta",
    name: "Hexprite v0.1.1-beta",
    prerelease: true,
    download_url: "https://github.com/showmik/hexprite/releases/download/v0.1.1-beta/Hexprite-Setup-0.1.1-beta-x64.exe",
    release_url: "https://github.com/showmik/hexprite/releases/tag/v0.1.1-beta",
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

function readCachedRelease() {
    try {
        if (fs.existsSync(cacheFile)) {
            const raw = fs.readFileSync(cacheFile, "utf8");
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn("Failed to read cached release:", e.message);
    }
    return FALLBACK_RELEASE;
}

function saveCachedRelease(data) {
    try {
        const dir = path.dirname(cacheFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
        console.warn("Failed to save cached release:", e.message);
    }
}

async function fetchFromAtomFeed() {
    try {
        const fetchOptions = {
            headers: { "User-Agent": "hexprite-website-build" },
            signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined,
        };
        const res = await fetch("https://github.com/showmik/hexprite/releases.atom", fetchOptions);
        if (!res.ok) throw new Error("HTTP " + res.status);

        const xml = await res.text();
        const tagMatch = xml.match(/<id>tag:github\.com,\d+:Repository\/\d+\/([^<]+)<\/id>/);
        if (!tagMatch || !tagMatch[1]) throw new Error("Could not parse tag from Atom feed");

        const tagName = tagMatch[1].trim();
        const versionNum = tagName.replace(/^v/, "");
        const titleMatch = xml.match(/<title>([^<]+)<\/title>/g);
        const releaseTitle = titleMatch && titleMatch[1] ? titleMatch[1].replace(/<\/?title>/g, "").trim() : "Hexprite " + tagName;
        const updatedMatch = xml.match(/<updated>([^<]+)<\/updated>/g);
        const publishedAt = updatedMatch && updatedMatch[1] ? updatedMatch[1].replace(/<\/?updated>/g, "").trim() : new Date().toISOString();

        let downloadUrl = "";
        try {
            const assetsRes = await fetch("https://github.com/showmik/hexprite/releases/expanded_assets/" + tagName, fetchOptions);
            if (assetsRes.ok) {
                const assetsHtml = await assetsRes.text();
                const allExeMatches = assetsHtml.match(/href="(\/showmik\/hexprite\/releases\/download\/[^"]+\.exe)"/gi) || [];
                const urls = allExeMatches.map(m => {
                    const clean = m.match(/href="([^"]+)"/i);
                    return clean ? "https://github.com" + clean[1] : "";
                }).filter(Boolean);
                const setupUrl = urls.find(u => u.toLowerCase().includes("setup"));
                downloadUrl = setupUrl || urls[0] || "";
            }
        } catch (assetErr) {}

        if (!downloadUrl) {
            downloadUrl = "https://github.com/showmik/hexprite/releases/download/" + tagName + "/Hexprite-Setup-" + versionNum + "-x64.exe";
        }

        return {
            tag_name: tagName,
            version: versionNum,
            name: releaseTitle,
            prerelease: tagName.includes("beta") || tagName.includes("alpha") || tagName.includes("rc"),
            download_url: downloadUrl,
            release_url: "https://github.com/showmik/hexprite/releases/tag/" + tagName,
            published_at: publishedAt,
            updated_at: new Date().toISOString(),
        };
    } catch (err) {
        console.warn("Atom feed fetch failed (" + err.message + ")");
        return null;
    }
}

async function fetchFromRestApi() {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const headers = {
        "User-Agent": "hexprite-website-build",
        "Accept": "application/vnd.github.v3+json",
    };
    if (token) {
        headers["Authorization"] = "Bearer " + token;
    }

    try {
        const fetchOptions = {
            headers,
            signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
        };
        const res = await fetch("https://api.github.com/repos/showmik/hexprite/releases?per_page=10", fetchOptions);

        if (!res.ok) {
            console.warn("GitHub REST API returned status " + res.status + " (" + res.statusText + ")");
            return null;
        }

        const releases = await res.json();
        if (!Array.isArray(releases) || releases.length === 0) return null;

        const latest = releases.find((r) => !r.draft);
        if (!latest) return null;

        const tagName = latest.tag_name;
        const versionNum = tagName.replace(/^v/, "");

        let downloadUrl = "";
        if (Array.isArray(latest.assets) && latest.assets.length > 0) {
            const exeAssets = latest.assets.filter((a) => a.name && a.name.toLowerCase().endsWith(".exe"));
            const setupAsset = exeAssets.find((a) => a.name.toLowerCase().includes("setup")) || exeAssets[0];
            if (setupAsset && setupAsset.browser_download_url) {
                downloadUrl = setupAsset.browser_download_url;
            }
        }

        if (!downloadUrl) {
            downloadUrl = "https://github.com/showmik/hexprite/releases/download/" + tagName + "/Hexprite-Setup-" + versionNum + "-x64.exe";
        }

        return {
            tag_name: tagName,
            version: versionNum,
            name: latest.name || tagName,
            prerelease: Boolean(latest.prerelease),
            download_url: downloadUrl,
            release_url: latest.html_url || ("https://github.com/showmik/hexprite/releases/tag/" + tagName),
            published_at: latest.published_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    } catch (err) {
        console.warn("GitHub REST API fetch failed (" + err.message + ")");
        return null;
    }
}

async function getReleaseInfo() {
    const cached = readCachedRelease();

    // Strategy 1: Atom Feed (rate-limit free)
    let releaseData = await fetchFromAtomFeed();

    // Strategy 2: GitHub REST API (if Atom Feed failed)
    if (!releaseData) {
        releaseData = await fetchFromRestApi();
    }

    // Strategy 3: Cached data
    if (!releaseData) {
        console.warn("All remote fetch methods failed. Using cached release data.");
        releaseData = cached;
    } else {
        saveCachedRelease(releaseData);
        console.log("Successfully resolved release: " + releaseData.tag_name + " (" + (releaseData.prerelease ? "pre-release" : "stable") + ")");
    }

    return releaseData;
}

if (require.main === module) {
    getReleaseInfo().then((info) => {
        console.log("Release Information:", JSON.stringify(info, null, 2));
    });
}

module.exports = { getReleaseInfo, readCachedRelease, saveCachedRelease };
