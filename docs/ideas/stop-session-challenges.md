# Refined Stop-Session Challenges Blueprint

## Problem Statement
How might we prevent users from impulsively stopping lockdown sessions early by introducing settings-configurable challenges that block the removal of Chrome declarativeNetRequest (DNR) rules until successfully solved?

## Recommended Direction
We will implement an anti-cheat, persistent challenge modal system. The user configures their preferred challenge in Settings. During an active lockdown, clicking "Stop Session" triggers a modal gating screen. 
- **Persistence**: The challenge state is stored in `chrome.storage.local`. If the user closes the popup, the session remains locked.
- **DNR Integrity**: The background service worker will only remove the site-blocking (DNR) rules when it receives a verified "challenge-completed" IPC signal. 

## Key Assumptions to Validate
- [ ] Closing and reopening the popup during a challenge does not leak access to blocked sites.
- [ ] Chrome service worker successfully preserves DNR rules on browser restart while a challenge is pending.
- [ ] The custom paragraph text matches exactly without allowing copy-paste bypasses.

## MVP Scope (Settings Configuration)
- **Challenge Dropdown**: None, Countdown Timer, Type a Paragraph, Pattern Memory (3x3), Math Challenge, Reflection Prompt.
- **Timer Settings**: Sub-configs for duration (15s, 30s, 60s, 2m) and a guided breathing toggle.
- **Default Paragraphs**: Built-in set of reflective text prompts (no custom input for now).

## Not Doing (and Why)
- **Custom Paragraph Uploads**: Out of scope for MVP to keep storage schema simple.
- **Variable Grid Sizes**: Keep the memory puzzle locked at 3x3 to fit the compact 380px extension popup without layout breaking.

## Open Questions
- Do we want a hidden emergency bypass method, or is it strictly impossible to skip a challenge once started?
