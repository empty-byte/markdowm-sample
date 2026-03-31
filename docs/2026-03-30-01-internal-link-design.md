# 第 1 项设计：内链（`[[文档名]]`）

## 1. 背景与目标

当前编辑器已具备基础编辑、评论、历史、协同。下一步需要补齐知识组织能力中的“内链”基础设施，且为后续双向链接、标签、关系图谱做数据复用。

已确认约束：

- 内链语法固定为 `[[文档名]]`（Obsidian 风格）
- 文档唯一标识使用 `ULID`
- 标题允许重名
- 首次多命中时弹选择器，之后记忆映射
- 权威实时状态存放在 `Y.Doc`，后期再落地 MySQL

## 2. 范围

### In Scope（本期）

- 解析并渲染 `[[...]]` 内链
- 支持点击跳转（按 `targetDocId`）
- 多命中时弹选择器并记忆映射
- 悬空链接（目标不存在）可视化标记
- 协同下共享链接解析结果与映射结果

### Out of Scope（本期不做）

- 白板/关系图谱可视化
- 全局搜索中心页
- 高级语法（如 `[[文档名#标题]]`、`[[文档名^块ID]]`）
- 外链抓取/网页预览

## 3. 数据结构

以下是逻辑模型（非实现代码）：

### 3.1 文档元信息索引（共享）

- 位置：`Y.Doc` 根下 `docsIndex`（`Y.Map`）
- Key：`docId`（`ULID`）
- Value：
  - `docId: string`
  - `title: string`
  - `aliases: string[]`
  - `updatedAt: number`
  - `deletedAt?: number`

说明：后续 MySQL 可直接映射为 `documents` + `aliases`。

### 3.2 内链记忆映射（共享）

- 位置：`Y.Doc` 根下 `linkMemory`（`Y.Map`）
- Key：`<sourceDocId>::<rawLinkTextNormalized>`
- Value：
  - `sourceDocId: string`
  - `rawLinkText: string`
  - `targetDocId: string`
  - `resolvedAt: number`
  - `resolverUserId?: string`

说明：命中多个候选时，用户选择后写入该表；后续相同上下文优先使用该映射。

### 3.3 文档内解析结果（可计算态）

- 不要求持久化为主存，可由正文实时计算：
  - `tokenText: string`（如 `产品路线图`）
  - `range: { from: number; to: number }`
  - `state: resolved | ambiguous | dangling`
  - `targetDocId?: string`
  - `candidateDocIds?: string[]`

## 4. 状态流与交互流

## 4.1 解析优先级

对每个 `[[rawText]]`，按以下顺序解析：

1. 命中 `linkMemory[sourceDocId + rawText]` 且目标仍存在 -> `resolved`
2. 在 `docsIndex` 中按 `title` 精确匹配
3. 在 `docsIndex` 中按 `aliases` 精确匹配
4. 若候选数 = 1 -> 自动绑定并写入 `linkMemory`
5. 若候选数 > 1 -> 标记 `ambiguous`，点击或确认时弹选择器
6. 若候选数 = 0 -> 标记 `dangling`

## 4.2 首次多命中选择与记忆

1. 用户点击 `ambiguous` 内链
2. 展示候选列表（标题、别名命中信息、docId 短码）
3. 用户确认目标 `targetDocId`
4. 写入 `linkMemory`（键：`sourceDocId + rawText`）
5. 当前与后续同键链接均按该映射跳转

## 4.3 失效策略

- 若 `targetDocId` 被删除：映射标记失效，链接回到 `dangling` 或重新候选
- 若目标改标题/别名：映射不受影响（因为按 `docId` 跳转）
- 若 `rawText` 被用户改写：视为新键，重新走解析流程

## 4.4 点击跳转策略（本期）

- 跳转以 `targetDocId` 为准，不以显示文字为准
- 保持现有路由不变（仍是 `/`），在页面内切换当前文档上下文
- 若目标不存在：给出“链接目标不存在/已删除”提示

## 5. 边界场景与异常处理

1. 标题重名 + 别名也重名：必须选择，不自动猜测
2. 用户复制段落到另一文档：由于 `sourceDocId` 变化，原记忆映射不强制复用，按新文档上下文重算
3. 协同并发选择：最后写入生效（LWW），并保留 `resolvedAt` 便于审计
4. 超长 `[[...]]` 文本（异常输入）：限制最大长度（建议 128），超出按普通文本处理
5. 非法嵌套（如 `[[a [[b]]`）：仅识别合法闭合 token，避免错误高亮整段
6. 删除目标文档后的历史文本：保留原 `[[rawText]]`，但渲染为悬空状态

## 6. 验收标准（可测试）

1. 输入 `[[唯一标题]]` 后可解析为已链接状态，点击能跳转目标文档
2. 同名文档存在时，首次点击弹选择器；选定后同文档同文本不再重复弹窗
3. 目标文档改名后，历史内链仍可跳转（基于 `docId`）
4. 目标文档删除后，已有内链自动变为悬空并给出可见提示
5. 双端协同下，一端完成映射选择，另一端可实时复用该映射
6. 刷新后映射仍存在（来自 `Y.Doc` 状态恢复）

## 7. 与后续 MySQL 对齐点

为后续落库预留以下映射关系：

- `docsIndex` -> `documents`、`document_aliases`
- `linkMemory` -> `document_link_memory`
- 可计算解析结果 -> 可选 `document_links`（离线重建也可）

建议 MySQL 字段：

- `doc_id CHAR(26)`（ULID）
- 文本比较策略保证与前端规范一致（统一大小写策略）

## 8. 与后续需求的接口关系

- 双向链接：基于当前解析结果反查 `targetDocId -> sourceDocId`
- 标签：可参与候选筛选但不影响 `docId` 主解析链路
- 图谱：直接消费链接边（source/target）

## 9. 变更记录

- 2026-03-30：首版设计完成（语法、唯一键、存储与映射策略已锁定）


