/**
 * Lyrics Learn Spanish - Bug Testing Suite
 */

const { looksLikeLyrics, isTranslationCacheValid, getTranslationCacheKey } = require('../lib.js');

describe('looksLikeLyrics', () => {
  describe('should ACCEPT Spanish lyrics', () => {
    test('simple Spanish phrase', () => {
      expect(looksLikeLyrics('Si un día me voy')).toBe(true);
    });
    test('Spanish with accents', () => {
      expect(looksLikeLyrics('Ojalá que no te olvides de mí nunca')).toBe(true);
    });
    test('Spanish with ñ', () => {
      expect(looksLikeLyrics('Mañana')).toBe(true);
    });
    test('short phrase', () => {
      expect(looksLikeLyrics('Qué rico')).toBe(true);
    });
    test('question with ¿', () => {
      expect(looksLikeLyrics('¿Qué dice\'?')).toBe(true);
    });
  });

  describe('should REJECT non-lyrics', () => {
    test('Base64 encoded string', () => {
      expect(looksLikeLyrics('eyJlbmFibGZpYjGVTaG93c3ls6dHJI1ZX0=')).toBe(false);
    });
    test('short Base64', () => {
      expect(looksLikeLyrics('e30=')).toBe(false);
    });
    test('hex string', () => {
      expect(looksLikeLyrics('a1b2c3d4e5f6')).toBe(false);
    });
    test('JSON object', () => {
      expect(looksLikeLyrics('{"enable":true}')).toBe(false);
    });
    test('JSON array', () => {
      expect(looksLikeLyrics('[1,2,3]')).toBe(false);
    });
    test('empty string', () => {
      expect(looksLikeLyrics('')).toBe(false);
    });
    test('whitespace only', () => {
      expect(looksLikeLyrics('   ')).toBe(false);
    });
    test('single character', () => {
      expect(looksLikeLyrics('a')).toBe(false);
    });
    test('too long', () => {
      expect(looksLikeLyrics('a'.repeat(201))).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('English lyrics (for bilingual songs)', () => {
      expect(looksLikeLyrics('Baby, baby')).toBe(true);
    });
    test('mixed language', () => {
      expect(looksLikeLyrics('Tú, mi baby')).toBe(true);
    });
  });
});

describe('isTranslationCacheValid', () => {
  test('valid cache', () => {
    const cached = { text: 'hello', time: Date.now() - 1000 };
    expect(isTranslationCacheValid(cached, 24 * 60 * 60 * 1000)).toBe(true);
  });
  test('expired cache', () => {
    const cached = { text: 'hello', time: Date.now() - 25 * 60 * 60 * 1000 };
    expect(isTranslationCacheValid(cached, 24 * 60 * 60 * 1000)).toBe(false);
  });
  test('null cache', () => {
    expect(isTranslationCacheValid(null, 1000)).toBe(false);
  });
});

describe('getTranslationCacheKey', () => {
  test('generates consistent key', () => {
    expect(getTranslationCacheKey('es', 'en', 'Hola')).toBe('es|en|Hola');
  });
});
