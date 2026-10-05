const IDLE_SECONDS = 60;
const PAUSE_STATES = ['locked'];
const HEARTBEAT_MINUTES = 1;

function extractHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function matchLimit(limits, hostname) {
  if (!hostname) return null;
  if (limits[hostname]) return hostname;
  for (const key of Object.keys(limits)) {
    if (hostname.endsWith(`.${key}`)) return key;
  }
  return null;
}

function today() {
  return new Date().toDateString();
}

function rollOver(site) {
  if (site.resetDate === today()) return false;
  site.resetDate = today();
  site.timeLeft = site.originalLimit ?? site.timeLeft ?? 0;
  return true;
}

async function readLimits() {
  const { websiteLimits } = await chrome.storage.local.get('websiteLimits');
  const limits = websiteLimits || {};
  let changed = false;
  for (const site of Object.values(limits)) changed = rollOver(site) || changed;
  if (changed) await chrome.storage.local.set({ websiteLimits: limits });
  return limits;
}

let queue = Promise.resolve();
function serialise(task) {
  queue = queue.then(task, task);
  return queue;
}

async function sync(tabId, url) {
  const limits = await readLimits();
  const key = matchLimit(limits, extractHostname(url));
  if (!key) return;
  const site = limits[key];
  const remaining = Math.max(0, site.timeLeft ?? site.originalLimit ?? 0);
  const state = await chrome.idle.queryState(IDLE_SECONDS).catch(() => 'active');
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['tracker.js'] });
  } catch (error) {
    console.warn('[Site Limit] could not inject into', url, String(error));
    return;
  }
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'siteLimitSync', remaining, paused: PAUSE_STATES.includes(state) });
  } catch (error) {
    console.warn('[Site Limit] tracker did not answer on', url, String(error));
  }
}

async function syncActive() {
  const window = await chrome.windows.getLastFocused().catch(() => null);
  const [active] = window?.focused ? await chrome.tabs.query({ active: true, windowId: window.id }) : [];

  // A background tab cannot be trusted to know it is in the background: in some
  // window arrangements it still reports document.visibilityState as visible.
  const others = await chrome.tabs.query({});
  await Promise.all(
    others
      .filter((tab) => tab.id !== undefined && tab.id !== active?.id)
      .map((tab) => chrome.tabs.sendMessage(tab.id, { type: 'siteLimitPause', paused: true }).catch(() => {})),
  );

  if (active?.url && active.id !== undefined) await sync(active.id, active.url);
}

const onFocusChange = () => serialise(syncActive);

chrome.tabs.onActivated.addListener(onFocusChange);
chrome.windows.onFocusChanged.addListener(onFocusChange);
chrome.runtime.onStartup.addListener(onFocusChange);
chrome.runtime.onInstalled.addListener(onFocusChange);

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url && tab.active) serialise(syncActive);
});

chrome.idle.setDetectionInterval(IDLE_SECONDS);
chrome.idle.onStateChanged.addListener((state) => {
  const paused = PAUSE_STATES.includes(state);
  serialise(async () => {
    const tabs = await chrome.tabs.query({ active: true });
    for (const tab of tabs) {
      if (tab.id === undefined) continue;
      await chrome.tabs.sendMessage(tab.id, { type: 'siteLimitPause', paused }).catch(() => {});
    }
    if (!paused) await syncActive();
  });
});

chrome.alarms.create('heartbeat', { periodInMinutes: HEARTBEAT_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'heartbeat') serialise(syncActive);
});

async function spend(hostname, seconds, tabId) {
  const limits = await readLimits();
  const key = matchLimit(limits, hostname);
  if (!key) return null;
  const site = limits[key];
  site.timeLeft = Math.max(0, (site.timeLeft ?? site.originalLimit ?? 0) - Math.max(0, Math.round(seconds)));
  site.spentToday = (site.spentDate === today() ? site.spentToday ?? 0 : 0) + Math.max(0, Math.round(seconds));
  site.spentDate = today();
  await chrome.storage.local.set({ websiteLimits: limits });

  if (site.timeLeft === 0 && tabId !== undefined) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['overlay.js'] }).catch(() => {});
  }
  return site;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'siteLimitSpent') {
    serialise(async () => {
      const hostname = extractHostname(sender?.tab?.url || sender?.url || '');
      const site = await spend(hostname, message.seconds, sender?.tab?.id);
      sendResponse({ ok: true, remaining: site?.timeLeft ?? null });
    });
    return true;
  }

  if (message?.type === 'siteLimitState') {
    serialise(async () => {
      const limits = await readLimits();
      const key = matchLimit(limits, extractHostname(sender?.tab?.url || ''));
      sendResponse({ key, site: key ? limits[key] : null });
    });
    return true;
  }

  if (message?.type === 'siteLimitCloseTab') {
    const tabId = sender?.tab?.id;
    if (tabId === undefined) {
      sendResponse({ success: false, error: 'Could not tell which tab to close.' });
      return true;
    }
    // Deliberately not serialised: closing a tab touches none of the stored
    // figures, and the queue is shared with work that waits on other tabs.
    void (async () => {
      let reason = null;
      try {
        // Removing the last tab would quit the browser, so leave one behind.
        const open = await chrome.tabs.query({});
        if (open.length <= 1) await chrome.tabs.create({});
        reason = await Promise.race([
          chrome.tabs.remove(tabId).then(() => null, (error) => String(error)),
          new Promise((resolve) => setTimeout(() => resolve('the page is holding on to the tab'), 4000)),
        ]);
      } catch (error) {
        reason = String(error);
      }
      // The answer is sent last on purpose. An open message port is what keeps the
      // service worker alive, and a worker shut down early is a tab that never
      // closes. By now the tab is usually gone and the answer lands nowhere, which
      // is why the page treats silence as success.
      sendResponse({ success: reason === null, error: reason ?? undefined });
      if (reason === null) return;
      console.warn('[Site Limit] could not close tab', tabId, reason);
      chrome.tabs.sendMessage(tabId, { type: 'siteLimitCloseFailed', reason }).catch(() => {});
    })();
    return true;
  }

  if (message?.type === 'extendTimeRequest') {
    serialise(async () => {
      try {
        const hostname = extractHostname(message.currentUrl || sender?.tab?.url || sender?.url || '');
        const limits = await readLimits();
        const key = matchLimit(limits, hostname);
        if (!key) {
          sendResponse({ success: false, error: 'This site does not have a limit.' });
          return;
        }

        const site = limits[key];
        const granted = Math.max(0, Math.round(message.requestedSeconds) || 0);
        site.timeLeft = (site.timeLeft ?? 0) + granted;
        site.overridesToday = (site.overrideDate === today() ? site.overridesToday ?? 0 : 0) + 1;
        site.overrideSecondsToday = (site.overrideDate === today() ? site.overrideSecondsToday ?? 0 : 0) + granted;
        site.overrideDate = today();
        await chrome.storage.local.set({ websiteLimits: limits });

        const tabId = sender?.tab?.id;
        if (tabId !== undefined) {
          await chrome.tabs.sendMessage(tabId, { type: 'siteLimitSync', remaining: site.timeLeft }).catch(() => {});
        }
        sendResponse({ success: true, appliedTime: site.timeLeft, overridesToday: site.overridesToday });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    });
    return true;
  }

  return false;
});
