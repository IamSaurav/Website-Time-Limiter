function extractHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Track time usage and reset daily
setInterval(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length || !tabs[0].url) return;

    const hostname = extractHostname(tabs[0].url);
    if (!hostname) return;

    chrome.storage.local.get('websiteLimits', (data) => {
      const limits = data.websiteLimits || {};
      if (!limits[hostname]) return;

      const now = Date.now();
      const today = new Date().toDateString();
      const site = limits[hostname];

      // Reset timeLeft once per day
      if (site.resetDate !== today) {
        site.resetDate = today;
        site.timeLeft = site.originalLimit || site.timeLeft;
      }

      const lastVisited = site.lastVisited || now;
      const elapsed = Math.floor((now - lastVisited) / 1000);

      site.timeLeft = Math.max(0, site.timeLeft - elapsed);
      site.lastVisited = now;

      chrome.storage.local.set({ websiteLimits: limits }, () => {
        if (site.timeLeft <= 0 && !tabs[0].url.includes('blocked.html')) {
          chrome.tabs.update(tabs[0].id, {
            url: chrome.runtime.getURL(`blocked.html?url=${encodeURIComponent(hostname)}`)
          });
        }
      });
    });
  });
}, 1000);

// Update lastVisited when navigation starts
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  const hostname = extractHostname(details.url);
  if (!hostname) return;

  chrome.storage.local.get('websiteLimits', (data) => {
    const limits = data.websiteLimits || {};
    if (limits[hostname]) {
      limits[hostname].lastVisited = Date.now();
      chrome.storage.local.set({ websiteLimits: limits });
    }
  });
});

// Handle "ignore time" request from blocked.html
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'extendTime') {
    const { hostname, seconds } = message;
    chrome.storage.local.get('websiteLimits', (data) => {
      const limits = data.websiteLimits || {};
      if (limits[hostname]) {
        limits[hostname].timeLeft = seconds;
        limits[hostname].lastVisited = Date.now();
        chrome.storage.local.set({ websiteLimits: limits }, () => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: false });
      }
    });
    return true; // Keeps sendResponse channel open
  }
});
