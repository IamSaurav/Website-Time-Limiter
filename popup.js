document.addEventListener('DOMContentLoaded', () => {
  const websiteInput = document.getElementById('website');
  const hoursInput = document.getElementById('hours');
  const minutesInput = document.getElementById('minutes');
  const secondsInput = document.getElementById('seconds');
  const addButton = document.getElementById('addButton');
  const websiteList = document.getElementById('websiteList');
  const errorDiv = document.getElementById('error');
  const successDiv = document.getElementById('success');

  // Inject CSS for professional styling
  const style = document.createElement('style');
  style.textContent = `
    .website-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px;
      margin: 10px 0;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      transition: box-shadow 0.2s ease;
    }
    .website-item:hover {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    .website-info {
      flex: 1;
    }
    .website-info strong {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    .quota-info {
      display: block;
      font-size: 12px;
      color: #666;
      margin-top: 4px;
      font-weight: 200;
    }
    .website-item button {
      background-color: #ff4d4f;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      max-width: 80px;
      font-size: 12px;
      font-weight: 500;
      text-align: center;
      transition: background-color 0.2s ease;
    }
    .website-item button:hover {
      background-color: #ff7875;
    }
    #websiteList {
      max-width: 600px;
      margin: 0 auto;
    }
  `;
  document.head.appendChild(style);

  function displayError(message) {
    errorDiv.textContent = message;
    successDiv.textContent = '';
    setTimeout(() => errorDiv.textContent = '', 3000);
  }

  function displaySuccess(message) {
    successDiv.textContent = message;
    errorDiv.textContent = '';
    setTimeout(() => successDiv.textContent = '', 3000);
  }

  function normalizeUrl(url) {
    return url.trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');
  }

  function validateInputs(url, hours, minutes, seconds) {
    if (!url) return 'Please enter a website URL.';
    const normalizedUrl = normalizeUrl(url);
    const urlPattern = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;
    if (!urlPattern.test(normalizedUrl)) return 'Invalid URL format (e.g., facebook.com).';
    try {
      new URL('https://' + normalizedUrl);
    } catch (e) {
      console.error('URL validation error:', e);
      return 'Invalid URL format.';
    }
    if (hours < 0 || minutes < 0 || seconds < 0) return 'Time values cannot be negative.';
    if (minutes > 59 || seconds > 59) return 'Minutes and seconds must be less than 60.';
    if (hours === 0 && minutes === 0 && seconds === 0) return 'Please set a valid time limit.';
    return '';
  }

  function loadWebsites() {
    chrome.storage.local.get('websiteLimits', (data) => {
      websiteList.innerHTML = '';
      const limits = data.websiteLimits || {};
      Object.entries(limits).forEach(([url, limit]) => {
        const timeLeft = limit.timeLeft !== undefined ? limit.timeLeft : limit.originalLimit;
        const item = document.createElement('div');
        item.className = 'website-item';
        const dailyQuota = formatTime(limit.originalLimit || timeLeft);
        item.innerHTML = `
          <div class="website-info">
            <strong>${url}</strong>
            <span class="quota-info">Daily Quota: ${dailyQuota}</span>
            <span class="quota-info">Time Left: ${formatTime(timeLeft)}</span>
          </div>
          <button data-url="${url}">Remove</button>
        `;

        websiteList.appendChild(item);
      });

      websiteList.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
          const url = button.dataset.url;
          chrome.storage.local.get('websiteLimits', (data) => {
            const limits = data.websiteLimits || {};
            delete limits[url];
            chrome.storage.local.set({ websiteLimits: limits }, loadWebsites);
          });
        });
      });
    });
  }

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    return parts.length > 0 ? parts.join(' ') : '0s';
  }

  addButton.addEventListener('click', () => {
    const url = normalizeUrl(websiteInput.value);
    const hours = parseInt(hoursInput.value) || 0;
    const minutes = parseInt(minutesInput.value) || 0;
    const seconds = parseInt(secondsInput.value) || 0;
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    const error = validateInputs(url, hours, minutes, seconds);
    if (error) {
      displayError(error);
      return;
    }

    chrome.storage.local.get('websiteLimits', (data) => {
      const limits = data.websiteLimits || {};
      const today = new Date().toDateString();
      limits[url] = {
        originalLimit: totalSeconds,
        timeLeft: totalSeconds,
        lastVisited: Date.now(),
        resetDate: today
      };
      chrome.storage.local.set({ websiteLimits: limits }, () => {
        websiteInput.value = '';
        hoursInput.value = '';
        minutesInput.value = '';
        secondsInput.value = '';
        displaySuccess(`Time limit added for ${url}`);
        loadWebsites();
      });
    });
  });

  loadWebsites();
});