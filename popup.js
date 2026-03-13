const VOCAB_KEY = 'lls_saved_vocab';
const FROM_LANG_KEY = 'lls_from_lang';
const TO_LANG_KEY = 'lls_to_lang';
const ENABLED_KEY = 'lls_enabled';

const LANG_LABELS = {
  auto: 'Auto-detect', en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese',
  it: 'Italian', de: 'German', ru: 'Russian', hi: 'Hindi', ta: 'Tamil', te: 'Telugu',
  bn: 'Bengali', mr: 'Marathi', ur: 'Urdu', gu: 'Gujarati', kn: 'Kannada',
  ml: 'Malayalam', pa: 'Punjabi', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
};

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function saveSetting(key, value) {
  chrome.storage.local.set({ [key]: value });
}

function initCustomSelect(containerId, storageKey) {
  const container = document.getElementById(containerId);
  const trigger = container.querySelector('.custom-select-trigger');
  const valueEl = container.querySelector('.custom-select-value');
  const menu = container.querySelector('.custom-select-menu');

  function setValue(val, label) {
    valueEl.textContent = label || LANG_LABELS[val] || val;
    trigger.dataset.value = val;
    saveSetting(storageKey, val);
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !menu.hidden;
    document.querySelectorAll('.custom-select-menu').forEach((m) => { m.hidden = true; });
    menu.hidden = isOpen;
    trigger.setAttribute('aria-expanded', !isOpen);
  });

  menu.querySelectorAll('button[data-value]').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const val = btn.dataset.value;
      setValue(val, btn.textContent.trim());
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  return setValue;
}

function loadSettings() {
  chrome.storage.local.get([FROM_LANG_KEY, TO_LANG_KEY, ENABLED_KEY], (r) => {
    const fromLang = r[FROM_LANG_KEY] || 'es';
    const toLang = r[TO_LANG_KEY] || 'en';

    const fromVal = document.querySelector('#from-lang-dropdown .custom-select-trigger');
    const toVal = document.querySelector('#to-lang-dropdown .custom-select-trigger');
    if (fromVal) {
      fromVal.querySelector('.custom-select-value').textContent = LANG_LABELS[fromLang] || fromLang;
      fromVal.dataset.value = fromLang;
    }
    if (toVal) {
      toVal.querySelector('.custom-select-value').textContent = LANG_LABELS[toLang] || toLang;
      toVal.dataset.value = toLang;
    }

    const toggle = document.getElementById('enable-toggle');
    if (toggle) toggle.checked = r[ENABLED_KEY] !== false;
  });
}

function setupEnableToggle() {
  const toggle = document.getElementById('enable-toggle');
  if (!toggle) return;
  toggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({ [ENABLED_KEY]: enabled });
    chrome.tabs.query({ url: 'https://open.spotify.com/*' }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { llsEnabled: enabled }).catch(() => {});
      });
    });
  });
}

function loadVocab() {
  chrome.storage.local.get([VOCAB_KEY], (result) => {
    const vocab = result[VOCAB_KEY] || [];
    const list = document.getElementById('vocab-list');

    if (vocab.length === 0) {
      list.innerHTML = '<div class="empty-state">No words saved yet. Click words in Spotify lyrics to add them.</div>';
      return;
    }

    list.innerHTML = vocab
      .sort((a, b) => a.localeCompare(b))
      .map(
        (word) => `
        <div class="vocab-item" data-word="${escapeHtml(word)}">
          <span>${escapeHtml(word)}</span>
          <button class="vocab-remove" type="button" title="Remove">×</button>
        </div>
      `
      )
      .join('');

    list.querySelectorAll('.vocab-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = btn.closest('.vocab-item').dataset.word;
        const updated = vocab.filter((w) => w !== word);
        chrome.storage.local.set({ [VOCAB_KEY]: updated });
        loadVocab();
      });
    });
  });
}

document.getElementById('clear-vocab').addEventListener('click', (e) => {
  e.stopPropagation();
  chrome.storage.local.set({ [VOCAB_KEY]: [] });
  loadVocab();
});

function escapeCsvField(s) {
  const str = String(s ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function exportVocabQuizletCsv(vocab) {
  const header = 'term,definition\n';
  if (vocab.length === 0) return header;
  const rows = vocab
    .sort((a, b) => a.localeCompare(b))
    .map((word) => `${escapeCsvField(word)},`)
    .join('\n');
  return header + rows;
}

document.getElementById('export-vocab').addEventListener('click', async (e) => {
  e.stopPropagation();
  const result = await chrome.storage.local.get([VOCAB_KEY]);
  const vocab = result[VOCAB_KEY] || [];
  if (vocab.length === 0) {
    alert('No vocabulary to export. Save words from Spotify lyrics first.');
    return;
  }
  const csv = exportVocabQuizletCsv(vocab);
  try {
    await navigator.clipboard.writeText(csv);
    const btn = e.target;
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  } catch {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lyrics-learn-vocab-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
});

initCustomSelect('from-lang-dropdown', FROM_LANG_KEY);
initCustomSelect('to-lang-dropdown', TO_LANG_KEY);
setupEnableToggle();
loadSettings();
loadVocab();
