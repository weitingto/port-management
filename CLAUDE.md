# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

端口管理系统 - 面向开发环境的桌面应用，用于端口监控、进程查杀和端口分配冲突检测。

## 技术栈

- **桌面框架**: Electron
- **前端框架**: Vue 3 + Vite
- **UI 组件库**: Element Plus
- **构建工具**: electron-builder

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式（需要两个终端）
npm run dev          # 终端1: 启动 Vite 开发服务器
npm run electron:dev # 终端2: 启动 Electron

# 构建生产版本
npm run electron:build
```

构建输出: `release/win-unpacked/` 下的 `.exe` 文件

## 架构

```
electron/           # Electron 主进程
├── main.js         # 主进程入口（窗口管理、IPC、系统托盘）
├── preload.js      # 上下文桥接（安全暴露 API 到渲染进程）
└── services/       # 主进程服务
    ├── scanner.js  # 端口扫描（netstat -ano）
    ├── killer.js   # 进程查杀（taskkill）
    └── persistence.js # JSON 文件持久化

src/                # Vue 渲染进程
├── main.js         # Vue 应用入口
├── App.vue         # 主组件（UI 和业务逻辑）
└── styles/         # 样式文件
```

### IPC 通信

渲染进程通过 `window.electronAPI` 访问主进程服务：

| 方法 | 功能 |
|------|------|
| scanPorts() | 扫描端口 |
| killProcess(pid) | 查杀进程 |
| registerPort(info) | 登记端口 |
| unregisterPort(port) | 取消登记 |
| onPortUpdate(callback) | 订阅端口更新 |

## 数据存储

- 注册端口: `%APPDATA%/port-manager/data/registered-ports.json`
- 设置: `%APPDATA%/port-manager/data/settings.json`
