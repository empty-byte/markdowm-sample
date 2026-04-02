# 2026-04-02 UI System Notes

## 目标

建立一层可复用的 editorial UI 底座，统一管理颜色、字号、间距、圆角、阴影、动效与层级，并提供稳定的通用类，供后续组件逐步接入。

这份系统只提供“复用层”，不接管现有页面布局，也不修改当前 `.vue`、`src/style.css` 或 `pixel-*.css` 的实现。

## 文件职责

- `src/styles/editorial-system.css`
  - 放 design tokens
  - 放稳定的通用类
  - 放少量动画与辅助工具类
- `docs/2026-04-02-ui-system-notes.md`
  - 说明 token 分层
  - 说明类命名与复用方式
  - 说明未来组件接入建议

## Token 分层

### 1. Color

颜色 token 统一以 `--ed-color-*` 命名，区分基础面、语义色与交互态。

- 背景与表面：`--ed-color-bg`、`--ed-color-surface`、`--ed-color-surface-strong`、`--ed-color-surface-muted`
- 文本：`--ed-color-text`、`--ed-color-text-strong`、`--ed-color-text-muted`
- 边框：`--ed-color-line`、`--ed-color-line-strong`
- 品牌与交互：`--ed-color-primary`、`--ed-color-primary-hover`、`--ed-color-primary-soft`
- 语义色：`--ed-color-success`、`--ed-color-warning`、`--ed-color-danger`、`--ed-color-info`
- 遮罩：`--ed-color-overlay`

### 2. Typography

字号、字重、行高和字距都拆成独立 token，方便不同组件复用同一节奏。

- 字体族：`--ed-font-sans`、`--ed-font-display`、`--ed-font-mono`
- 字号：`--ed-text-xs`、`--ed-text-sm`、`--ed-text-md`、`--ed-text-lg`、`--ed-text-xl`、`--ed-text-2xl`、`--ed-text-3xl`
- 行高：`--ed-leading-tight`、`--ed-leading-snug`、`--ed-leading-base`、`--ed-leading-relaxed`
- 字重：`--ed-weight-regular`、`--ed-weight-medium`、`--ed-weight-semibold`、`--ed-weight-bold`、`--ed-weight-extrabold`
- 字距：`--ed-letter-tight`、`--ed-letter-wide`

### 3. Spacing

间距 token 用固定步进，覆盖大部分 UI 间距场景。

- `--ed-space-0`
- `--ed-space-1`
- `--ed-space-2`
- `--ed-space-3`
- `--ed-space-4`
- `--ed-space-5`
- `--ed-space-6`
- `--ed-space-8`
- `--ed-space-10`
- `--ed-space-12`
- `--ed-space-16`
- `--ed-space-20`

### 4. Radius

圆角 token 用于按钮、卡片、胶囊标签和容器统一。

- `--ed-radius-xs`
- `--ed-radius-sm`
- `--ed-radius-md`
- `--ed-radius-lg`
- `--ed-radius-xl`
- `--ed-radius-2xl`
- `--ed-radius-pill`

### 5. Shadow

阴影 token 用于层次、浮层和按钮悬浮态。

- `--ed-shadow-xs`
- `--ed-shadow-sm`
- `--ed-shadow-md`
- `--ed-shadow-lg`
- `--ed-shadow-inset`

### 6. Motion

动效 token 控制节奏和曲线，避免各组件各自写不同的时长。

- `--ed-duration-fast`
- `--ed-duration-base`
- `--ed-duration-slow`
- `--ed-ease-standard`
- `--ed-ease-emphasized`

### 7. Z-Index

层级 token 只保留必要档位，便于浮层、菜单、模态框统一管理。

- `--ed-z-base`
- `--ed-z-raised`
- `--ed-z-sticky`
- `--ed-z-overlay`
- `--ed-z-popover`
- `--ed-z-modal`
- `--ed-z-toast`

## 通用类

### 容器与排版

- `.ed-shell`：基础文字与字体承载层
- `.ed-title` / `.ed-title--sm|md|lg`：标题
- `.ed-body` / `.ed-body--muted`：正文
- `.ed-mono`：等宽文本
- `.ed-muted`：弱化文本

### Surface

- `.ed-surface`：基础表面
- `.ed-surface-strong`：更有层次的表面
- `.ed-card`：通用卡片
- `.ed-card--quiet`：安静背景
- `.ed-card--raised`：更明显的层级
- `.ed-card__eyebrow`、`.ed-card__title`、`.ed-card__body`：卡片内部信息层次

### Actions

- `.ed-btn`：基础按钮
- `.ed-btn--primary`：主操作
- `.ed-btn--secondary`：次级强调
- `.ed-btn--ghost`：弱按钮

### 标签与状态

- `.ed-pill`：胶囊基础样式
- `.ed-pill--neutral|info|success|warning|danger`：语义胶囊
- `.ed-chip`：更轻量的标签/元信息

### Layout Utilities

- `.ed-stack` / `.ed-stack--xs|sm|md|lg`：纵向堆叠
- `.ed-row` / `.ed-row--wrap` / `.ed-row--between`：横向排列
- `.ed-cluster`：可换行的紧凑横排
- `.ed-grid` / `.ed-grid--2|3`：网格布局
- `.ed-divider`：分割线

### State / Accessibility / Motion

- `.ed-sr-only`：仅屏幕阅读器可见
- `.ed-overlay`：遮罩层
- `.ed-sticky`：粘性定位辅助
- `.ed-elevated`、`.ed-elevated-lg`：提升层级
- `.ed-outline`、`.ed-outline-strong`：边框辅助
- `.ed-radius-sm|md|lg|xl`：圆角快捷类
- `.ed-p-2|3|4|6`、`.ed-px-3|4`、`.ed-py-2|3`：常用内边距
- `.ed-gap-2|3|4|6`：常用间距
- `.ed-fade-in`、`.ed-slide-up`、`.ed-pop-in`：轻量入场动效

## 复用原则

1. 优先复用 token，不要为每个组件重新定义颜色和尺寸。
2. 通用类只负责“结构和节奏”，不要塞入业务语义。
3. 组件状态通过修饰类表达，例如 `--primary`、`--quiet`、`--raised`。
4. 不要把这套 CSS 当成页面级主题覆盖层使用，它应该是低风险的能力库。

## 未来组件接入建议

### 建议接入顺序

1. 先接按钮、胶囊、卡片、表单输入等高复用组件。
2. 再接布局工具类，用于栅格、侧栏、面板和工具条。
3. 最后再把具体业务页面迁移到这套 token 之上。

### 推荐用法

```html
<section class="ed-card ed-stack ed-card--raised">
  <h3 class="ed-card__title">Recent activity</h3>
  <p class="ed-card__body">Uses the shared editorial tokens and spacing scale.</p>
  <div class="ed-cluster">
    <button class="ed-btn ed-btn--primary">Primary action</button>
    <span class="ed-pill ed-pill--info">Live</span>
  </div>
</section>
```

### 接入时的注意点

- 如果组件已有强约束样式，先替换 token，再替换类名。
- 如果组件是页面级布局，不要一次性全量切换，先从按钮和 surface 开始。
- 如果未来需要主题扩展，优先新增 token，不要直接改现有 token 的语义。

## 本次交付边界

- 已新增可复用 CSS 底座。
- 已新增使用说明。
- 未修改任何现有页面文件。
- 未接入现有页面，确保当前视觉和行为保持不变。

