# Copilot Instructions

## Project Context
This repository is a Vue 3 + TypeScript demo for comparing online document editors in a Feishu-like workflow.

- `/tiptap`: Tiptap + Yjs + Hocuspocus (enhanced interactions)
- `/milkdown`: Milkdown (Crepe playground-style page)
- `/blocksuite`: BlockSuite integration demo
- `/`: overview page

## Tech Stack
- Vue 3, TypeScript, Vite, Vue Router
- Yjs + Hocuspocus (`@hocuspocus/provider`, `@hocuspocus/server`)
- Tiptap / Milkdown / BlockSuite
- Vitest

## High Priority Rules
1. Keep each editor solution isolated. Do not break other pages while changing one page.
2. Keep route structure stable unless explicitly requested.
3. For collaboration code, use Hocuspocus protocol first. Avoid mixing `y-websocket` client protocol with Hocuspocus server flow.
4. Prefer existing shared utilities under `src/features/editor-enhance/` before adding duplicate logic.
5. When adding dependencies, update both `package.json` and `package-lock.json`.

## File Ownership Hints
- `src/views/*.vue`: solution pages and UI behavior
- `src/features/editor-enhance/*`: comments/history/command/slash helpers
- `src/router/*`: navigation and route metadata
- `scripts/collab-server.mjs`: local collab websocket server
- `src/style.css`: global styling system

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
3. Manually check `/tiptap` and `/milkdown` for basic editing and collab connect/disconnect state.

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
2. comment anchors and history snapshot flow
3. collaboration status and reconnect UX
