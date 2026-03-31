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

## Architecture

This is a Vue 3 + Vite demo app showcasing a rich Markdown editor with real-time collaboration, comments, history snapshots, and media embeds.

### Stack
- **Editor**: [Milkdown Crepe](https://milkdown.dev) — ProseMirror-based WYSIWYG Markdown editor
- **Collaboration**: `yjs` (CRDT) + `@hocuspocus/provider` WebSocket provider connected to a local Hocuspocus server (`scripts/collab-server.mjs`)
- **Routing**: Vue Router, routes defined in `src/router/routes.ts`
- **Tests**: Vitest (pure unit tests, no DOM)

### Key files

`src/views/MilkdownView.vue` is the single main view. It is large and handles:
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

### Embed token syntax

Media embeds are stored as Markdown image syntax: `![embed:Title](https://url)`. The `parseEmbedBlocks` function scans raw Markdown for these tokens and resolves each to a `ParsedEmbedBlock` with a provider-specific `embedUrl` (or `status: 'invalid'`).

### Collaboration model

The Hocuspocus server is stateless (no persistence). On connect, Yjs syncs the shared document over WebSocket. Each client generates a `CollaboratorIdentity` (name + color) stored in Yjs awareness. The connection status (`connecting` / `connected` / `disconnected`) is managed in `MilkdownView.vue`.
