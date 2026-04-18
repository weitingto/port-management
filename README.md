# 端口管理系统

面向开发环境的桌面应用，用于端口监控、进程查杀和端口分配冲突检测。

## 功能特性

- **端口扫描** - 实时扫描本机端口占用情况，支持 LISTENING 和 ESTABLISHED 状态
- **进程查杀** - 一键关闭指定端口或全部端口
- **端口登记** - 为常用端口设置项目名称和备注，方便管理
- **冲突检测** - 自动标记端口冲突情况
- **系统托盘** - 最小化到托盘，持续后台监控
- **自动刷新** - 可配置扫描间隔，保持端口状态实时更新

## 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron 28 |
| 前端框架 | Vue 3 + Vite 5 |
| UI 组件 | Element Plus |
| 构建工具 | electron-builder |

## 项目结构

```
Port Management/
├── electron/                 # Electron 主进程
│   ├── main.js              # 主进程入口（窗口管理、IPC、系统托盘）
│   ├── preload.js           # 上下文桥接（安全 API 暴露）
│   └── services/
│       ├── scanner.js       # 端口扫描（netstat -ano）
│       ├── killer.js        # 进程查杀（taskkill）
│       └── persistence.js   # JSON 文件持久化
├── src/                      # Vue 渲染进程
│   ├── main.js              # Vue 应用入口
│   └── App.vue               # 主组件
├── dist-vue/                 # Vite 构建输出
├── release/                  # Electron 构建输出
├── package.json
├── vite.config.js
└── electron-builder.json
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

需要两个终端窗口：

```bash
# 终端 1: 启动 Vite 开发服务器
npm run dev

# 终端 2: 启动 Electron
npm run electron:dev
```

### 构建生产版本

```bash
npm run electron:build
```

构建输出位于 `release/` 目录，`.exe` 文件在 `win-unpacked/` 文件夹下。

## 使用说明

### 端口分类

| 分类 | 端口范围 | 说明 |
|------|----------|------|
| 知名端口 | 0-1023 | 系统保留端口 |
| 注册端口 | 1024-49151 | 可注册使用的端口 |
| 动态端口 | 49152-65535 | 临时分配端口 |

### 端口状态

| 状态 | 说明 |
|------|------|
| 已登记 | 已在本地注册的端口 |
| 冲突 | 端口已被登记但被其他进程占用 |
| 未管理 | 未登记的端口 |
| ESTABLISHED | 活跃连接（绿色呼吸灯提示） |

### 数据存储

- 注册端口: `%APPDATA%/port-manager/data/registered-ports.json`
- 设置: `%APPDATA%/port-manager/data/settings.json`

## 安全说明

本应用在渲染进程与主进程之间使用了：

- `contextIsolation: true` - 启用上下文隔离
- `nodeIntegration: false` - 禁用 Node.js 集成
- IPC 参数校验 - 所有输入均经过验证

## License

MIT
