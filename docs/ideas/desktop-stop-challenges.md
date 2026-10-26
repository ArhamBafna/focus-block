# Idea: Stop Session Challenges for Desktop App

## Summary
Add stop session challenges (e.g., countdown timer, paragraph typing, pattern memory puzzle, math/logic challenge, reflection prompt) to the desktop app (`apps/desktop/`), matching the Chrome extension capability.

## Context
- The Chrome extension (`apps/extension/`) currently has challenge gates that require users to complete an exercise before stopping a session early.
- The desktop app currently allows stopping active sessions directly without friction.
- Parity between desktop and extension will allow users to enforce discipline consistently across both platforms.

## Key Requirements
1. Port challenge types (`countdown`, `typing`, `pattern`, `math`, `reflection`) or build desktop-native versions.
2. Add settings in desktop Settings page to choose the challenge method and configure which session types (Lockdown, Focus, Both, None) require challenges.
3. Gate session stop in `Home.tsx` on Challenge completion before issuing stop IPC.
