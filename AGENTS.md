# Focus Block

Distraction blocking service mimicking freedom.to with extra features.
- **Apps**: Desktop (`apps/desktop/`) and Chrome extension (`apps/extension/`).
- **UI/UX**: Wispr Flow design; reference palettes/tokens in `apps/desktop/src/App.css` and `apps/extension/popup/App.css`.

## Skills & Docs
- **Extension Rules & Architecture**: `.agents\skills\chrome-extension\SKILL.md`
- **MV3 & Store Compliance**: `.agents\skills\chrome-extensions\SKILL.md`
- **DevTools CLI Automation**: `.agents\skills\chrome-devtools-cli\SKILL.md`
- **Domain Docs**: `docs/agents/domain.md`
- **Issue Tracker**: GitHub Issues (`ArhamBafna/focus-block`) via `gh` CLI (`docs/agents/issue-tracker.md`)

## Scripts & Tests
- **Start App**: `.\scripts\start.bat` (all) | `-DesktopOnly` (`-d`) | `-ExtensionOnly` (`-e`) | `-ServiceOnly` (`-s`)
- **Run Tests**: `.\scripts\test.bat` (runs all 4 suites in sequence)
  - `-RustOnly` (`-r`): `cargo test --workspace` (`crates/`, `apps/desktop/src-tauri`)
  - `-ExtensionOnly` (`-e`): `cd apps/extension && npm test` (`background/`, `popup/`)
  - `-DesktopOnly` (`-d`): `cd apps/desktop && npm test` (`pages/`, `lib/ipc*`)
  - `-E2EOnly` (`-e2e`): `cd tests/e2e && npx playwright test` (`specs/`)
  - `-Headed` (`-v`): Run Playwright tests visibly (combine with `-E2EOnly`)
