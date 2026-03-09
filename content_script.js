/**
 * ARGUS Browser Extension — Content Script
 * Injects trust badges on LinkedIn, Reddit, Instagram, X, Facebook
 * Runs on every page load, watches for dynamic content
 */

const ARGUS_API = 'https://argus.googleadsagent.ai';

const PLATFORM_SELECTORS = {
  linkedin: {
    hostname: 'linkedin.com',
    profileCards: [
      '.artdeco-entity-lockup',             // Feed profile mentions
      '.pv-top-card',                        // Profile page header
      '.search-result__info',                // Search results
      '.member-result'
    ],
    handleExtractor: (el) => {
      const link = el.querySelector('a[href*="/in/"]');
      if (!link) return null;
      const match = link.href.match(/\/in\/([^/?]+)/);
      return match ? { platform: 'linkedin', handle: match[1], url: link.href } : null;
    }
  },
  reddit: {
    hostname: 'reddit.com',
    profileCards: [
      'shreddit-post',
      '.Post',
      '[data-testid="post-container"]',
      '.UserLink'
    ],
    handleExtractor: (el) => {
      const link = el.querySelector('a[href*="/user/"]');
      if (!link) return null;
      const match = link.href.match(/\/user\/([^/?]+)/);
      return match ? { platform: 'reddit', handle: match[1], url: link.href } : null;
    }
  },
  twitter: {
    hostname: 'x.com',
    profileCards: [
      '[data-testid="tweet"]',
      '[data-testid="UserCell"]',
      '[data-testid="primaryColumn"]'
    ],
    handleExtractor: (el) => {
      const link = el.querySelector('a[href^="/"][href$="/"]') || el.querySelector('[data-testid="User-Name"] a');
      if (!link) return null;
      const match = link.href.match(/x\.com\/([^/?]+)/);
      return match && !['home','explore','notifications'].includes(match[1])
        ? { platform: 'x', handle: match[1], url: `https://x.com/${match[1]}` }
        : null;
    }
  },
  instagram: {
    hostname: 'instagram.com',
    profileCards: [
      'article',
      '._aaqg',
      '.x1lliihq'
    ],
    handleExtractor: (el) => {
      const link = el.querySelector('a[href^="/"][href$="/"]');
      if (!link) return null;
      const match = link.href.match(/instagram\.com\/([^/?]+)/);
      return match ? { platform: 'instagram', handle: match[1], url: `https://instagram.com/${match[1]}` } : null;
    }
  }
};

// Cache to avoid duplicate API calls
const scoreCache = new Map();
const processedElements = new WeakSet();

// Determine current platform
function getCurrentPlatform() {
  const hostname = window.location.hostname;
  for (const [platform, config] of Object.entries(PLATFORM_SELECTORS)) {
    if (hostname.includes(config.hostname)) return { platform, config };
  }
  return null;
}

