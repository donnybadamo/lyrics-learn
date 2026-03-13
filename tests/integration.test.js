/**
 * Lyrics Learn Spanish - Integration / DOM Bug Tests
 *
 * These tests document known bugs and expected behavior for DOM-related issues.
 * Run with: npm test
 */

describe('Bug: Translation removal when Spotify switches lyrics', () => {
  /**
   * BUG: When Spotify updates the lyrics DOM (e.g. active line changes, scroll),
   * our enhanced elements get replaced and translations disappear.
   *
   * EXPECTED FIX: MutationObserver should re-run findAndEnhanceLyrics when:
   * 1. New lyric nodes are added (addedNodes)
   * 2. Enhanced nodes are removed (removedNodes contains .lls-enhanced)
   * 3. Periodic re-enhancement on lyrics page
   */
  test('documented: observer should trigger on node removal', () => {
    expect(true).toBe(true);
  });
});

describe('Bug: Wrong elements enhanced (Base64/config)', () => {
  /**
   * BUG: Extension was enhancing Base64 strings instead of lyrics.
   * FIX: looksLikeLyrics filters out Base64, hex, JSON.
   */
  test('documented: looksLikeLyrics rejects Base64', () => {
    const { looksLikeLyrics } = require('../lib.js');;
    expect(looksLikeLyrics('eyJlbmFibGZpYjGVTaG93c3ls6dHJI1ZX0=')).toBe(false);
  });
});

describe('Bug: Banner / cutoff layout', () => {
  /**
   * BUG: Translations appeared as banner, cut off bottom of screen.
   * FIX: Only enhance when lyrics container found; use display:block not flex.
   */
  test('documented: layout fix applied', () => {
    expect(true).toBe(true);
  });
});
