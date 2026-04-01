# 第 6 项设计：内嵌网页（Embed Web）

## 1. 背景与目标

内嵌网页用于在文档中直接展示外部内容（视频、设计稿、地图、页面片段），减少“跳出文档”的上下文中断。

本期目标（MVP）：

- 支持在文档中插入“内嵌网页块”
- 渲染以安全为第一优先
- 协同场景下共享嵌入配置
- 为后续白板、图谱中的外部引用复用同一嵌入协议

## 2. 前置阻塞（必须直说）

当前主要阻塞不是代码结构，而是“安全策略未拍板”：

1. 域名白名单范围
2. 是否允许任意 URL
3. sandbox 权限级别

影响：

- 若未先定安全边界，功能上线风险高（XSS、点击劫持、隐私泄露）

## 3. 范围

### In Scope（本期）

- 新增 embed block（输入 URL）
- URL 解析与合法性校验
- iframe 渲染（带 sandbox）
- 失败态（不支持域名 / 加载失败）
- 基础尺寸控制（默认宽高 + 折叠）

### Out of Scope（本期不做）

- 任意脚本注入执行
- 登录态接管（如跨站自动登录）
- 高级交互（拖拽裁剪、自由定位）

## 4. 数据结构

逻辑模型（非实现代码）：

### 4.1 EmbedBlock

- `id: string`
- `sourceUrl: string`
- `provider: string`（如 `youtube` / `figma` / `generic`）
- `status: ready | blocked | failed`
- `width: number`
- `height: number`
- `createdAt: number`
- `updatedAt: number`

### 4.2 安全配置（共享或本地配置）

- `embedPolicy`：
  - `allowDomains: string[]`
  - `allowSchemes: ['https']`
  - `sandboxFlags: string[]`

## 5. 状态流与交互流

1. 用户通过命令面板或 slash 触发插入 embed block
2. 输入 URL
3. URL 校验：协议、域名、格式
4. 命中白名单 -> 渲染 iframe
5. 未命中白名单 -> 显示 blocked 状态与提示

更新流：

1. 用户修改 URL
2. 重新校验与 provider 识别
3. 更新 block 状态并同步到协同端

## 6. 边界场景与异常处理

1. 非 https URL：拒绝
2. 域名不在白名单：blocked，不渲染 iframe
3. 目标站点禁止被 iframe：failed，提示“站点不允许嵌入”
4. 超时/网络失败：failed，可重试
5. 超长 URL 或非法字符：拒绝写入

## 7. 验收标准（可测试）

1. 输入白名单域名 URL 后可正确渲染
2. 输入非白名单 URL 时明确 blocked 状态
3. 输入 http URL 时被拒绝并提示
4. 协同双端下，一端插入 embed，另一端实时可见同状态
5. 加载失败有稳定降级 UI（不破版）

## 8. 与后续 MySQL 对齐点

建议表：

- `document_embeds(id, doc_id, source_url, provider, status, width, height, created_at, updated_at)`

可选策略表：

- `embed_policies(policy_id, allow_domains_json, sandbox_flags_json, updated_at)`

## 9. 待你拍板项（不自作主张）

1. 第一版域名策略？
   - 方案 A：仅白名单域名（推荐）
   - 方案 B：允许任意 https 域名
2. 白名单初始集合是否先限制为常见站点？
   - 方案 A：YouTube / Bilibili / Figma（推荐）
   - 方案 B：你指定一组业务域名
3. 展示方式？
   - 方案 A：文档内块级渲染（推荐）
   - 方案 B：仅外链卡片，不 iframe

## 10. 变更记录

- 2026-03-30：首版设计完成，并强调安全策略为前置决策

## 11. 决策更新（2026-03-30 实现变更）

- 已取消“域名白名单”限制。
- 当前校验策略调整为：
  - 仅接受 https 协议。
  - URL 需可被 new URL() 正常解析。
- provider 仍保留识别（YouTube / Bilibili / Figma / generic），用于展示与特化嵌入链接转换。
- 对任意 https 链接都允许尝试预览；若目标站点设置了防嵌策略（如 X-Frame-Options / CSP），前端显示不可预览提示。
- 以本节为准，覆盖本文中“白名单阻断”相关旧描述。
- 兼容解析带 image title 的 Markdown 图片写法，避免被编辑器序列化后无法识别。
- 新增“内容区内嵌网页”渲染区：插入后可在编辑器下方直接预览 iframe。
- 内容区卡片支持 hover 操作条，提供编辑/打开/删除。
- 输入 / 时可拉起功能面板，并默认过滤到“内嵌网页”相关动作。
- 富文本区渲染时隐藏 token 文本表现，仅显示 iframe 与 hover 操作。
- hover 右上角提供 打开/编辑/删除 操作。
- 尺寸拖拽升级为宽高联动（最小 320x180，最大高度 960，宽度不超容器）。

## 12. 决策回滚与补充（2026-03-31）

- 已回滚 hover 操作条：仅保留 `打开`，不再提供 `编辑/删除`。
- 已回滚尺寸交互：内嵌网页不支持鼠标拖拽改尺寸，恢复固定高度渲染。
- 内容区渲染规则补充：
  - 支持由斜杠菜单插入的 embed token 渲染。
  - 支持手输 Markdown token `![embed:标题](https://url)` 直接在富文本区域渲染。
  - 渲染后隐藏 token 文本，仅展示内嵌网页卡片。
- 站点兼容性说明：
  - 若目标站点设置 `X-Frame-Options` 或 `CSP frame-ancestors`（如百度等常见站点），浏览器会拒绝 iframe 预览。
  - 此类场景不属于前端渲染逻辑错误，降级路径为点击 `打开` 在新标签页访问。

## 13. 决策补充（2026-03-31 第二轮）

- 内嵌网页卡片 hover 操作补充为 `打开 / 编辑 / 删除`。
- `编辑` 进入统一内嵌弹框：
  - 预填当前标题与 URL。
  - 点击 `保存` 后就地替换该内嵌来源（保留在正文中的相对位置）。
- `删除` 直接移除对应内嵌项（包括其 token / 对应 image 源节点）。
- 仍保持：
  - 不启用鼠标拖拽改尺寸。
  - token 文本在富文本区隐藏，仅展示网页卡片。

## 14. 架构重构补充（2026-04-01）

- 将 `MilkdownView.vue` 中的“内嵌网页弹框”模板与输入校验逻辑抽离为独立组件：`src/components/EmbedWebDialog.vue`。
- 页面层保留业务职责：
  - 打开/关闭弹框状态管理（insert/edit）
  - 编辑态目标节点定位（`embedEditTarget`）
  - 插入/替换 token 的事务提交（`confirmEmbed`）
- 组件层职责：
  - URL/标题输入
  - HTTPS 链接合法性校验
  - Enter/Escape 键交互
  - `取消 / 保存(插入)` 按钮与回调

### 验收补充

1. `/` 菜单触发“内嵌网页”后，弹框显示与原行为一致。
2. 编辑已有内嵌项时，弹框可正确回填 URL 与标题。
3. 点击保存后，富文本区域内嵌内容可正常插入或更新。
4. 现有样式不变，按钮顺序保持：取消在左，保存/插入在右。
