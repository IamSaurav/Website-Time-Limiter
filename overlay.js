(function () {
  if (document.getElementById('timeBlockerOverlay')) return;

  const HOLD_MS = 1600;
  const currentUrl = location.href;

  // A <dialog> opened with showModal() paints in the browser's top layer, above
  // every fixed header and every z-index on the page. Nothing else is reliable.
  const host = document.createElement('dialog');
  host.id = 'timeBlockerOverlay';
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'inset: 0',
    'width: 100vw',
    'max-width: 100vw',
    'height: 100vh',
    'max-height: 100vh',
    'margin: 0',
    'padding: 0',
    'border: 0',
    'background: transparent',
    'overflow: hidden',
    'z-index: 2147483647',
  ].join(';');

  // A dialog cannot host a shadow root, so the styles live in a div inside it.
  const shell = document.createElement('div');
  shell.style.cssText = 'all: initial; display: block; position: absolute; inset: 0;';
  host.appendChild(shell);

  const root = shell.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; margin: 0; }

      .sheet {
        position: absolute; inset: 0;
        display: grid; place-items: center;
        padding: 40px 24px;
        overflow: auto;
        background: rgba(14, 16, 19, .88);
        backdrop-filter: blur(16px) saturate(.6);
        -webkit-backdrop-filter: blur(16px) saturate(.6);
        font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        -webkit-font-smoothing: antialiased;
        color: #ffffff;
      }

      .block {
        width: 100%; max-width: 560px;
        outline: none;
        animation: rise .24s cubic-bezier(.2,.8,.3,1) both;
      }
      @keyframes rise { from { opacity: 0; transform: translateY(12px) } }
      @media (prefers-reduced-motion: reduce) { .block { animation: none } }

      .site { font-size: 14px; font-weight: 600; letter-spacing: .01em; color: #aab2bb; }
      h1 {
        margin-top: 8px;
        font-size: clamp(38px, 6vw, 64px);
        font-weight: 640; letter-spacing: -.035em; line-height: 1;
      }

      .meter { margin-top: 36px; height: 4px; border-radius: 99px; background: rgba(255,255,255,.14); display: flex; overflow: hidden; }
      .meter .used { background: #ffffff; }
      .meter .over { background: #e4572e; }

      .figures { display: flex; justify-content: space-between; gap: 16px; margin-top: 14px; font-size: 15px; color: #aab2bb; }
      .over-by { font-weight: 640; color: #ff8a65; }

      .facts { margin-top: 22px; font-size: 13px; color: #8b939c; }

      .actions { margin-top: 30px; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
      .gap { flex: 1 1 0; min-width: 0; }

      button {
        font: inherit; cursor: pointer;
        font-size: 14px; font-weight: 560;
        color: #e8eaed; background: transparent;
        border: 1px solid rgba(255,255,255,.22); border-radius: 10px;
        padding: 10px 18px; min-height: 46px;
        position: relative; overflow: hidden; isolation: isolate;
        transition: border-color .15s, background .15s, color .15s;
      }
      button:hover:not(:disabled) { border-color: rgba(255,255,255,.5); background: rgba(255,255,255,.07); }
      button:disabled { opacity: .4; cursor: default; }
      button:focus-visible { outline: 2px solid #ff8a65; outline-offset: 3px; }

      /* The solid one, because leaving is the thing the limit was set for. */
      .primary { background: #ffffff; border-color: #ffffff; color: #16181b; }
      .primary:hover:not(:disabled) { background: #dfe3e7; border-color: #dfe3e7; }

      /* The longer override has to be held down. One click should not buy a quarter of an hour. */
      .hold .fill {
        position: absolute; inset: 0; z-index: -1; width: 0%;
        background: rgba(228, 87, 46, .32);
      }
      .hold.holding .fill { width: 100%; transition: width ${HOLD_MS}ms linear; }
      .hold.holding { border-color: #e4572e; }

      .error { margin-top: 16px; font-size: 13px; color: #ff8a65; }
      .error:empty { display: none; }
    </style>

    <div class="sheet">
      <div class="block" role="document" id="fb-block" tabindex="-1">
        <div class="site" id="fb-host"></div>
        <h1 id="fb-title">Time's up</h1>

        <div class="meter" aria-hidden="true">
          <div class="used" id="fb-used" style="width:100%"></div>
          <div class="over" id="fb-over" style="width:0%"></div>
        </div>
        <div class="figures">
          <span id="fb-usage"></span>
          <span class="over-by" id="fb-overby"></span>
        </div>

        <p class="facts" id="fb-facts"></p>

        <div class="actions">
          <button type="button" id="fb-1">1 more min</button>
          <button type="button" class="hold" id="fb-15"><span class="fill"></span>15 more mins</button>
          <span class="gap"></span>
          <button type="button" class="primary" id="fb-close">Close tab</button>
        </div>

        <p class="error" id="fb-error" role="alert"></p>
      </div>
    </div>
  `;

  document.documentElement.appendChild(host);
  const $ = (id) => root.getElementById(id);
  const BUTTONS = ['fb-1', 'fb-15', 'fb-close'];

  if (typeof host.showModal === 'function') {
    try {
      host.showModal();
    } catch (e) {
      host.setAttribute('open', '');
    }
  } else {
    host.setAttribute('open', '');
  }
  host.addEventListener('cancel', (event) => event.preventDefault());

  const previousFocus = document.activeElement;
  $('fb-block').focus();

  function duration(seconds) {
    const total = Math.max(0, Math.round(seconds / 60));
    if (total === 0) return 'under a min';
    const h = Math.floor(total / 60);
    const m = total % 60;
    const parts = [];
    if (h > 0) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
    if (m > 0) parts.push(`${m} min${m === 1 ? '' : 's'}`);
    return parts.join(' ');
  }

  function untilMidnight() {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return Math.round((midnight.getTime() - now.getTime()) / 1000);
  }

  function render(site, key) {
    $('fb-host').textContent = key || location.hostname.replace(/^www\./, '');

    const facts = [`Resets in ${duration(untilMidnight())}.`];
    if (!site) {
      $('fb-usage').textContent = 'You have used up the time you set for today.';
      $('fb-facts').textContent = facts.join(' ');
      return;
    }

    const limit = Math.max(0, site.originalLimit ?? 0);
    const spent = Math.max(limit, site.spentToday ?? limit);
    const over = Math.max(0, spent - limit);

    const overShare = spent > 0 ? Math.min(40, Math.round((over / spent) * 100)) : 0;
    $('fb-used').style.width = `${100 - overShare}%`;
    $('fb-over').style.width = `${overShare}%`;

    $('fb-usage').textContent = duration(spent);
    $('fb-usage').title = `of the ${duration(limit)} you set`;
    $('fb-overby').textContent = over > 0 ? `${duration(over)} over` : '';

    const today = new Date().toDateString();
    const overrides = site.overrideDate === today ? site.overridesToday ?? 0 : 0;
    if (overrides > 0) facts.push(`Ignored ${overrides} time${overrides === 1 ? '' : 's'} today.`);
    $('fb-facts').textContent = facts.join(' ');
  }

  // The close is answered before it is attempted, so a refusal comes back later,
  // on its own. The reason goes to this page's console so it can be read without
  // digging into the service worker.
  function onCloseRefused(message) {
    if (message?.type !== 'siteLimitCloseFailed') return;
    if (!host.isConnected) return;
    console.warn('[Site Limit] close refused:', message.reason);
    fail('Chrome would not close this tab. Press Cmd+W.');
  }
  chrome.runtime.onMessage.addListener(onCloseRefused);

  chrome.runtime.sendMessage({ type: 'siteLimitState' }, (response) => {
    if (chrome.runtime.lastError) {
      render(null, null);
      return;
    }
    render(response?.site ?? null, response?.key ?? null);
  });

  function dismiss() {
    // Each override removes this overlay and injects a fresh copy next time. Without
    // this the listeners of every dismissed copy stay registered for the life of the
    // page, each one still holding a shadow root that is no longer in the document.
    chrome.runtime.onMessage.removeListener(onCloseRefused);
    observer.disconnect();
    if (typeof host.close === 'function' && host.open) host.close();
    host.remove();
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  }

  // Chrome's own wording ("The message port closed before a response was received")
  // is never shown: it describes the plumbing, not anything the reader can act on.
  function fail(message) {
    if (!host.isConnected) return;
    for (const id of BUTTONS) $(id).disabled = false;
    $('fb-error').textContent = message || 'That did not work. Try again.';
  }

  // Reloading the extension orphans this script: chrome.runtime is still there but
  // every call fails. Without this the buttons look broken for no stated reason.
  function send(message, done) {
    const STALE = /context invalidated|extension context|receiving end does not exist/i;
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (STALE.test(chrome.runtime.lastError?.message || '')) {
          fail('Site Limit was updated. Reload the page.');
          return;
        }
        done(response, chrome.runtime.lastError ?? null);
      });
    } catch (error) {
      fail('Site Limit was updated. Reload the page.');
    }
  }

  function extendTime(requestedSeconds) {
    for (const id of BUTTONS) $(id).disabled = true;
    send({ type: 'extendTimeRequest', currentUrl, requestedSeconds }, (response, error) => {
      if (error || !response?.success) {
        fail(response?.error);
        return;
      }
      dismiss();
    });
  }

  // window.close() is refused on any tab the page did not open itself, so this goes
  // through the service worker and chrome.tabs.remove. A silent answer is normal:
  // the port dies with the tab. So nothing is claimed either way, and the buttons
  // simply come back if this page turns out to still be here.
  $('fb-close').addEventListener('click', () => {
    for (const id of BUTTONS) $(id).disabled = true;
    send({ type: 'siteLimitCloseTab' }, (response) => {
      if (response && !response.success) fail(response.error);
    });
    setTimeout(() => {
      for (const id of BUTTONS) $(id).disabled = false;
    }, 3000);
  });

  $('fb-1').addEventListener('click', () => extendTime(60));

  const hold = $('fb-15');
  let holdTimer = null;
  const startHold = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (hold.disabled || holdTimer !== null) return;
    hold.classList.add('holding');
    holdTimer = setTimeout(() => {
      holdTimer = null;
      hold.classList.remove('holding');
      extendTime(900);
    }, HOLD_MS);
  };
  const cancelHold = () => {
    if (holdTimer === null) return;
    clearTimeout(holdTimer);
    holdTimer = null;
    hold.classList.remove('holding');
  };
  hold.addEventListener('pointerdown', startHold);
  hold.addEventListener('pointerup', cancelHold);
  hold.addEventListener('pointerleave', cancelHold);
  hold.addEventListener('pointercancel', cancelHold);
  hold.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      startHold(e);
    }
  });
  hold.addEventListener('keyup', cancelHold);
  hold.addEventListener('click', (e) => e.preventDefault());

  document.body.style.overflow = 'hidden';
  document.body.style.pointerEvents = 'none';
  host.style.pointerEvents = 'auto';

  function stopAllMedia() {
    document.querySelectorAll('video, audio').forEach((el) => {
      try {
        el.pause();
      } catch (e) {}
    });
  }

  stopAllMedia();
  const observer = new MutationObserver(stopAllMedia);
  observer.observe(document.body, { childList: true, subtree: true });
})();
