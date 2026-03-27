# Copilot Instructions

## Project Context
This repository is a Vue 3 + TypeScript Milkdown demo for a Feishu-like document workflow.

- `/`: Milkdown (Crepe playground-style page with comments, history snapshots, collaboration, and a toggleable Markdown pane)

## Tech Stack
- Vue 3, TypeScript, Vite, Vue Router
- Yjs + Hocuspocus (`@hocuspocus/provider`, `@hocuspocus/server`)
- Milkdown
- Vitest

## High Priority Rules
1. Keep the single Milkdown page stable. Do not reintroduce other editor solutions unless explicitly requested.
2. Keep route structure stable unless explicitly requested.
3. For collaboration code, use Hocuspocus protocol first and keep client/server compatibility aligned.
4. Prefer existing shared utilities under `src/features/editor-enhance/` before adding duplicate logic.
5. When restoring history snapshots or externally applying markdown, keep the Milkdown editor state and current Y.Doc aligned; do not update only the textarea state.
6. When adding dependencies, update both `package.json` and `package-lock.json`.

## File Ownership Hints
- `src/views/*.vue`: solution pages and UI behavior
- `src/features/editor-enhance/*`: comments/history/command/slash helpers
- `src/router/*`: navigation and route metadata
- `scripts/collab-server.mjs`: local collab websocket server
- `src/style.css`: global styling system

## Current Feature Expectations
- Comments: selected text can create comments from the floating toolbar; commented text uses yellow underline markers and active highlight.
- Comment navigation: clicking commented text in the editor should activate and scroll the matching comment card on the right.
- History: manual snapshots must save both markdown and comments, and selecting a history card should restore the document content in the visual editor.
- Collaboration: clients in the same room should share the visual document, comments, and history snapshots, with awareness-driven collaborator presence visible in the UI.
- Right column: comments and history live in one independently scrollable side column and each panel can collapse independently.
- Markdown pane: keep it optional by default; users explicitly show it from the toolbar and can hide it again from the pane header.

## Local Commands
- Install: `npm install`
- Frontend dev: `npm run dev`
- Collab server: `npm run collab:server`
- Tests: `npm run test`
- Build check: `npm run build`

## Before Finalizing Changes
Always prefer this checklist:
1. `npm run test`
2. `npm run build`
3. Manually check `/` for basic editing, comment flow, history snapshot restore, markdown pane toggle, and collab connect/disconnect state.

## Collaboration Troubleshooting
- If frontend shows `WebSocket connection ... failed`, check whether `npm run collab:server` is running.
- If `ERR_ENCODING_INVALID_ENCODED_DATA` appears, verify provider/server protocol compatibility and keep Hocuspocus on both sides.

## Style Guidance
- Reuse existing CSS variables and component classes from `src/style.css`.
- Keep keyboard accessibility for menus (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) where applicable.
- Keep UI text in Chinese by default to match current project language.

## Scope Control
If a request asks for “playground-like” or “Feishu-like” behavior, prioritize:
1. slash menu / command panel
2. comment anchors, floating comment entry, and history snapshot flow
3. collaboration status, reconnect UX, and markdown pane visibility flow
