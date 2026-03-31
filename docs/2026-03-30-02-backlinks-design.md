# 第 2 项设计：双向链接（Backlinks）

## 1. 背景与目标

在第 1 项“内链（`[[文档名]]`）”确定后，双向链接用于回答两个核心问题：

- 当前文档链接到了谁（Outgoing）
- 谁正在链接当前文档（Incoming / Backlinks）

双向链接将直接服务后续能力：关系图谱、标签联动，并与 `docId(ULID)` 主键体系保持一致。

依赖前置：

- 内链语法：`[[文档名]]`
- 唯一键：`docId`
- 内链记忆映射：`sourceDocId + rawLinkText -> targetDocId`
- 权威协同状态：`Y.Doc`

## 2. 范围

### In Scope（本期）

- 维护文档级出链集合（当前文档指向哪些目标文档）
- 维护文档级入链集合（哪些文档指向当前文档）
- 右侧新增“链接关系”面板（或在现有侧栏新增分组）
- 支持从入链条目跳转到来源文档
- 悬空链/歧义链在双向关系中可见

### Out of Scope（本期不做）

- 全图可视化布局（放在关系图谱项）
- 权重算法（PageRank、时间衰减等）
- 段落级反链锚点精准定位（先文档级）
- 外部链接（http/https）统一纳入关系网络

## 3. 数据结构

以下为逻辑模型（非实现代码）：

### 3.1 链接边（边事实，推荐共享存储）

- 位置：`Y.Doc` 根下 `linkEdges`（`Y.Map`）
- Key：`edgeId`（建议：`<sourceDocId>::<tokenHash>`）
- Value：
  - `edgeId: string`
  - `sourceDocId: string`
  - `rawLinkText: string`
  - `targetDocId: string | null`（null 表示悬空或未决）
  - `state: resolved | ambiguous | dangling`
  - `updatedAt: number`

说明：`linkEdges` 是双向链接的核心数据来源，后续图谱直接复用。

### 3.2 反向索引（可计算态或缓存态）

- Outgoing（按 source 聚合）：`sourceDocId -> edge[]`
- Incoming（按 target 聚合）：`targetDocId -> edge[]`

说明：可在运行时由 `linkEdges` 计算得到；若后续文档规模增大，可增加缓存索引加速。

### 3.3 与第 1 项对象关系

- `linkMemory` 负责“歧义文本如何映射到 targetDocId”
- `linkEdges` 负责“最终边关系是什么”
- 二者关系：`linkMemory` 影响解析，解析结果回写 `linkEdges`

## 4. 状态流与交互流

## 4.1 关系更新主流程

1. 当前文档正文变更
2. 重新解析文档内 `[[...]]` token
3. 对每个 token 结合 `linkMemory/docsIndex` 得到 `state + targetDocId`
4. 增量更新该 `sourceDocId` 对应的 `linkEdges`
5. 由 `linkEdges` 推导最新 outgoing/incoming 列表并刷新 UI

## 4.2 侧栏展示建议（MVP）

- 新增“链接关系”分区，包含两组：
  - `链接到（Outgoing）`
  - `被链接（Incoming）`
- 每项展示：文档标题、docId 短码、状态徽标（resolved/ambiguous/dangling）
- 点击条目：
  - Outgoing：跳转 target 文档
  - Incoming：跳转 source 文档

## 4.3 歧义与悬空处理

- 歧义（ambiguous）：显示候选数；点击触发与第 1 项一致的选择器
- 悬空（dangling）：显示“未匹配目标”，后续文档创建或别名新增后可自动转 resolved

## 4.4 协同一致性

- 边事实写入 `Y.Doc`（`linkEdges`）
- 任一客户端完成歧义选择后，其他客户端应实时看到入链/出链变化
- 并发冲突采用 LWW（按 `updatedAt`）

## 5. 边界场景与异常处理

1. 自链接（A -> A）：允许存在，但在 UI 上标记“自链接”
2. 双向环（A -> B, B -> A）：属于正常关系，不做拦截
3. 目标文档删除：相关边变为 dangling，保留 `rawLinkText`
4. 标题/别名改名：若已有 `targetDocId`，边保持 resolved
5. 大文档频繁输入：采用防抖增量更新，避免每击键全量重算
6. 批量粘贴含大量 `[[...]]`：分批解析并限制单次更新上限，防止 UI 卡顿

## 6. 验收标准（可测试）

1. 当前文档添加 `[[目标文档]]` 后，Outgoing 列表出现目标项
2. 在目标文档中可看到来自来源文档的 Incoming 条目
3. 删除来源文档中的该内链后，两端列表实时移除对应关系
4. 多端协同下，一端完成链接选择，另一端 Incoming/Outgoing 同步更新
5. 目标文档删除后，相关关系可见地转为 dangling
6. 自链接场景在列表中可见且可跳转

## 7. 与后续 MySQL 的对齐点

建议后续落库表（可按需简化）：

- `document_links`
  - `edge_id`
  - `source_doc_id`
  - `target_doc_id`（nullable）
  - `raw_link_text`
  - `state`
  - `updated_at`

索引建议：

- `(source_doc_id, updated_at)`
- `(target_doc_id, updated_at)`
- `(state, updated_at)`

## 8. 与后续需求的接口关系

- 别名：别名变化将影响 ambiguous/dangling -> resolved 的自动收敛
- 标签：可在 Incoming/Outgoing 面板提供按标签过滤
- 关系图谱：直接消费 `document_links` 边集合

## 9. 变更记录

- 2026-03-30：首版设计完成（双向关系模型、状态流、验收标准已定义）


