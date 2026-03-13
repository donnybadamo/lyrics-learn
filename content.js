/**
 * Lyrics Learn Spanish - Chrome Extension
 * Injects English translations below Spanish lyrics on Spotify
 * With click-for-definition and vocabulary saving
 */

(function () {
  'use strict';

  const TRANSLATION_CACHE_KEY = 'lls_translation_cache';
  const VOCAB_KEY = 'lls_saved_vocab';
  const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

  // Spotify lyrics selectors - try multiple as DOM structure may change
  const LYRICS_SELECTORS = [
    '[data-testid="fullscreen-lyric"]',
    '[data-testid="lyrics"]',
    '[class*="lyrics"]',
    '[class*="Lyrics"]',
    '[class*="lyric"]',
    'div[role="list"]', // Lyrics often in a list
  ];

  let translationCache = {};
  let savedVocab = new Set();

  // Load saved vocab
  chrome.storage.local.get([VOCAB_KEY, TRANSLATION_CACHE_KEY], (result) => {
    if (result[VOCAB_KEY]) savedVocab = new Set(result[VOCAB_KEY]);
    if (result[TRANSLATION_CACHE_KEY]) translationCache = result[TRANSLATION_CACHE_KEY];
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[VOCAB_KEY]) {
      savedVocab = new Set(changes[VOCAB_KEY].newValue || []);
    }
  });

  function saveVocab(word) {
    const w = word.toLowerCase().trim();
    if (!w) return;
    savedVocab.add(w);
    chrome.storage.local.set({ [VOCAB_KEY]: [...savedVocab] });
  }

  function isSaved(word) {
    return savedVocab.has(word.toLowerCase());
  }

  async function translate(text, fromLang = 'es', toLang = 'en') {
    const key = `${fromLang}|${toLang}|${text}`;
    if (translationCache[key] && Date.now() - translationCache[key].time < CACHE_MAX_AGE) {
      return translationCache[key].text;
    }
    try {
      const params = new URLSearchParams({
        q: text.substring(0, 500),
        langpair: `${fromLang}|${toLang}`,
        de: 'lyricslearn@extension.local',
      });
      const res = await fetch(`https://api.mymemory.translated.net/get?${params}`);
      const data = await res.json();
      if (data.responseStatus === 200) {
        const translated = data.responseData.translatedText;
        translationCache[key] = { text: translated, time: Date.now() };
        chrome.storage.local.set({ [TRANSLATION_CACHE_KEY]: translationCache });
        return translated;
      }
    } catch (e) {
      console.warn('[Lyrics Learn Spanish] Translation failed:', e);
    }
    return null;
  }

  async function getDefinition(word) {
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data[0]?.meanings?.[0]?.definitions?.[0]?.definition) {
        return data[0].meanings[0].definitions[0].definition;
      }
    } catch (e) {
      console.warn('[Lyrics Learn Spanish] Definition failed:', e);
    }
    return null;
  }

  function createDefinitionPopup(word, translation, definition, x, y) {
    const existing = document.querySelector('.lls-definition-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.className = 'lls-definition-popup';

    let content = `<div class="lls-word-header">${word}</div>`;
    if (translation) content += `<div class="lls-translation-text">→ ${translation}</div>`;
    if (definition) content += `<div class="lls-definition-text">${definition}</div>`;
    else if (!translation && !definition) content += `<div class="lls-loading">Loading...</div>`;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'lls-save-btn' + (isSaved(word) ? ' lls-saved' : '');
    saveBtn.textContent = isSaved(word) ? '✓ Saved to vocab' : '+ Save to vocab';
    saveBtn.onclick = () => {
      if (!isSaved(word)) {
        saveVocab(word);
        saveBtn.textContent = '✓ Saved to vocab';
        saveBtn.classList.add('lls-saved');
      }
    };

    popup.innerHTML = content;
    popup.appendChild(saveBtn);

    document.body.appendChild(popup);

    const rect = popup.getBoundingClientRect();
    let left = x;
    let top = y - rect.height - 10;
    if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 10;
    if (left < 10) left = 10;
    if (top < 10) top = y + 20;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    const close = (e) => {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 100);
  }

  function wrapWordsInSpans(element) {
    const text = element.textContent;
    if (!text.trim()) return element;

    const words = text.split(/(\s+)/);
    element.innerHTML = '';
    words.forEach((part) => {
      if (/^\s+$/.test(part)) {
        element.appendChild(document.createTextNode(part));
      } else {
        const span = document.createElement('span');
        span.className = 'lls-word' + (isSaved(part.toLowerCase()) ? ' lls-saved' : '');
        span.textContent = part;
        span.dataset.word = part;
        element.appendChild(span);
      }
    });
    return element;
  }

  function isLikelyLyricLine(el) {
    const text = (el.textContent || '').trim();
    if (!text || text.length > 200) return false;
    if (el.querySelector('.lls-translation')) return false;
    if (el.closest('.lls-enhanced')) return false;
    return true;
  }

  function enhanceLyricLine(lineEl) {
    if (lineEl.dataset.llsEnhanced === 'true') return;
    const text = (lineEl.textContent || '').trim();
    if (!text) return;

    lineEl.dataset.llsEnhanced = 'true';
    lineEl.classList.add('lls-lyric-line', 'lls-enhanced');

    const translationEl = document.createElement('div');
    translationEl.className = 'lls-translation';
    translationEl.textContent = '...';

    translate(text).then((translated) => {
      if (translated) translationEl.textContent = translated;
      else translationEl.textContent = '';
    });

    wrapWordsInSpans(lineEl);
    lineEl.appendChild(translationEl);

    lineEl.querySelectorAll('.lls-word').forEach((wordSpan) => {
      wordSpan.addEventListener('click', async (e) => {
        e.stopPropagation();
        const word = (wordSpan.dataset.word || '').replace(/[^\wáéíóúñü]/gi, '');
        if (!word) return;

        const rect = wordSpan.getBoundingClientRect();
        const translation = await translate(word);
        const definition = await getDefinition(translation || word);
        createDefinitionPopup(word, translation, definition, rect.left, rect.top);
      });
    });
  }

  function findAndEnhanceLyrics() {
    // Spotify lyrics containers (structure may vary - Spotify updates often)
    const containerSelectors = [
      '.npv-lyrics',
      '.npv-lyrics__content',
      '[data-testid="lyrics-root"]',
      '[data-testid="fullscreen-lyric"]',
      '[class*="Lyrics__Container"]',
      '[class*="lyrics-container"]',
    ];

    let container = null;
    for (const sel of containerSelectors) {
      container = document.querySelector(sel);
      if (container) break;
    }
    container = container || document.body;

    // Strategy 1: Spotify's .npv-lyrics__sentences children (individual lines)
    const sentenceLines = container.querySelectorAll('.npv-lyrics__sentences > *, [class*="lyrics__sentence"]');
    if (sentenceLines.length > 0) {
      sentenceLines.forEach(enhanceLyricLine);
      return;
    }

    // Strategy 2: Any element that looks like a lyric line (single text block, in lyrics area)
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.classList?.contains('lls-enhanced')) return NodeFilter.FILTER_REJECT;
          if (node.querySelector('.lls-translation')) return NodeFilter.FILTER_REJECT;
          const text = (node.textContent || '').trim();
          if (!text || text.length > 200) return NodeFilter.FILTER_SKIP;
          if (node.children.length > 0 && !node.querySelector('.lls-word')) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
      false
    );

    const lines = [];
    let node;
    while ((node = walker.nextNode())) lines.push(node);
    lines.slice(0, 50).forEach(enhanceLyricLine);
  }

  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    for (const m of mutations) {
      if (m.addedNodes.length) {
        shouldCheck = true;
        break;
      }
    }
    if (shouldCheck) {
      clearTimeout(window.llsCheckTimeout);
      window.llsCheckTimeout = setTimeout(findAndEnhanceLyrics, 300);
    }
  });

  function init() {
    if (window.location.hostname !== 'open.spotify.com') return;

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(findAndEnhanceLyrics, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
