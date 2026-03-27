# AGENTS.md

## 项目定位
- 项目名称：Vue3 Milkdown 在线文档编辑器（类飞书）
- 目标：聚焦单一 Milkdown 方案，验证“基础编辑 + 协同 + 评论 + 历史记录 + 菜单交互”的可落地性。
- 技术栈：Vue 3 + TypeScript + Vite + Vue Router + Yjs + Hocuspocus。

## 页面与路由
- `/`：Milkdown Playground 风格页面（Crepe + 可切换 Markdown 面板 + 协同 + 评论 + 历史记录）

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
- 历史记录还原涉及正文内容变化时，优先确保上方 Milkdown 编辑区与当前 Y.Doc 同步，而不是只改下方 Markdown 状态。
- UI 变更尽量复用 `src/style.css` 现有设计变量与组件样式。
- 新增依赖后同步更新 `package.json` 与 `package-lock.json`。

## 当前已落地能力
- 评论：支持正文选区后从浮动工具栏发起评论；已评论文本显示黄色下划线；点击正文锚点可高亮右侧对应评论。
- 历史：支持手动创建快照，快照保存 markdown 与 comments；点击历史卡片可直接还原当前版本。
- 协同：同一房间内共享正文、评论和历史快照；工具栏可展示在线协作者状态。
- 侧栏：评论面板和历史面板共享右侧独立滚动区域，并支持分别折叠。
- Markdown：下方 Markdown 面板默认隐藏，通过顶部按钮显示；展开后支持手动应用、自动同步和收起。

## 已知问题与排查
- 若前端提示 `WebSocket connection ... failed`：先确认 `npm run collab:server` 已启动。
- 若出现 `ERR_ENCODING_INVALID_ENCODED_DATA`：通常是客户端 provider 与服务端协议不匹配，需统一为 Hocuspocus。
- Milkdown 页面构建体积较大（CodeMirror 语言包导致），属于当前可接受状态。

## 提交前检查清单
- `npm run test` 通过
- `npm run build` 通过
- 手工验证 `/` 页面上的基本编辑、评论流程、历史快照还原、Markdown 面板显隐与协同连接
- README/文档在需求变化时同步更新

## 给后续 AI 的建议
- 若用户要求“对齐官方 playground”，优先从 `src/views/MilkdownView.vue` 入手，不要先改全局布局。
- 若用户要求“类似飞书交互”，优先增强 slash 菜单、命令面板、评论锚点高亮、历史快照流程与键盘可达性。
