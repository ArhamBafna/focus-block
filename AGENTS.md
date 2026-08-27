A copy of freedom.to - a distraction blocking service.

The functionality shoud mimic apps like freedom.to +  additional features not in those.

The UI/UX Design should be that of wisprflow.com ...\design-extract-output saves information for that. When creating any visual modifications, that must be used as reference.

For Chrome extensions, use following:

.agents\skills\chrome-extension\SKILL.md: Maps background architecture and routes u to exact network-level blocking rules.

.agents\skills\chrome-extensions\SKILL.md: Enforces official Google compliance and Manifest V3 docs.

 .agents\skills\chrome-devtools-cli\SKILL.md: CLI automation for Chrome debugging—inspect DOM, network, console, performance metrics via isolated browser.

After EVERY big change, go to `apps/extension` folder and run `npm run build`.

- There are two user-facing parts: desktop app `apps/desktop/` and Chrome extension `apps/extension/`. For feature request, find which part(s) affected and change. Desktop code no change extension code, or vice versa.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`ArhamBafna/focus-block`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Test Map

- Extension: `cd apps/extension && npm test`
  - Background: `apps/extension/background/__tests__/` (`rules`, `schedule`, `scheduled-stop-suppression`, `session-brain`)
  - Popup: `apps/extension/popup/lib/__tests__/` (`ipc`, `schedule-crud`, `storage`)
- Desktop UI: `cd apps/desktop && npm test`
  - `apps/desktop/src/pages/Home.test.tsx`, `apps/desktop/src/lib/ipc.*.test.ts`
- Rust Backend: `cargo test --workspace`
  - `crates/focus-core/src/`, `crates/focus-store/src/`, `apps/desktop/src-tauri/src/lib.rs`