# Vue3 Milkdown 在线文档编辑器

## 项目说明
当前项目已裁剪为单方案实现：**Milkdown + Yjs + Hocuspocus**。

目标是提供接近飞书文档体验的在线编辑能力，包括：
- 可视化编辑为主，Markdown 面板按需展开，支持手动应用与自动同步
- Slash 菜单、浮动工具栏、块编辑
- 选区评论、浮动工具栏评论入口、锚点高亮、黄色下划线、评论列表定位
- 点击正文中的评论锚点，高亮并定位右侧对应评论
- 手动历史快照、按版本还原正文与评论状态
- 右侧评论 / 历史面板独立滚动、独立折叠
- 表格、图片、代码块、Latex 等富文本能力
- 协同连接/断开与状态展示

## 当前交互说明
- 页面主工作区为上方 Milkdown 可视化编辑器。
- 下方 Markdown 面板默认隐藏，用户可通过顶部按钮手动显示或收起。
- 创建历史快照时会保存当前文档内容和评论状态；点击历史卡片即可还原左侧正文。
- 评论支持从正文选区直接发起，已评论文本会显示黄色下划线，激活评论时会同步高亮。

## 路由
- `/`：Milkdown 主页面

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动协同服务
```bash
npm run collab:server
```

### 3. 启动前端
```bash
npm run dev
```

### 4. 常用命令
```bash
npm run test
npm run build
npm run preview
```

## 协同配置
默认协同地址：`ws://127.0.0.1:1234`

可通过 `.env` 覆盖：
```env
VITE_COLLAB_WS_URL=ws://127.0.0.1:1234
```

## 技术栈
- Vue 3 + TypeScript + Vite
- Milkdown (Crepe)
- Yjs + Hocuspocus
- Vitest
