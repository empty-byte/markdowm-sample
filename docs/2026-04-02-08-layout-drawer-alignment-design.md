# 2026-04-02 布局与抽屉改造设计记录

## 背景

本轮需求聚焦 5 项：

1. 正文样式继续对齐 `code.html`
2. 右侧评论/历史改为抽屉式交互
3. 建立可复用的 CSS 底座
4. 大纲保持浮动可见并可滚动
5. 文档树支持展开/收起，长列表可滚动，底部操作固定

## 设计目标

- 不改编辑器业务能力（评论、历史、协同、白板/流程图/思维导图能力保持）
- 样式与布局向 `code.html` 收敛，同时保留现有功能
- 为后续新增组件提供稳定的设计 token 与通用类

## 数据结构与状态流

### 1) 左侧文档树

- 新增状态：`isStrategyExpanded: Ref<boolean>`
- 交互：
  - 点击 `Strategy` 文件夹行 -> 切换展开/收起
  - `tree-children` 通过 `v-show` 控制显隐

### 2) 右侧抽屉

- 新增状态：
  - `sidePanelTab: Ref<'comments' | 'history'>`
  - `sidePanelOpen: Ref<boolean>`
- 新增流程：
  - 点击 Tab
    - 若抽屉关闭：打开 + 切换到该 tab
    - 若抽屉打开且点击当前 tab：收起抽屉
    - 若抽屉打开且点击另一个 tab：保持打开并切换内容
  - 评论锚点定位、从选区发起评论时：强制打开评论抽屉

## 布局与样式策略

### 1) 正文区

- 仅通过 `pixel-body.css` 覆盖调整标题、协作者行、正文排版（`h1/h2/h3/p/li/ul/ol/blockquote`）
- 保持 Milkdown 可编辑 DOM 不变，避免影响输入能力

### 2) 左侧与大纲

- 左侧栏与大纲栏固定布局（固定于视口）
- 左侧内容区和大纲列表独立 `overflow-y: auto`
- 底部 `Settings/Trash` 使用 `margin-top: auto` 锚定到底部

### 3) 右侧抽屉

- 宽度分为两态：
  - 收起：窄 rail（只保留 tab 快速入口）
  - 展开：完整抽屉（显示评论/历史面板）
- 通过页面根类名控制主内容右侧留白，实现“抽屉打开/关闭”的视觉切换

### 4) CSS 复用底座

- 新增 `src/styles/editorial-system.css`
- 分层 token：
  - color / typography / spacing / radius / shadow / motion / z-index
- 提供通用类：
  - surface/card/button/pill/chip/layout/motion/accessibility 工具

## 边界场景

- 抽屉收起状态下，评论定位动作会自动展开抽屉，避免“看不到定位结果”
- 左侧文档树条目过多时，不挤压底部操作区
- 大纲条目过多时，支持独立滚动，不影响正文滚动
- 小屏断点下保留现有响应式降级逻辑（不强行固定抽屉）

## 验收标准

- [x] 正文字体、间距、标题层级向 `code.html` 收敛
- [x] 右侧评论/历史抽屉可开关，tab 可切换且功能不回归
- [x] 左侧文档树可展开/收起，长列表可滚动，底部操作固定
- [x] 大纲在滚动时保持可见，列表可滚动
- [x] 已建立 CSS 复用底座并提供说明文档
- [x] `npm run build` 通过
- [x] `npm run test` 通过
- [x] 相似度脚本（perceptual）>= 95%
