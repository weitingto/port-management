# 端口管理系统设计规格 (更新)

## 项目概述

**项目名称:** Port Manager（端口管理器）
**使用场景:** 个人开发环境端口监控与管理
**核心能力:** 端口监控、进程查杀、端口登记与冲突避免
**技术栈:** Electron + Vue 3 + Vite + Element Plus

## 功能变更

### 新增：单个端口关闭按钮

- 将"查杀"按钮改为"关闭"按钮
- 功能不变：调用 `killProcess(pid)` 终止进程

### 新增：关闭全部端口按钮

- **位置**: 工具栏右侧
- **点击行为**: 弹出确认框
- **确认框文案**:
  ```
  ⚠️ 确认关闭全部端口？
  将终止所有占用端口的进程，可能影响正在运行的服务。
  ```
- **确认后**: 遍历所有端口，按 PID 去重后依次调用 `killProcess(pid)`

### 修改：IPC 新增关闭全部接口

```js
// preload.js 新增
closeAllPorts: () => ipcRenderer.invoke('port:closeAll')

// main.js IPC handler
ipcMain.handle('port:closeAll', async () => {
  const ports = await scanPorts()
  const pids = [...new Set(ports.map(p => p.pid))]
  const results = []
  for (const pid of pids) {
    const result = await killProcess(pid)
    results.push({ pid, ...result })
  }
  return results
})
```

## 界面布局

```
┌──────────────────────────────────────────────────────────────┐
│  [刷新] [登记端口] [设置]     [关闭全部]      🔍 筛选...   │
├──────────────────────────────────────────────────────────────┤
│  端口   │ 进程名        │ PID   │ 状态    │ 操作          │
├──────────────────────────────────────────────────────────────┤
│  3000  │ node.exe     │ 1234  │ 已登记  │ [关闭]        │
│  8080  │ java.exe     │ 5678  │ 未管理  │ [关闭]        │
│  ...   │ ...          │ ...   │ ...     │ ...           │
└──────────────────────────────────────────────────────────────┘
```

## 文件变更

- `src/App.vue` - 修改按钮文案，新增关闭全部功能
- `electron/preload.js` - 新增 closeAllPorts API
- `electron/main.js` - 新增 port:closeAll IPC handler
