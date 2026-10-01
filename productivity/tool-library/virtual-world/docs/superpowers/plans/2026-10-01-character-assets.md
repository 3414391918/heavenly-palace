# Character Assets Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for bounded implementation tasks and council-review for integration. User has approved development in the current application workspace.

**Goal:** Replace character core Markdown editor with saved fields, multiple appearances and labelled image assets.

**Architecture:** Keep core-profile.md as the text source, asset manifests independent. Core persists both through existing project transactions; Main mediates file selection and image clipboard; Renderer owns drafts.

**Tech Stack:** Vue 3, TypeScript, Electron, Zod, Vitest, existing project store.

---

### Task 1: Contract, codec and persistence

Files: new `packages/contracts/src/long-character-profile.ts`, `long-character-profile-markdown.ts`, `long-character-profile-legacy.ts`; new `apps/desktop/src/utilities/long-project-store/character-profiles.ts` and asset helper modules; extend contract exports/commands, store/service facade and core handler.

- [x] Write codec round-trip and legacy extraction tests. Test source strings containing headings, Unicode, image links and unknown sections; assert unmatched paragraphs survive.
- [x] Run `pnpm exec vitest run packages/contracts/src/long-character-profile.test.ts --maxWorkers=2`; confirm missing codec fails.
- [x] Implement profile codec with explicit section and appearance markers. Decode legacy text conservatively; serialize all text without loss. Update existing Agent prompt to preserve structured markers.
- [x] Define and implement `long.readCharacterProfile`, `long.saveCharacterProfile`, `long.importCharacterAssetsAtPaths`, `long.renameCharacterAsset`, `long.deleteCharacterAsset`; public upload omits source paths.
- [x] Write store tests with real temp projects: stale revision rejects; name/aliases/document update atomically; uploaded assets and labels survive reopen; images do not appear in core Markdown; invalid bytes/path traversal/symlinks rejected.
- [x] Implement through `LongProjectStore` project queue and transactions; then run targeted store tests.

### Task 2: IPC and image access

Files: new Main `ipc/character-asset-commands.ts`, Preload `character-assets-api.ts`; extend long API and bounded image protocol.

- [x] Write tests proving internal upload paths cannot be supplied by Renderer, cancelled chooser returns null, only registered asset files can be displayed or copied.
- [x] Run target tests before implementing.
- [x] Route public upload through Main native multi-file chooser to internal Core command. Route copy through nativeImage/clipboard, using registered project and manifest validation.
- [x] Add all input/result schemas to Preload. Export runtime schemas through contracts/renderer.
- [x] Extend image protocol with a separate character-asset path while retaining chapter URLs. No unrestricted filesystem URLs.

### Task 3: Form and gallery

Files: new `features/character-assets/` components/composables/tests. Keep the form and gallery in focused components; extract internal file navigation to `useLongEditorFileNavigation.ts`; add a core-profile branch to LongWorkspaceEditor.

- [x] Write draft tests for per-field save, keeping other unsaved fields, stale read responses, selection guard and save failure. Run before implementation.
- [x] Implement saved-field form; save derives from saved snapshot plus just the selected field. Refresh index on successful name change through existing saved callback.
- [x] Implement appearance selection/create/name/description and saved appearance target for upload.
- [x] Implement scrollable lazy image grid, labels, context menu, rename dialog, delete confirmation and batch upload feedback.
- [x] Implement image viewer using bounded scale and drag transforms, reset/fit controls and image clipboard action. Use theme-aware modal and existing focus/dialog patterns.

### Task 4: Integration and verification

- [x] Run targeted codec/store/Main/UI tests, typecheck and boundary checks; repair concrete failures.
- [x] Request independent persistence/security and correctness/contract reviews of real diff; resolve confirmed findings with regression evidence.
- [x] Run `VITEST_MAX_WORKERS=2 pnpm verify` using the bundled Node runtime.
- [x] Restart development service, verify saved fields and image operations in a temporary book, clean only generated test data.
- [ ] Restore real book selection through the native interface; the final attempt returned `noWindowsAvailable` despite a visible application screenshot.
- [x] Report verified behavior and material remaining limitations. Stage/commit/push only if requested for this feature; doc commits share the required verification gate.

### Verification evidence — 2026-10-01

- Final verification after wiring the actual Main entry point: 656 test files and 3712 tests passed; formatting, types, lint, Renderer boundaries and build budgets passed.
- Native application checks used a disposable temporary book: individual text saves, unsaved-change cancellation and save-before-leaving, appearance creation, native file selection, 32-image batch import, scrolling thumbnails, zoom, image copy, persisted labels, deletion cancellation and confirmed deletion. File readback independently confirmed saved text, original Markdown backup, image labels and removal of the selected image.
- Read-only checks of the real book confirmed all five characters decode successfully, including 慕星离's 元流 and 白曜 appearances. SHA-256 comparison confirmed all 265 real-book files stayed unchanged.
- Temporary registration, book directory, upload images and helper scripts were removed. Development service restarted on localhost:5173 with normal launch arguments.
- Native UI observations intermittently returned stale controls, stale screenshots or `noWindowsAvailable`. Final book selection and a complete separate UI walkthrough for all four character categories could not be reliably finished; their shared form path and storage behavior were checked in code and tests.