// Fetch score from Argus API (with local cache)
async function getScore(platform, handle, profileUrl) {
  const cacheKey = `${platform}:${handle}`;
  if (scoreCache.has(cacheKey)) return scoreCache.get(cacheKey);

  try {
    const res = await fetch(
      `${ARGUS_API}/api/score?platform=${platform}&handle=${encodeURIComponent(handle)}&url=${encodeURIComponent(profileUrl)}`,
      { headers: { 'X-Source': 'argus-extension' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    scoreCache.set(cacheKey, data);
    return data;
  } catch (e) {
    return null;
  }
}

// Create the trust badge element
function createBadge(scoreData, profileInfo) {
  const badge = document.createElement('a');
  badge.href = scoreData.page_url || `${ARGUS_API}/submit?url=${encodeURIComponent(profileInfo.url)}`;
  badge.target = '_blank';
  badge.rel = 'noopener noreferrer';
  badge.className = 'argus-badge';
  badge.setAttribute('data-argus', 'true');

  const { trust_score, risk_level, verdict_summary, status } = scoreData;

  let bgColor, emoji, label;
  if (status === 'not_analyzed') {
    bgColor = '#1a2e45'; emoji = '👁️'; label = 'Analyzing...';
  } else if (trust_score <= 25) {
    bgColor = '#7c1d1d'; emoji = '🚨'; label = `${trust_score} CRITICAL`;
  } else if (trust_score <= 40) {
    bgColor = '#7c3a1d'; emoji = '⚠️'; label = `${trust_score} HIGH RISK`;
  } else if (trust_score <= 60) {
    bgColor = '#78350f'; emoji = '⚡'; label = `${trust_score} MEDIUM`;
  } else {
    bgColor = '#14532d'; emoji = '✅'; label = `${trust_score} CLEAN`;
  }

  badge.innerHTML = `
    <span class="argus-badge-inner" style="
      background: ${bgColor};
      color: #fff;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 700;
      font-family: -apple-system, sans-serif;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      text-decoration: none;
      white-space: nowrap;
      z-index: 9999;
      position: relative;
    ">
      ${emoji} ${label}
    </span>
  `;

  // Tooltip on hover
  if (verdict_summary && trust_score < 60) {
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      display: none;
      position: absolute;
      bottom: calc(100% + 8px);
      left: 0;
      background: #0D1B2A;
      border: 1px solid #1B4F72;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12px;
      color: #e2e8f0;
      max-width: 280px;
      line-height: 1.5;
      z-index: 99999;
      font-family: -apple-system, sans-serif;
      font-weight: 400;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    `;
    tooltip.textContent = verdict_summary?.slice(0, 160) + (verdict_summary?.length > 160 ? '...' : '');

    const seeMore = document.createElement('div');
    seeMore.style.cssText = 'color: #38bdf8; margin-top: 6px; font-size: 11px;';
    seeMore.textContent = 'Click for full analysis →';
    tooltip.appendChild(seeMore);

    badge.appendChild(tooltip);
    badge.addEventListener('mouseenter', () => { tooltip.style.display = 'block'; });
    badge.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
  }

  return badge;
}

// Inject badge into a profile element
async function injectBadge(element, profileInfo) {
  if (processedElements.has(element)) return;
  processedElements.add(element);

  const scoreData = await getScore(profileInfo.platform, profileInfo.handle, profileInfo.url);
  if (!scoreData) return;

  // Only inject for non-trivially clean profiles or not-yet-analyzed
  if (scoreData.trust_score > 75 && scoreData.status !== 'not_analyzed') return;

  const badge = createBadge(scoreData, profileInfo);
  badge.style.cssText = 'display: inline-block; margin-left: 6px; vertical-align: middle; position: relative;';

  // Find best injection point (name element)
  const nameEl = element.querySelector('h1, h2, h3, .name, [data-testid="UserName"]') || element;
  const firstChild = nameEl.firstChild;
  if (firstChild) {
    nameEl.insertBefore(badge, firstChild.nextSibling);
  } else {
    nameEl.appendChild(badge);
  }
}

// Scan page for profile cards
async function scanPage() {
  const current = getCurrentPlatform();
  if (!current) return;

  const { platform, config } = current;

  for (const selector of config.profileCards) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const profileInfo = config.handleExtractor(el);
      if (profileInfo) {
        injectBadge(el, profileInfo).catch(() => {});
      }
    }
  }
}

// Right-click context menu submission
document.addEventListener('contextmenu', (e) => {
  const current = getCurrentPlatform();
  if (!current) return;

  const target = e.target.closest('[href*="/in/"], [href*="/user/"], [href*="x.com/"]');
  if (target) {
    window.__argusContextTarget = target.href;
  }
});

// Watch for dynamic content (SPAs)
const observer = new MutationObserver((mutations) => {
  let hasNewNodes = false;
  for (const m of mutations) {
    if (m.addedNodes.length > 0) { hasNewNodes = true; break; }
  }
  if (hasNewNodes) {
    clearTimeout(window.__argusDebounce);
    window.__argusDebounce = setTimeout(scanPage, 800);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial scan
setTimeout(scanPage, 1500);

// Inject styles
const style = document.createElement('style');
style.textContent = `
  .argus-badge { text-decoration: none !important; }
  .argus-badge:hover .argus-badge-inner { opacity: 0.9; }
`;
document.head.appendChild(style);
