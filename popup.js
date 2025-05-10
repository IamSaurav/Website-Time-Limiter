document.addEventListener('DOMContentLoaded', () => {
  const websiteInput = document.getElementById('website');
  const hoursInput = document.getElementById('hours');
  const minutesInput = document.getElementById('minutes');
  const secondsInput = document.getElementById('seconds');
  const addButton = document.getElementById('addButton');
  const websiteList = document.getElementById('websiteList');
  const errorDiv = document.getElementById('error');
  const successDiv = document.getElementById('success');

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
      console.log('Loaded website limits:', data.websiteLimits);
      websiteList.innerHTML = '';
      const limits = data.websiteLimits || {};
      Object.entries(limits).forEach(([url, limit]) => {
        const timeLeft = limit.timeLeft !== undefined ? limit.timeLeft : limit.totalTime;
        const item = document.createElement('div');
        item.className = 'website-item';
        item.innerHTML = `
          <span>${url} (${formatTime(timeLeft)} remaining)</span>
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
            chrome.storage.local.set({ websiteLimits: limits }, () => {
              console.log(`Removed limit for ${url}`);
              loadWebsites();
            });
          });
        });
      });
    });
  }

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  }

  addButton.addEventListener('click', () => {
    const url = normalizeUrl(websiteInput.value);
    const hours = parseInt(hoursInput.value) || 0;
    const minutes = parseInt(minutesInput.value) || 0;
    const seconds = parseInt(secondsInput.value) || 0;
    const totalTime = hours * 3600 + minutes * 60 + seconds;

    const error = validateInputs(url, hours, minutes, seconds);
    if (error) {
      displayError(error);
      return;
    }

    chrome.storage.local.get('websiteLimits', (data) => {
      const limits = data.websiteLimits || {};
      limits[url] = { totalTime, timeLeft: totalTime, lastVisited: Date.now() };
      chrome.storage.local.set({ websiteLimits: limits }, () => {
        console.log(`Added limit for ${url}: ${totalTime} seconds`);
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