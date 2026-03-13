/**
 * Lyrics Learn Spanish - Testable core logic
 * Extracted for unit testing
 */

function looksLikeLyrics(text) {
  if (!text || text.length > 200) return false;
  const t = text.trim();
  if (!t) return false;
  if (t.length < 2) return false;
  if (/^[A-Za-z0-9+/=]+$/.test(t)) return false;
  if (/^[0-9a-fA-F]+$/.test(t) && t.length > 8) return false;
  if (t.startsWith('{') || t.startsWith('[') || t.includes('"')) return false;
  const hasLetter = /[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/.test(t);
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  return hasLetter && (wordCount >= 1 || t.length <= 30);
}

function isTranslationCacheValid(cached, maxAgeMs) {
  return !!(cached && Date.now() - cached.time < maxAgeMs);
}

function getTranslationCacheKey(fromLang, toLang, text) {
  return `${fromLang}|${toLang}|${text}`;
}

if (typeof window !== 'undefined') {
  window.LLSlib = { looksLikeLyrics, isTranslationCacheValid, getTranslationCacheKey };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { looksLikeLyrics, isTranslationCacheValid, getTranslationCacheKey };
}
