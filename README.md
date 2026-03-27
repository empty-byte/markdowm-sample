# Vue3 在线文档编辑器对比（类飞书风格）

## 项目目标（需求总结）
本项目用于验证并对比 3 套可集成到 Vue3 的在线文档编辑方案，目标是接近飞书文档的使用体验。

核心需求：
1. 在 Vue3 项目中实现多方案编辑器集成，每个方案独立页面可体验。
2. 支持基础编辑能力（粗体、斜体、列表、撤销/重做等）。
3. 支持在线协同编辑（多人同房间实时同步）。
4. 支持可调出的功能菜单（命令面板）。
5. 支持评论与文档历史的基础能力演示。

## 当前实现

### 方案页面
- `/tiptap`：Tiptap + Yjs + Hocuspocus（增强版）
- `/milkdown`：Milkdown + Yjs + Hocuspocus
- `/blocksuite`：BlockSuite 页面集成
- `/`：方案总览页

### 已完成功能
- 基础编辑：粗体、斜体、列表、撤销、重做
- 协同连接：连接/断开协同，显示连接状态
- 命令菜单：`Ctrl+/` 呼出，支持命令搜索与执行
- 评论面板（Tiptap 页面）：选区评论、定位、删除
- 文档历史（Tiptap 页面）：手动快照、回滚、删除

### 协同协议与服务
- 客户端 Provider：`@hocuspocus/provider`
- 服务端：`@hocuspocus/server`
- 默认协同地址：`ws://127.0.0.1:1234`

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动协同服务（必需）
```bash
npm run collab:server
```

### 3. 启动前端
```bash
npm run dev
```

### 4. 测试协同
1. 打开两个浏览器标签页（或两个浏览器窗口）
2. 访问同一方案页面（推荐 `/tiptap`）
3. 两边都点击“连接协同”
4. 在任意一边输入内容，另一边应实时同步

## 环境变量
可通过 `.env` 覆盖协同地址（参考 `.env.example`）：

```env
VITE_COLLAB_WS_URL=ws://127.0.0.1:1234
```

## 可用脚本
```bash
npm run dev            # 启动前端开发服务
npm run collab:server  # 启动协同 WebSocket 服务
npm run test           # 运行测试
npm run build          # 生产构建
npm run preview        # 预览构建产物
```

## 说明与边界
- 评论与历史功能目前主要是本地演示能力（用于验证交互流程）。
- 协同核心链路已打通，适合继续扩展鉴权、权限控制、持久化、版本管理等生产能力。

## 技术栈
- Vue 3 + TypeScript + Vite
- Tiptap / Milkdown / BlockSuite
- Yjs + Hocuspocus
- Vitest
