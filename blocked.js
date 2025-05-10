// blocked.js
document.getElementById('ignore1').addEventListener('click', () => extendTime(60));
document.getElementById('ignore15').addEventListener('click', () => extendTime(900));

function extendTime(seconds) {
  const params = new URLSearchParams(window.location.search);
  const hostname = params.get('url');
  if (!hostname) {
    alert('Missing hostname');
    return;
  }

  chrome.runtime.sendMessage({ type: 'extendTime', hostname, seconds }, (response) => {
    if (chrome.runtime.lastError) {
      alert('Error: ' + chrome.runtime.lastError.message);
      return;
    }

    if (response?.success) {
      window.location.href = `https://${hostname}`;
    } else {
      alert('Failed to extend time');
    }
  });
}
