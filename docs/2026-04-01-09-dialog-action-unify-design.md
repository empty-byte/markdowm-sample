# 弹框底部按钮统一规范（2026-04-01）

## 1. 目标
统一编辑器内所有“保存型弹框”的底部操作区交互与视觉：
- 取消按钮在左
- 保存/插入按钮在右
- 保存/插入按钮使用主按钮高亮样式

## 2. 适用范围
- 内嵌网页弹框
- 白板（Excalidraw）弹框
- 流程图（LogicFlow）弹框

## 3. 交互规范
- 按钮布局：同一行、右对齐；顺序固定为“取消 | 保存/插入”
- 语义规范：取消为次级（ghost），保存/插入为主按钮（primary）
- 禁用态：保存按钮在不可提交状态下保持禁用

## 4. 视觉规范
新增全局按钮样式：`.btn.primary`
- 高亮背景（基于 `--accent`）
- 白色文字
- 轻微投影
- hover 维持主色强调

## 5. 验收标准
- 三类弹框底部按钮顺序一致：取消在左，保存/插入在右
- 保存/插入按钮均为高亮主按钮
- 构建与测试通过，无功能回归

## 6. 变更文件
- `src/views/MilkdownView.vue`
- `src/components/WhiteboardExcalidrawDialog.vue`
- `src/components/FlowchartLogicDialog.vue`
- `src/style.css`
