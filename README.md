# Lyrics Learn Spanish

A Chrome extension that helps English speakers learn Spanish through music. Works with **Spotify's web player** (open.spotify.com).

## Features

- **Inline translations** – Spanish lyrics with smaller English translation below each line (karaoke-style sync with Spotify's built-in lyrics)
- **Click for definition** – Click any word to see its English translation and definition
- **Save vocabulary** – Save words to your personal vocab list for later review
- **Free translation** – Uses MyMemory API (no API key needed; 50k chars/day with email param)

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `Translate` folder (this project)

## How to Use

1. Go to [open.spotify.com](https://open.spotify.com) and play a **Spanish song**
2. Click the **microphone/lyrics icon** below the player to open the lyrics view
3. English translations appear below each Spanish line
4. **Click any word** for translation + definition, and to save it to your vocab
5. Click the extension icon to view and manage your saved vocabulary

## Requirements

- Spotify **Premium** (lyrics are limited for free accounts)
- Chrome or Chromium-based browser

## Notes

- **Spotify DOM changes** – If translations stop appearing after a Spotify update, the extension may need selector updates. Open an issue with details.
- **Translation limits** – MyMemory allows ~50k characters/day. Translations are cached for 24 hours to reduce API calls.
- **LyricsTranslate.com** – You mentioned this site; it could be added as a supported site in a future version.

## File Structure

```
Translate/
├── manifest.json    # Extension config
├── content.js       # Main logic (Spotify lyrics injection)
├── content.css      # Styles for translations & popup
├── popup.html       # Extension popup (saved vocab)
├── popup.js         # Popup logic
└── README.md
```
