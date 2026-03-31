# 第 7 项设计：白板画布（Excalidraw，非协作版）

## 1. 背景与目标

基于当前架构（Vue3 + Vite + Milkdown + Yjs + Hocuspocus），白板第一期先不做协作，目标是实现：

- 白板绘制结果可出现在 Markdown 文档中
- 文档内白板块提供“编辑”按钮
- 点击后进入白板编辑
- 保存后在 Markdown 中即时显示最新结果

## 2. 前置阻塞（必须直说）

1. 需要在 Milkdown 中增加白板块的“可识别标记语法 + 渲染器”
2. Excalidraw 是 React 组件，Vue 侧需要一层容器桥接

说明：这两项是实现门槛，但都可控，不属于高风险阻塞。

## 3. 范围

### In Scope（本期）

- 文档内插入白板块
- 白板块显示缩略图预览
- 白板块上显示“编辑”按钮
- 编辑完成后回写并刷新文档中的预览
- 支持基础删除（删除白板块）

### Out of Scope（本期不做）

- 实时多人协作白板
- 白板权限管理
- 白板版本分支/冲突合并

## 4. 数据结构

逻辑模型（非实现代码）：

### 4.1 Markdown 内标记（推荐方案）

推荐在 Markdown 中使用稳定 token：

`![whiteboard:流程草图](whiteboard://<whiteboardId>)`

示例：

`![whiteboard:架构草图](whiteboard://wb_01HXYZ...)`

说明：

- markdown 文本中有明确可见内容
- 解析器可通过 `whiteboard://` 协议识别白板块

### 4.2 白板数据存储

- 存储键：`whiteboardId`
- 存储内容：
  - `id: string`
  - `title: string`
  - `scene: object`（Excalidraw scene JSON）
  - `preview: string`（建议 png dataURL 或可访问地址）
  - `updatedAt: number`

第一期建议放在当前文档共享状态（Y.Doc 对应 map）中，但不做实时并发编辑控制。

## 5. 状态流与交互流

1. 用户通过 slash/命令面板插入“白板”
2. 系统创建 `whiteboardId`，插入 Markdown token
3. 渲染层识别 token，展示白板卡片（缩略图 + 编辑按钮）
4. 用户点击“编辑”，打开 Excalidraw 编辑弹层
5. 用户保存后：
   - 更新 `scene`
   - 重新生成 `preview`
   - 关闭弹层
6. 文档中的白板卡片自动显示最新预览

## 6. 边界场景与异常处理

1. token 存在但白板数据丢失：显示“数据缺失”占位 + 重建入口
2. 超大画布导致预览过大：限制导出分辨率与大小
3. 删除 Markdown token 后遗留白板数据：标记为 orphan，后续清理
4. 预览生成失败：保留 scene，显示“预览生成失败，可继续编辑”

## 7. 验收标准（可测试）

1. 插入白板后，Markdown 中出现 `whiteboard://<id>` token
2. 视图中可见白板预览与“编辑”按钮
3. 编辑并保存后，白板预览发生更新
4. 刷新页面后，白板内容可恢复显示
5. 删除白板 token 后，文档中不再显示对应白板卡片

## 8. 与后续 MySQL 对齐点

建议后续落库：

- `document_whiteboards(id, doc_id, title, scene_json, preview_url_or_blob, updated_at)`
- Markdown 中只存 `whiteboardId` 引用，不内联完整 scene JSON

## 9. 待你拍板项（不自作主张）

1. Markdown 白板语法是否采用推荐方案？
   - 已确认：`![whiteboard:title](whiteboard://id)`
2. 预览存储方式？
   - 已确认：保存为静态图片文件地址
3. 编辑入口形态？
   - 已确认：弹框编辑

## 10. 变更记录

- 2026-03-30：首版设计完成（非协作白板，支持文档中显示与回写编辑）

- 2026-03-30：确认白板语法采用 Markdown 图片协议方案（![whiteboard:title](whiteboard://id)）


- 2026-03-30：确认白板预览存储采用静态图片文件地址
- 2026-03-30：确认白板编辑入口采用弹框


## 11. 决策补充（2026-03-31 实现落地）

- 已接入 `/` 菜单白板入口：在高级菜单中新增 `白板`。
- 白板 Markdown 语法按已确认方案落地：`![whiteboard:title](whiteboard://id)`。
- 白板卡片展示方式：
  - 正文中渲染白板预览图卡片。
  - hover 显示 `打开 / 编辑 / 删除`。
- 编辑入口采用弹框：
  - 插入时填写标题与预览图静态地址。
  - 编辑时回填当前数据并保存覆盖。
- 本期存储实现：白板数据写入浏览器 `localStorage`（key: `milkdown:whiteboards:v1`），用于刷新恢复。
- 兼容说明：
  - 当前“白板编辑”是预览图地址编辑模型（非 Excalidraw 实时画图）。
  - 后续接 Excalidraw 时，可复用 `whiteboard://id` token 与卡片渲染链路。

## 12. 决策更新（2026-03-31 Excalidraw 接入）

- 已由“预览图地址编辑”升级为 Excalidraw 真编辑器弹框（Vue3 内通过 React bridge 挂载）。
- `/` 菜单选择 `白板` 后，直接进入 Excalidraw 画布编辑。
- 保存时自动：
  - 导出 PNG 预览图（data URL）；
  - 持久化 scene（elements/appState/files）；
  - 回写并保持 Markdown token 语法：`![whiteboard:title](whiteboard://id)`。
- 白板卡片操作已调整为 `编辑 / 删除`：
  - `编辑` 回到 Excalidraw 并加载已有 scene；
  - `删除` 删除文档中的 token（数据按现策略可留存，后续可做 orphan 清理）。
- 本期仍为非协作白板；协作能力后续再接入 Yjs/Hocuspocus。

## 13. 决策更新（2026-03-31 白板全屏编辑）

- 在白板编辑弹框中新增 `全屏编辑` 按钮（仅编辑模式显示）。
- 点击后切换为全屏编辑态，再次点击可 `退出全屏`。
- 全屏仅改变编辑弹框容器展示，不影响保存数据结构与回写链路。
