# Lyrics Learn

A Chrome extension that helps you learn languages through music. Works with **Spotify's web player** (open.spotify.com).

---

## Quick Start (5 minutes)

**1. Download the extension**
- Click the green **Code** button above → **Download ZIP**
- Extract the ZIP (double-click on Mac, or right-click → Extract on Windows)

**2. Install in Chrome**
- Open Chrome and type `chrome://extensions` in the address bar
- Turn on **Developer mode** (switch in the top-right corner)
- Click **Load unpacked**
- Select the unzipped `lyrics-learn` folder

**3. Use it**
- Go to [Spotify](https://open.spotify.com) and play a song
- Click the **microphone icon** (lyrics view) next to the play button
- Translations appear below each line — click any word to save it

That's it. Click the extension icon in your toolbar to see saved words and export to Quizlet.

> **Note:** Spotify Premium is required — lyrics are limited on free accounts.

---

## Features

- **Inline translations** – Lyrics with translation below each line (karaoke-style sync with Spotify's built-in lyrics)
- **Click for definition** – Click any word to see translation and formal/slang definitions
- **Save vocabulary** – Save words with English translations to your vocab list
- **Export to Quizlet** – Export saved vocab as CSV for Quizlet import
- **Free translation** – Uses MyMemory API with Google Translate fallback (no API key needed)

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the project folder

## How to Use

1. **Settings** – Right-click extension icon → Options to set languages
2. Go to [open.spotify.com](https://open.spotify.com) and play a song
3. Click the **microphone/lyrics icon** to open the lyrics view
4. Translations appear below each line in real time
5. **Click any word** for translation + definition, and to save it to your vocab
6. Click the extension icon to view saved vocabulary and **Export CSV** for Quizlet

## Export to Quizlet

1. Save words from Spotify lyrics (click words to add them – translation is saved automatically)
2. In the popup, click **Export CSV**
3. Paste into [Quizlet](https://quizlet.com) → Create → Import
4. CSV includes term + definition (word → English translation)

## Requirements

- Spotify **Premium** (lyrics are limited for free accounts)
- Chrome or Chromium-based browser

## Notes

- **Spotify DOM changes** – If translations stop appearing after a Spotify update, the extension may need selector updates.
- **Translation limits** – MyMemory allows ~50k characters/day. Translations are cached for 24 hours.

## Testing

```bash
npm install
npm test
```

## File Structure

```
├── manifest.json    # Extension config
├── lib.js           # Testable core logic
├── content.js       # Main logic (Spotify lyrics injection)
├── content.css      # Styles for translations & popup
├── popup.html       # Extension popup
├── popup.js         # Popup logic
├── images/          # Extension icons (microphone)
├── tests/           # Jest test suite
└── README.md
```
