# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Type-check and build for production
npm run build

# Run all tests
npm run test

# Run a single test file
npx vitest run tests/editor-enhance.spec.ts

# Start the collaborative editing WebSocket server (ws://127.0.0.1:1234)
npm run collab:server
```

To test real-time collaboration, run both `npm run dev` and `npm run collab:server` simultaneously, then open two browser tabs at `/` and click "连接协同" in each.

The collab server port and host can be overridden with env vars: `COLLAB_PORT`, `COLLAB_HOST`.

## Verification Checklist

Before finalizing changes:
1. `npm run test`
2. `npm run build`
3. Manually check `/` for basic editing, comment flow, history snapshot restore, markdown pane toggle, and collab connect/disconnect across two browser windows.

## Architecture

Vue 3 + Vite demo app providing a Feishu-like online document editor with real-time collaboration, comments, history snapshots, and media embeds.

### Stack
- **Editor**: [Milkdown Crepe](https://milkdown.dev) — ProseMirror-based WYSIWYG Markdown editor
- **Collaboration**: `yjs` (CRDT) + `@hocuspocus/provider` WebSocket provider connected to a local Hocuspocus server (`scripts/collab-server.mjs`)
- **Diagramming**: Excalidraw (whiteboard), LogicFlow (flowcharts), simple-mind-map (mind maps) — each rendered in dialog components with React interop where needed
- **Routing**: Vue Router, single route `/` defined in `src/router/routes.ts`
- **Tests**: Vitest (pure unit tests, no DOM)

### Key files

`src/views/MilkdownView.vue` is the single main view. It handles:
- Crepe editor lifecycle (`onMounted`/`onBeforeUnmount`)
- Yjs document and Hocuspocus WebSocket connection
- All UI panels: sidebar comments, history snapshots, embed blocks, command palette, collaborator presence list, theme/feature toggles, Markdown source pane

`src/features/editor-enhance/` contains pure, side-effect-free helpers used by `MilkdownView.vue`:

| File | Purpose |
|------|---------|
| `comments.ts` | Immutable add/remove helpers for `EditorComment[]` |
| `history.ts` | Immutable add/remove helpers for `HistorySnapshot[]` (max 20 entries) |
| `embeds.ts` | Validates HTTPS embed URLs, normalizes YouTube/Bilibili/Figma URLs to iframe-friendly form, parses `![embed:…](url)` tokens from Markdown |
| `slash.ts` | Detects `/command` trigger in editor text before cursor |
| `comment-anchor-highlight.ts` | ProseMirror `Plugin` that decorates comment anchor ranges in the editor |
| `flowcharts.ts` / `mindmaps.ts` / `whiteboards.ts` | Token parsing and URL helpers for diagram embeds |
| `*-node-view.ts` | ProseMirror node view factories for rendering diagram/embed blocks inline |

`src/components/` contains dialog components for diagram editing (Excalidraw whiteboard, LogicFlow flowcharts, simple-mind-map) and sidebar panels (comments, history).

### Embed token syntax

Media embeds are stored as Markdown image syntax: `![embed:Title](https://url)`. The `parseEmbedBlocks` function scans raw Markdown for these tokens and resolves each to a `ParsedEmbedBlock` with a provider-specific `embedUrl` (or `status: 'invalid'`).

Diagram blocks use similar patterns: `![flowchart:…](data)`, `![mindmap:…](data)`, `![whiteboard:…](data)`.

### Collaboration model

The Hocuspocus server is stateless (no persistence). On connect, Yjs syncs the shared document over WebSocket. Each client generates a `CollaboratorIdentity` (name + color) stored in Yjs awareness. The connection status (`connecting` / `connected` / `disconnected`) is managed in `MilkdownView.vue`.

Collaboration is manual-connect: the user clicks a toolbar button to attach the provider and connect.正文, comments, and history snapshots all sync via shared Yjs state.

## Important Conventions

- Keep the single Milkdown page stable. Do not reintroduce other editor solutions unless explicitly requested.
- Prefer existing shared utilities under `src/features/editor-enhance/` before adding duplicate logic.
- When restoring history snapshots or externally applying markdown, keep both the Milkdown editor state and the Y.Doc aligned — do not update only the textarea.
- For collaboration code, use Hocuspocus protocol and keep client/server compatibility aligned.
- UI text should be in Chinese to match current project language.
- Reuse existing CSS variables and component classes from `src/style.css`.

## Collaboration Troubleshooting

- `EADDRINUSE` on port 1234: a collab server is already running — reuse it or stop that process.
- UI stays `disconnected`: verify client uses `provider.attach()` plus `websocketProvider.connect()` rather than deprecated `provider.connect()`.
- `ERR_ENCODING_INVALID_ENCODED_DATA`: check provider/server protocol compatibility; keep Hocuspocus on both sides.
