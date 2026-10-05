(() => {
  if (window.__siteLimitTracker) return;
  window.__siteLimitTracker = true;

  const TICK_MS = 1000;
  const MAX_TICK_SECONDS = 3;
  const REPORT_EVERY_SECONDS = 2;

  let remaining = null;
  let unreported = 0;
  let paused = false;
  let spent = false;
  let lastTick = null;

  function awake() {
    return document.visibilityState === 'visible' && document.hasFocus() && !paused;
  }

  function report() {
    if (unreported <= 0) return;
    const seconds = unreported;
    unreported = 0;
    chrome.runtime.sendMessage({ type: 'siteLimitSpent', seconds }, (response) => {
      if (chrome.runtime.lastError) return;
      if (typeof response?.remaining === 'number' && !spent) remaining = response.remaining;
    });
  }

  function reachedZero() {
    if (spent) return;
    spent = true;
    report();
    chrome.runtime.sendMessage({ type: 'siteLimitSpent', seconds: 0 }, () => void chrome.runtime.lastError);
  }

  function tick() {
    if (remaining === null || spent) return;

    if (!awake()) {
      lastTick = null;
      report();
      return;
    }

    const now = Date.now();
    if (lastTick === null) {
      lastTick = now;
      return;
    }

    const elapsed = Math.min(MAX_TICK_SECONDS, Math.round((now - lastTick) / 1000));
    if (elapsed <= 0) return;
    lastTick = now;
    remaining = Math.max(0, remaining - elapsed);
    unreported += elapsed;

    if (remaining === 0) {
      reachedZero();
      return;
    }
    if (unreported >= REPORT_EVERY_SECONDS) report();
  }

  setInterval(tick, TICK_MS);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'siteLimitTrackerState') {
      sendResponse({ remaining, unreported, paused, spent, awake: awake() });
      return;
    }
    if (message?.type === 'siteLimitPause') {
      paused = Boolean(message.paused);
      if (paused) report();
      return;
    }
    if (message?.type !== 'siteLimitSync') return;
    if (typeof message.paused === 'boolean') paused = message.paused;
    remaining = Math.max(0, Math.round(message.remaining));
    unreported = 0;
    lastTick = null;
    // Cleared first: reachedZero() returns early when it is already set, so setting
    // it here is what used to let a tab open freely on a limit spent earlier today.
    spent = false;
    if (remaining === 0) reachedZero();
  });

  window.addEventListener('blur', report, true);
  window.addEventListener('pagehide', report, true);
  document.addEventListener('visibilitychange', () => {
    if (!awake()) report();
  }, true);
})();
