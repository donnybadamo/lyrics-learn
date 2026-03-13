const VOCAB_KEY = 'lls_saved_vocab';

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
        <div class="vocab-item" data-word="${word}">
          <span>${word}</span>
          <button class="vocab-remove" title="Remove">×</button>
        </div>
      `
      )
      .join('');

    list.querySelectorAll('.vocab-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const word = btn.closest('.vocab-item').dataset.word;
        const updated = vocab.filter((w) => w !== word);
        chrome.storage.local.set({ [VOCAB_KEY]: updated });
        loadVocab();
      });
    });
  });
}

document.getElementById('clear-vocab').addEventListener('click', () => {
  chrome.storage.local.set({ [VOCAB_KEY]: [] });
  loadVocab();
});

loadVocab();
