const FROM_LANG_KEY = 'lls_from_lang';
const TO_LANG_KEY = 'lls_to_lang';
const ENABLED_KEY = 'lls_enabled';

chrome.storage.local.get([FROM_LANG_KEY, TO_LANG_KEY, ENABLED_KEY], (r) => {
  document.getElementById('from-lang').value = r[FROM_LANG_KEY] || 'es';
  document.getElementById('to-lang').value = r[TO_LANG_KEY] || 'en';
  const toggle = document.getElementById('enable-toggle');
  if (toggle) toggle.checked = r[ENABLED_KEY] !== false;
});

function showStatus(msg, isSuccess) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status' + (isSuccess ? ' saved' : '');
  setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 2000);
}

document.getElementById('from-lang').addEventListener('change', (e) => {
  chrome.storage.local.set({ [FROM_LANG_KEY]: e.target.value });
  showStatus('Saved', true);
});

document.getElementById('to-lang').addEventListener('change', (e) => {
  chrome.storage.local.set({ [TO_LANG_KEY]: e.target.value });
  showStatus('Saved', true);
});

const enableToggle = document.getElementById('enable-toggle');
if (enableToggle) {
  enableToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ [ENABLED_KEY]: e.target.checked });
    showStatus('Saved', true);
    chrome.tabs.query({ url: 'https://open.spotify.com/*' }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { llsEnabled: e.target.checked }).catch(() => {});
      });
    });
  });
}
