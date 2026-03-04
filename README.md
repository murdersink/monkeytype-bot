# Typing Site Input Corrector (Chrome Extension)

## Install
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:
   - `c:\Users\youruser\location\location\monkeytype-bot`

## Use
1. Open a typing website.
2. Click the extension icon.
3. Click **Enable**.
4. Choose a profile per mode (`time`, `words`, `quote`, `zen`):
   - `Strict`: correct any wrong character.
   - `Letters Only`: correct wrong letters, leave punctuation/numbers.
   - `Off`: no correction in that mode.
5. Type normally yourself.
6. If you press a wrong character, it is replaced based on the active mode profile.
7. Click **Disable** to turn correction off.
8. Optional: enable **Auto Restarter** in the popup.
9. Set auto restarter:
   - `Min Delay (ms)` and `Max Delay (ms)` for randomized restart timing.
   - `Idle Pause (sec)` so it pauses auto restarts if you stop real typing.

## Notes
- The extension runs on HTTP/HTTPS pages and is intended for typing websites.
- Correction is active only while enabled from the popup.
- Hotkey toggle: `Ctrl+Shift+E` (can be disabled in the popup).
- Auto restarter is currently tailored for Monkeytype-style result/restart buttons.
- Cross-site correction is best-effort and depends on each site's DOM structure.
