/**
 * Lyrics Learn - Chrome Extension
 * Injects translations below lyrics on Spotify
 * With click-for-definition and vocabulary saving
 */

(function () {
  'use strict';

  function isContextValid() {
    try {
      return !!chrome?.runtime?.id;
    } catch {
      return false;
    }
  }

  function safeChromeStorageGet(keys, cb) {
    if (!isContextValid()) return cb({});
    try {
      chrome.storage.local.get(keys, cb);
    } catch (e) {
      cb({});
    }
  }

  function safeChromeStorageSet(items, cb) {
    if (!isContextValid()) return;
    try {
      chrome.storage.local.set(items, cb || (() => {}));
    } catch (_) {}
  }

  const TRANSLATION_CACHE_KEY = 'lls_translation_cache';
  const VOCAB_KEY = 'lls_saved_vocab';
  const FROM_LANG_KEY = 'lls_from_lang';
  const TO_LANG_KEY = 'lls_to_lang';
  const ENABLED_KEY = 'lls_enabled';
  const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

  const LYRICS_LINE_SELECTOR = "div[data-testid='lyrics-line']";

  let fromLang = 'es';
  let toLang = 'en';
  let enabled = true;

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

  chrome.storage.local.get([VOCAB_KEY, TRANSLATION_CACHE_KEY, FROM_LANG_KEY, TO_LANG_KEY, ENABLED_KEY], (result) => {
    if (result[VOCAB_KEY]) savedVocab = new Set(result[VOCAB_KEY]);
    if (result[TRANSLATION_CACHE_KEY]) translationCache = result[TRANSLATION_CACHE_KEY];
    if (result[FROM_LANG_KEY]) fromLang = result[FROM_LANG_KEY];
    if (result[TO_LANG_KEY]) toLang = result[TO_LANG_KEY];
    if (result[ENABLED_KEY] !== undefined) enabled = result[ENABLED_KEY];
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes[VOCAB_KEY]) savedVocab = new Set(changes[VOCAB_KEY].newValue || []);
      if (changes[FROM_LANG_KEY]) fromLang = changes[FROM_LANG_KEY].newValue || 'es';
      if (changes[TO_LANG_KEY]) toLang = changes[TO_LANG_KEY].newValue || 'en';
      if (changes[ENABLED_KEY] !== undefined) enabled = changes[ENABLED_KEY].newValue;
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

  function getCachedTranslation(text, from, to) {
    from = from ?? fromLang;
    to = to ?? toLang;
    const key = `${from}|${to}|${text}`;
    if (translationCache[key] && Date.now() - translationCache[key].time < CACHE_MAX_AGE) {
      return translationCache[key].text;
    }
    return null;
  }

  function setCachedTranslation(text, from, to, translated) {
    const key = `${from}|${to}|${text}`;
    translationCache[key] = { text: translated, time: Date.now() };
    chrome.storage.local.set({ [TRANSLATION_CACHE_KEY]: translationCache });
  }

  async function translateWithMyMemory(text, from, to) {
    const params = new URLSearchParams({
      q: text.substring(0, 500),
      langpair: `${from}|${to}`,
      de: 'lyricslearn@extension.local',
    });
    const res = await fetch(`https://api.mymemory.translated.net/get?${params}`);
    const data = await res.json();
    if (data.responseStatus === 200) return data.responseData.translatedText;
    return null;
  }

  async function translateWithGoogle(text, from, to) {
    const sl = from === 'auto' ? 'auto' : from;
    const params = `&sl=${sl}&tl=${to}&q=${encodeURIComponent(text.substring(0, 500))}`;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t${params}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data[0]) {
      return data[0].map((arr) => arr[0]).filter(Boolean).join('');
    }
    return null;
  }

  async function translate(text, from, to) {
    from = from ?? fromLang;
    to = to ?? toLang;
    const cached = getCachedTranslation(text, from, to);
    if (cached) return cached;

    let translated = await translateWithMyMemory(text, from, to);
    if (!translated) translated = await translateWithGoogle(text, from, to);

    if (translated) setCachedTranslation(text, from, to, translated);
    return translated;
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

  async function getColloquialDefinition(word) {
    try {
      const res = await fetch(
        `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`
      );
      const data = await res.json();
      const list = data?.list;
      if (!list?.length) return null;
      const sorted = list.sort((a, b) => (b.thumbs_up || 0) - (a.thumbs_up || 0));
      const top = sorted[0];
      let text = top.definition?.replace(/\[([^\]]+)\]/g, '$1') || '';
      if (top.example) {
        const ex = top.example.replace(/\[([^\]]+)\]/g, '$1').trim();
        if (ex) text += ` — e.g. "${ex}"`;
      }
      return text || null;
    } catch (e) {
      console.warn('[Lyrics Learn Spanish] Colloquial lookup failed:', e);
    }
    return null;
  }

  function createDefinitionPopup(word, translation, definition, colloquial, x, y) {
    const existing = document.querySelector('.lls-definition-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.className = 'lls-definition-popup';

    let content = `<div class="lls-word-header">${escapeHtml(word)}</div>`;
    if (translation) content += `<div class="lls-translation-text">→ ${escapeHtml(translation)}</div>`;
    if (definition) content += `<div class="lls-definition-label">Formal</div><div class="lls-definition-text">${escapeHtml(definition)}</div>`;
    if (colloquial) content += `<div class="lls-definition-label">Slang / colloquial</div><div class="lls-definition-text lls-colloquial">${escapeHtml(colloquial)}</div>`;
    if (!translation && !definition && !colloquial) content += `<div class="lls-loading">Loading...</div>`;

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

  const looksLikeLyrics =
    (window.LLSlib && window.LLSlib.looksLikeLyrics) ||
    function (text) {
      if (!text || text.length > 200) return false;
      const t = text.trim();
      if (!t || t.length < 2) return false;
      if (/^[A-Za-z0-9+/=]+$/.test(t)) return false;
      if (/^[0-9a-fA-F]+$/.test(t) && t.length > 8) return false;
      if (t.startsWith('{') || t.startsWith('[') || t.includes('"')) return false;
      return /[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/.test(t) && (t.split(/\s+/).filter(Boolean).length >= 1 || t.length <= 30);
    };

  function isLikelyLyricLine(el) {
    const text = (el.textContent || '').trim();
    if (!looksLikeLyrics(text)) return false;
    if (el.querySelector('.lls-translation')) return false;
    const enhancedAncestor = el.closest('.lls-enhanced');
    if (enhancedAncestor && enhancedAncestor !== el) return false;
    return true;
  }

  function getFocusedLyric() {
    const lines = document.querySelectorAll(LYRICS_LINE_SELECTOR);
    if (!lines.length) return null;
    const classCounts = {};
    lines.forEach((line) => {
      line.classList?.forEach((cls) => { classCounts[cls] = (classCounts[cls] || 0) + 1; });
    });
    return Array.from(lines).find((line) =>
      Array.from(line.classList || []).some((cls) => classCounts[cls] === 1)
    );
  }

  function focusActiveLyric() {
    const focused = getFocusedLyric();
    if (focused) focused.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  function enhanceLyricLine(lineEl) {
    const hasTranslation = lineEl.querySelector('.lls-translation');
    if (lineEl.dataset.llsEnhanced === 'true' && hasTranslation) return;
    if (lineEl.dataset.llsEnhanced === 'true' && !hasTranslation) {
      lineEl.dataset.llsEnhanced = '';
      lineEl.classList.remove('lls-lyric-line', 'lls-enhanced');
    }
    const text = (lineEl.textContent || '').trim();
    if (!looksLikeLyrics(text)) return;

    lineEl.dataset.llsEnhanced = 'true';
    lineEl.classList.add('lls-lyric-line', 'lls-enhanced');

    const translationEl = document.createElement('div');
    translationEl.className = 'lls-translation';

    const cached = getCachedTranslation(text);
    if (cached) {
      translationEl.textContent = cached;
    } else {
      translationEl.textContent = '...';
      translate(text).then((translated) => {
        if (translated) translationEl.textContent = translated;
        else translationEl.textContent = '';
      });
    }

    wrapWordsInSpans(lineEl);
    lineEl.appendChild(translationEl);

    lineEl.querySelectorAll('.lls-word').forEach((wordSpan) => {
      wordSpan.addEventListener('click', async (e) => {
        e.stopPropagation();
        const word = (wordSpan.dataset.word || '').replace(/[^\wáéíóúñü]/gi, '');
        if (!word) return;

        const rect = wordSpan.getBoundingClientRect();
        const translationResult = await translate(word);
        const lookupWord = translationResult || word;
        const [definition, colloquialEn, colloquialOrig] = await Promise.all([
          getDefinition(lookupWord),
          getColloquialDefinition(lookupWord),
          word !== lookupWord ? getColloquialDefinition(word) : Promise.resolve(null),
        ]);
        const colloquial = colloquialOrig || colloquialEn;
        createDefinitionPopup(word, translationResult, definition, colloquial, rect.left, rect.top);
      });
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function findAndEnhanceLyrics() {
    if (!enabled) return;
    const isLyricsPage = /\/lyrics/.test(window.location.pathname);

    const containerSelectors = isLyricsPage
      ? [
          'main',
          '[role="main"]',
          '.npv-lyrics',
          '.npv-lyrics__content',
          '[data-testid="lyrics-root"]',
          '[data-testid="fullscreen-lyric"]',
          '[class*="Lyrics__Container"]',
          '[class*="lyrics-container"]',
          '[class*="lyrics"]',
          '[class*="Lyrics"]',
          '[class*="lyric"]',
        ]
      : [
          '.npv-lyrics',
          '.npv-lyrics__content',
          '[data-testid="lyrics-root"]',
          '[data-testid="fullscreen-lyric"]',
          '[class*="Lyrics__Container"]',
          '[class*="lyrics-container"]',
          '[class*="lyrics"]',
          '[class*="Lyrics"]',
          '[class*="lyric"]',
        ];

    let container = null;
    for (const sel of containerSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        container = el;
        break;
      }
    }

    if (!container && isLyricsPage) {
      container = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
    }
    if (!container) return;

    if (container === document.body && !isLyricsPage) return;

    const lyricsLineEls = document.querySelectorAll(LYRICS_LINE_SELECTOR);
    const sentenceLines = container.querySelectorAll('.npv-lyrics__sentences > *, [class*="lyrics__sentence"]');
    let lineElements = [];
    if (lyricsLineEls.length > 0) {
      lineElements = Array.from(lyricsLineEls).filter(isVisible);
    }
    if (lineElements.length === 0 && sentenceLines.length > 0) {
      lineElements = Array.from(sentenceLines).filter(isVisible);
    }
    if (lineElements.length === 0) {
      const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.classList?.contains('lls-enhanced') && node.querySelector('.lls-translation')) return NodeFilter.FILTER_REJECT;
          if (!isLikelyLyricLine(node)) return NodeFilter.FILTER_SKIP;
          if (node.children.length > 0 && !node.querySelector('.lls-word')) return NodeFilter.FILTER_SKIP;
          if (node.closest('[data-testid="now-playing-bar"]')) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
      false
    );

      const lines = [];
      let node;
      while ((node = walker.nextNode())) lines.push(node);
      lineElements = lines.slice(0, 80).filter(isVisible);
    }

    chrome.storage.local.get([FROM_LANG_KEY, TO_LANG_KEY, ENABLED_KEY], (r) => {
      fromLang = r[FROM_LANG_KEY] || 'es';
      toLang = r[TO_LANG_KEY] || 'en';
      if (r[ENABLED_KEY] === false) return;
      const toEnhance = lineElements.filter((el) => looksLikeLyrics((el.textContent || '').trim()));
      toEnhance.forEach(enhanceLyricLine);
      focusActiveLyric();
    });
  }

  function hasEnhancedNodes(nodes) {
    for (const n of nodes) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        if (n.classList?.contains('lls-enhanced') || n.classList?.contains('lls-translation') || n.classList?.contains('lls-word') || n.querySelector?.('.lls-enhanced, .lls-translation')) return true;
      }
    }
    return false;
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle?.(el);
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false;
    return true;
  }

  function hasLyricsLine(nodes) {
    for (const n of nodes) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        if (n.matches?.(LYRICS_LINE_SELECTOR)) return true;
        if (n.querySelector?.(LYRICS_LINE_SELECTOR)) return true;
      }
    }
    return false;
  }

  let lastEnhanceTime = 0;
  const ENHANCE_COOLDOWN_MS = 2500;

  function scheduleEnhance(delay = 0) {
    const run = () => {
      if (Date.now() - lastEnhanceTime < ENHANCE_COOLDOWN_MS) return;
      lastEnhanceTime = Date.now();
      const doEnhance = () => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(findAndEnhanceLyrics, { timeout: 150 });
        } else {
          requestAnimationFrame(findAndEnhanceLyrics);
        }
      };
      requestAnimationFrame(doEnhance);
    };
    if (delay) setTimeout(run, delay);
    else run();
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.removedNodes.length && hasEnhancedNodes(m.removedNodes)) {
        clearTimeout(window.llsCheckTimeout);
        window.llsCheckTimeout = setTimeout(() => scheduleEnhance(), 300);
        return;
      }
      if (m.addedNodes.length && hasLyricsLine(m.addedNodes)) {
        clearTimeout(window.llsCheckTimeout);
        window.llsCheckTimeout = setTimeout(() => scheduleEnhance(), 400);
        return;
      }
    }
  });

  let lyricsRecheckInterval = null;

  function init() {
    if (window.location.hostname !== 'open.spotify.com') return;

    observer.observe(document.body, { childList: true, subtree: true });
    scheduleEnhance();
    scheduleEnhance(1200);
    scheduleEnhance(3500);
    if (/\/lyrics/.test(window.location.pathname)) {
      scheduleEnhance(6000);
      lyricsRecheckInterval = setInterval(() => scheduleEnhance(), 3000);
    }
  }

  if (typeof window !== 'undefined') {
    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;
    const onNav = () => {
      if (/\/lyrics/.test(window.location.pathname)) {
        scheduleEnhance(600);
        if (!lyricsRecheckInterval) lyricsRecheckInterval = setInterval(() => scheduleEnhance(), 3000);
      } else if (lyricsRecheckInterval) {
        clearInterval(lyricsRecheckInterval);
        lyricsRecheckInterval = null;
      }
    };
    history.pushState = function (...args) {
      origPushState.apply(this, args);
      onNav();
    };
    history.replaceState = function (...args) {
      origReplaceState.apply(this, args);
      onNav();
    };
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.llsEnabled !== undefined) {
      enabled = msg.llsEnabled;
      if (enabled) scheduleEnhance();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
