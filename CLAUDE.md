# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install           # install dependencies
npm run dev           # start frontend (Vite dev server)
npm run collab:server # start local Hocuspocus WebSocket server (port 1234)
npm run test          # run Vitest tests
npm run build         # type-check (vue-tsc) + Vite build
npm run preview       # preview production build
```

Run a single test file:
```bash
npx vitest run tests/editor-enhance.spec.ts
```

**Before finalizing any change:** run `npm run test` then `npm run build`.

## Architecture

This is a single-page Vue 3 + TypeScript app centered on a Milkdown (Crepe) rich-text editor with a Feishu-like UX.

### Key layers

| Layer | Location | Responsibility |
|---|---|---|
| Main view | `src/views/MilkdownView.vue` | All editor state, UI logic, collaboration wiring |
| Editor helpers | `src/features/editor-enhance/` | Stateless utility functions for comments, history, slash commands, command palette, and comment anchor highlighting |
| Collab server | `scripts/collab-server.mjs` | Local Hocuspocus WebSocket server; dev-only |
| Router | `src/router/` | Single route `/` → MilkdownView |
| Styles | `src/style.css` | Global CSS variables and component classes — reuse these, don't add inline styles |

### State model in MilkdownView

- **Editor content** lives in the Milkdown/ProseMirror `EditorView` and is synced to a `Y.Doc` when collaboration is active.
- **Comments** (`EditorComment[]`) and **history snapshots** (`HistorySnapshot[]`) are stored in reactive refs and, when collaboration is active, are serialized into shared `Y.Map` entries so all peers stay in sync.
- **Comment anchor highlights** are driven by a custom ProseMirror plugin (`comment-anchor-highlight.ts`) that decorates text ranges with yellow underlines; the active comment ID controls which range is highlighted.
- **Markdown pane** is hidden by default; users toggle it via the toolbar. When the pane is shown, the textarea reflects the current markdown; "Apply" updates the visual editor via `replaceAll`.

### Collaboration

- Uses `HocuspocusProvider` + `HocuspocusProviderWebsocket` (client) and `@hocuspocus/server` (server).
- Connection is **manual**: users click "连接协同" — the provider uses `provider.attach()` + `websocketProvider.connect()`.
- Awareness (collaborator presence) is managed via the provider's awareness API.
- Port 1234 is the default; override with `VITE_COLLAB_WS_URL` in `.env`.

### Critical rules

1. **Do not reintroduce alternative editor solutions** — Milkdown (Crepe) is the only editor.
2. When restoring history snapshots or applying markdown externally, **update both the Milkdown editor state and the Y.Doc** — never only the textarea.
3. Use `provider.attach()` + `websocketProvider.connect()` for collab; `provider.connect()` with an injected websocket provider is deprecated.
4. Prefer helpers in `src/features/editor-enhance/` before adding new logic directly in the view.
5. Keep **UI text in Chinese** to match the existing project language.
6. Keep keyboard accessibility (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) for menus.
