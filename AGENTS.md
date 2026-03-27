# AGENTS.md

## 项目定位
- 项目名称：Vue3 Milkdown 在线文档编辑器（类飞书）
- 目标：聚焦单一 Milkdown 方案，验证“基础编辑 + 协同 + 评论 + 菜单交互”的可落地性。
- 技术栈：Vue 3 + TypeScript + Vite + Vue Router + Yjs + Hocuspocus。

## 页面与路由
- `/`：Milkdown Playground 风格页面（Crepe + 双栏 Markdown + 协同 + 评论）

## 常用命令
- 安装依赖：`npm install`
- 启动前端：`npm run dev`
- 启动协同服务：`npm run collab:server`
- 单元测试：`npm run test`
- 构建检查：`npm run build`

## 协同配置
- 默认协同地址：`ws://127.0.0.1:1234`
- 可通过 `.env` 覆盖：`VITE_COLLAB_WS_URL=ws://127.0.0.1:1234`
- 协同服务脚本：`scripts/collab-server.mjs`

## 关键目录
- `src/views/`：各方案页面实现
- `src/features/editor-enhance/`：评论、历史、命令、slash 触发等增强能力
- `src/router/`：路由与导航定义
- `tests/`：Vitest 测试
- `scripts/`：协同服务与构建辅助脚本

## AI 改动约定
- 优先保持现有路由结构和页面入口不变。
- 改动编辑器功能时，优先在 `src/views/MilkdownView.vue` 内完成，避免引入多方案分叉。
- 涉及协同能力时，优先使用 `@hocuspocus/provider`，保持与本地 Hocuspocus 服务端协议一致。
- UI 变更尽量复用 `src/style.css` 现有设计变量与组件样式。
- 新增依赖后同步更新 `package.json` 与 `package-lock.json`。

## 已知问题与排查
- 若前端提示 `WebSocket connection ... failed`：先确认 `npm run collab:server` 已启动。
- 若出现 `ERR_ENCODING_INVALID_ENCODED_DATA`：通常是客户端 provider 与服务端协议不匹配，需统一为 Hocuspocus。
- Milkdown 页面构建体积较大（CodeMirror 语言包导致），属于当前可接受状态。

## 提交前检查清单
- `npm run test` 通过
- `npm run build` 通过
- 手工验证 `/` 页面上的基本编辑、评论流程、菜单与协同连接
- README/文档在需求变化时同步更新

## 给后续 AI 的建议
- 若用户要求“对齐官方 playground”，优先从 `src/views/MilkdownView.vue` 入手，不要先改全局布局。
- 若用户要求“类似飞书交互”，优先增强 slash 菜单、命令面板、评论锚点高亮与键盘可达性。
