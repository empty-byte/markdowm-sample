# 第 10 项设计：评论面板 + 历史面板组件化（不改行为）

## 1. 背景与目标

当前 `MilkdownView.vue` 体积较大，评论与历史记录侧栏模板过长，影响后续维护与扩展（如权限、埋点、A/B UI）。
本次目标是将这两块 UI 抽离为独立组件，同时保持现有功能、状态流、交互细节完全不变。

## 2. 范围（In Scope / Out of Scope）

### In Scope

- 抽离评论侧栏为 `CommentPanel.vue`
- 抽离历史侧栏为 `HistoryPanel.vue`
- 父组件保留状态与业务逻辑，通过 props + emits 驱动子组件
- 维持现有 class 命名，保证样式与视觉不变

### Out of Scope

- 不修改评论/历史的数据模型
- 不修改评论锚点高亮逻辑
- 不修改历史快照序列化/回放逻辑
- 不新增后端接口或存储结构

## 3. 数据结构

本次无新增领域数据结构，仅组件输入输出契约：

- `CommentPanel` 输入：
  - `comments`、`activeCommentId`
  - `commentsCollapsed`
  - `selectedQuote`、`hasSelectedRange`
  - `commentDraft`
- `CommentPanel` 输出：
  - `toggle-collapse`
  - `update:commentDraft`
  - `submit-comment`
  - `focus-comment`
  - `delete-comment`
  - `expose.focusInput`
  - `expose.scrollCommentIntoView`

- `HistoryPanel` 输入：
  - `snapshots`、`activeSnapshotId`
  - `historyCollapsed`
  - `snapshotLabel`
- `HistoryPanel` 输出：
  - `toggle-collapse`
  - `update:snapshotLabel`
  - `create-snapshot`
  - `select-snapshot`
  - `restore-snapshot`
  - `delete-snapshot`

## 4. 状态流与交互流

1. 仍由 `MilkdownView.vue` 持有所有源状态（评论数组、快照数组、折叠态、输入态、激活态）。
2. 子组件负责渲染、局部展示计算（时间格式化、计数文案、preview 文案）与事件派发，不直接修改业务状态。
3. 父组件收到事件后沿用原函数执行：
   - 评论：`submitComment` / `focusComment` / `deleteComment`
   - 历史：`createHistorySnapshot` / `selectHistorySnapshot` / `restoreHistorySnapshot` / `deleteHistorySnapshot`
4. 评论面板通过 `defineExpose` 暴露 `focusInput/scrollCommentIntoView`，父组件通过 `commentPanelRef` 调用，保持“从浮动工具栏发起评论后自动聚焦输入框”和“定位评论项滚动到可视区”的原行为。

## 5. 边界场景与异常处理

- 子组件卸载时，textarea ref 会回收，避免持有失效节点。
- 选区为空时，“添加评论”按钮保持禁用。
- 历史卡片键盘 Enter/Space 触发行为保持不变。
- 异步还原流程（`select/restore snapshot`）仍在父组件执行，避免竞态。

## 6. 验收标准（可测试）

1. 页面行为与重构前一致：
   - 评论新增/定位/删除正常
   - 历史快照创建/选择/还原/删除正常
   - 折叠与展开状态正常
2. 从正文选区触发评论后，右侧输入框仍自动聚焦
3. `npm run build` 通过
4. `npm run test` 通过

## 7. 与后续 MySQL 的对齐点

- 本次只做视图层拆分，不改变数据字段与序列化结构。
- 后续落 MySQL 时，评论与快照存储表结构可直接复用现有字段映射，无需迁移。

## 8. 变更记录

- 2026-04-01：完成评论/历史侧栏组件化，保持功能与交互行为不变。
- 2026-04-01：第二轮下沉：将评论/历史面板的展示计算与 DOM 引用逻辑内聚到组件，`MilkdownView.vue` 仅保留业务编排逻辑。
