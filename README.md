# Vue3 Milkdown 在线文档编辑器

## 项目说明
当前项目已裁剪为单方案实现：**Milkdown + Yjs + Hocuspocus**。

目标是提供接近飞书文档体验的在线编辑能力，包括：
- 可视化编辑 + Markdown 双栏同步
- Slash 菜单、浮动工具栏、块编辑
- 选区评论、锚点高亮、评论列表定位
- 表格、图片、代码块、Latex 等富文本能力
- 协同连接/断开与状态展示

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
