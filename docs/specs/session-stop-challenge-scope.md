# Specification: Session Stop Challenge Scope Selection

## 1. Overview
Allow users to select which session types require a challenge before stopping early in the Chrome extension (`apps/extension/`).
Users can enable challenges for:
- **Lockdown sessions**
- **Focus sessions**
- **Both** (both switches ON)
- **None** (both switches OFF, or Challenge Method set to "None")

---

## 2. Paper Prototype Reference & UI Specifications

> [!IMPORTANT]
> All visual and layout values below are extracted directly from Paper file `01M3Z437Y8435F90KJJFQVFP7S`, page **Prototype** (`p-8-0`), artboard **Stop Challenge Controls Prototype** (`14K-0`). Do NOT make unnecessary Paper MCP calls; use the values below.

### Selected UI Pattern: Option 1 — Two Toggle Switches

```
┌────────────────────────────────────────────────────────┐
│  Session Stop Challenge                                │
│  Challenge required to end a session early.            │
│  [ Challenge Method: Countdown Timer ▾ ]               │
├────────────────────────────────────────────────────────┤
│  Lockdown Sessions                                     │
│  Challenge required before stopping a lockdown session │
│  early.                                       [ ON  ]  │
├────────────────────────────────────────────────────────┤
│  Focus Sessions                                        │
│  Challenge required before stopping a standard focus   │
│  session early.                               [ OFF ]  │
├────────────────────────────────────────────────────────┤
│  (If Countdown & at least one switch is ON):           │
│    Timer Duration: [ 30s ▾ ]                           │
│    Breathing Exercises: [ OFF ]                        │
└────────────────────────────────────────────────────────┘
```

### Visual & Style Details (Wispr Flow / Extension Design Tokens)
- **Container**: `background: var(--color-surface)` (`#FFFFFF`), `borderRadius: 10px`, `border: 1px solid var(--color-lumen-dark)` (`rgba(0,0,0,0.08)`), `padding: 12px 14px`.
- **Title**: `fontSize: 13px`, `fontWeight: 600`, `color: var(--color-vast)` (`#1A1A1A`).
- **Description**: `fontSize: 11px`, `color: var(--color-neutral-500)` (`#737373`), `lineHeight: 1.5`.
- **Toggle Component**:
  - Track: `width: 44px`, `height: 24px`, `borderRadius: 100px`.
  - Track background active: `var(--color-fathom)` (`#034F46`).
  - Track background inactive: `var(--color-neutral-200)` (`#E5E5E3`).
  - Knob: `width: 18px`, `height: 18px`, `borderRadius: 50%`, `background: #FFFFFF`.
  - Knob translation: Active `translateX(23px)`, Inactive `translateX(3px)`.
- **Dropdowns**: `borderRadius: 8px`, `border: 1px solid var(--color-neutral-200)`, `background: var(--color-surface)`, `color: var(--color-vast)`, `fontSize: 13px`, `padding: 6px 10px`.

---

## 3. Data Storage & Types

### File: `apps/extension/popup/lib/storage.ts`
Update `SettingsRecord`:
```typescript
export interface SettingsRecord {
  auto_start: boolean;
  block_windows_services: boolean;
  stop_challenge: string; // "none" | "random" | "countdown" | "typing" | "pattern" | "math" | "reflection"
  stop_challenge_lockdown: boolean; // NEW: default true
  stop_challenge_focus: boolean;    // NEW: default false
  challenge_countdown_duration: number;
  challenge_countdown_breathing: boolean;
}
```

Update `DEFAULT_STORAGE_SNAPSHOT`:
```typescript
settings: {
  auto_start: false,
  block_windows_services: false,
  stop_challenge: "none",
  stop_challenge_lockdown: true,
  stop_challenge_focus: false,
  challenge_countdown_duration: 30,
  challenge_countdown_breathing: false,
}
```

### File: `apps/extension/popup/lib/ipc.ts`
Re-exports `SettingsRecord` as `AppSettings`. Ensure fallback handling in `getSettings()` supplies defaults if keys are missing from older storage versions:
- `stop_challenge_lockdown ?? true`
- `stop_challenge_focus ?? false`

---

## 4. UI Implementation Details

### File: `apps/extension/popup/pages/Settings.tsx`
1. **Rename Section**:
   - Title: "Session Stop Challenge" (replace "Stop Lockdown Session Method").
   - Info tooltip / description: "Challenge required to end a session early."
2. **Challenge Method Dropdown**:
   - Keep existing options: None, Random Challenge, Countdown Timer, Type a Paragraph, Pattern Memory Puzzle, Mental Challenge, Reflection Prompt.
3. **Session Type Toggles**:
   - Only render or enable toggles when `settings.stop_challenge !== "none"`. If `stop_challenge === "none"`, dim or omit the toggle rows.
   - **Lockdown Sessions Row**:
     - Title: "Lockdown Sessions"
     - Description: "Challenge required before stopping a lockdown session early."
     - Control: `<Toggle checked={settings.stop_challenge_lockdown} onChange={toggleLockdownChallenge} />`
   - **Focus Sessions Row**:
     - Title: "Focus Sessions"
     - Description: "Challenge required before stopping a standard focus session early."
     - Control: `<Toggle checked={settings.stop_challenge_focus} onChange={toggleFocusChallenge} />`
4. **Conditional Sub-Settings (Countdown Duration & Breathing)**:
   - Render if `settings.stop_challenge === "countdown"` **AND** (`settings.stop_challenge_lockdown || settings.stop_challenge_focus`).
   - If both toggles are `false`, hide countdown sub-settings since no challenges will trigger.

---

## 5. Execution Logic

### File: `apps/extension/popup/pages/Home.tsx`
Update `stopSession`:
```typescript
const stopSession = async () => {
  if (!active) return;

  const currentMode = active.session.mode; // "lockdown" | "blocklist"
  const isChallengeConfigured = settings && settings.stop_challenge !== "none";
  const shouldChallenge =
    isChallengeConfigured &&
    ((currentMode === "lockdown" && settings.stop_challenge_lockdown) ||
     (currentMode === "blocklist" && settings.stop_challenge_focus));

  if (shouldChallenge) {
    try {
      let challengeToStart = settings.stop_challenge;
      if (challengeToStart === "random") {
        const challenges = ["countdown", "typing", "pattern", "math", "reflection"];
        challengeToStart = challenges[Math.floor(Math.random() * challenges.length)];
      }
      await ipc.startChallenge(challengeToStart);
      void fetchStatus();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
    return;
  }

  setActionError(null);
  try {
    await ipc.stopSession();
    void fetchStatus();
  } catch (error) {
    setActionError(error instanceof Error ? error.message : String(error));
  }
};
```

---

## 6. Verification & Test Plan

1. **Storage Unit Tests** (`apps/extension/popup/lib/__tests__/storage.test.ts` or `ipc.test.ts`):
   - Verify defaults load: `stop_challenge_lockdown = true`, `stop_challenge_focus = false`.
   - Verify updating either setting persists correctly.
2. **Behavior Verification**:
   - Lockdown session + `stop_challenge_lockdown: true` $\rightarrow$ triggers challenge.
   - Lockdown session + `stop_challenge_lockdown: false` $\rightarrow$ stops immediately.
   - Focus session + `stop_challenge_focus: true` $\rightarrow$ triggers challenge.
   - Focus session + `stop_challenge_focus: false` $\rightarrow$ stops immediately.
   - Both `false` or Method `none` $\rightarrow$ stops immediately.
3. **Execution Commands**:
   - Run tests: `cd apps/extension && npm test`
   - Build extension: `cd apps/extension && npm run build`
