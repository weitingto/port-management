# 端口管理系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Electron + Vue 3 端口管理系统，实现实时端口监控、进程查杀、端口登记与冲突检测

**Architecture:** Electron 分层架构：主进程处理端口扫描和进程查杀，渲染进程使用 Vue 3 + Element Plus 展示 UI，通过 IPC 通信

**Tech Stack:** Electron + Vue 3 + Vite + Element Plus + netstat (Windows)

---

## 文件结构

```
E:/桌面/Port Management/
├── package.json
├── vite.config.js
├── electron-builder.json
├── index.html
├── electron/
│   ├── main.js
│   ├── preload.js
│   └── services/
│       ├── scanner.js
│       ├── killer.js
│       └── persistence.js
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── components/
│   │   ├── PortTable.vue
│   │   ├── PortDialog.vue
│   │   └── SettingsDialog.vue
│   ├── stores/
│   │   └── portStore.js
│   └── styles/
│       └── port-manager.css
```

---

## Task 1: 项目初始化

**Files:**
- Create: `E:/桌面/Port Management/package.json`
- Create: `E:/桌面/Port Management/vite.config.js`
- Create: `E:/桌面/Port Management/index.html`
- Create: `E:/桌面/Port Management/electron-builder.json`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "port-manager",
  "version": "1.0.0",
  "description": "端口管理系统 - 开发环境端口监控与冲突避免",
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "electron:build": "vite build && electron-builder",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "pinia": "^2.1.0",
    "element-plus": "^2.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "concurrently": "^8.2.0",
    "wait-on": "^7.2.0"
  }
}
```

- [ ] **Step 2: 创建 vite.config.js**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: 'dist-vue',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
```

- [ ] **Step 3: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'">
    <title>端口管理系统</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 4: 创建 electron-builder.json**

```json
{
  "appId": "com.portmanager.app",
  "productName": "端口管理系统",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist-vue/**/*",
    "electron/**/*"
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ]
  },
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

---

## Task 2: Electron 主进程

**Files:**
- Create: `E:/桌面/Port Management/electron/main.js`
- Create: `E:/桌面/Port Management/electron/preload.js`
- Create: `E:/桌面/Port Management/electron/services/scanner.js`
- Create: `E:/桌面/Port Management/electron/services/killer.js`
- Create: `E:/桌面/Port Management/electron/services/persistence.js`

- [ ] **Step 1: 创建 electron/services/scanner.js**

```js
const { exec } = require('child_process')

/**
 * 扫描本机端口占用情况
 * @returns {Promise<Array<{port: number, processName: string, pid: number, status: string}>>}
 */
function scanPorts() {
  return new Promise((resolve, reject) => {
    exec('netstat -ano', { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        reject(error)
        return
      }

      const lines = stdout.split('\n')
      const portMap = new Map()
      const regex = /TCP\s+[\d.]+:(\d+)\s+[\d.]+:(\d+)\s+(\w+)\s+(\d+)/

      for (const line of lines) {
        const match = line.match(regex)
        if (match) {
          const port = parseInt(match[1])
          const state = match[3]
          const pid = parseInt(match[4])

          if (!portMap.has(port) && state === 'LISTENING') {
            portMap.set(port, pid)
          }
        }
      }

      resolve(Array.from(portMap.entries()).map(([port, pid]) => ({
        port,
        pid,
        processName: `PID: ${pid}`,
        status: 'in_use'
      })))
    })
  })
}

/**
 * 根据 PID 获取进程名
 * @param {number} pid
 * @returns {Promise<string>}
 */
function getProcessNameByPid(pid) {
  return new Promise((resolve) => {
    exec(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' }, (error, stdout) => {
      if (error || !stdout) {
        resolve(`Unknown (PID: ${pid})`)
        return
      }
      const parts = stdout.split(',')
      if (parts.length >= 2) {
        resolve(parts[1].replace(/"/g, '').trim())
      } else {
        resolve(stdout.split(' ').filter(s => s)[1] || `PID: ${pid}`)
      }
    })
  })
}

module.exports = { scanPorts, getProcessNameByPid }
```

- [ ] **Step 2: 创建 electron/services/killer.js**

```js
const { exec } = require('child_process')

/**
 * 根据 PID 查杀进程
 * @param {number} pid
 * @returns {Promise<{success: boolean, message: string}>}
 */
function killProcess(pid) {
  return new Promise((resolve) => {
    exec(`taskkill /PID ${pid} /F`, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          message: stderr || error.message
        })
        return
      }
      resolve({
        success: true,
        message: '进程已终止'
      })
    })
  })
}

module.exports = { killProcess }
```

- [ ] **Step 3: 创建 electron/services/persistence.js**

```js
const { app } = require('electron')
const fs = require('fs')
const path = require('path')

function getDataPath() {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'data')
}

function ensureDataDir() {
  const dataPath = getDataPath()
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true })
  }
  return dataPath
}

function loadRegisteredPorts() {
  try {
    const dataPath = ensureDataDir()
    const filePath = path.join(dataPath, 'registered-ports.json')
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(data).ports || []
    }
  } catch (err) {
    console.error('Error loading registered ports:', err)
  }
  return []
}

function saveRegisteredPorts(ports) {
  try {
    const dataPath = ensureDataDir()
    const filePath = path.join(dataPath, 'registered-ports.json')
    fs.writeFileSync(filePath, JSON.stringify({ ports }, null, 2), 'utf8')
  } catch (err) {
    console.error('Error saving registered ports:', err)
  }
}

function loadSettings() {
  try {
    const dataPath = ensureDataDir()
    const filePath = path.join(dataPath, 'settings.json')
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    }
  } catch (err) {
    console.error('Error loading settings:', err)
  }
  return {}
}

function saveSettings(settings) {
  try {
    const dataPath = ensureDataDir()
    const filePath = path.join(dataPath, 'settings.json')
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8')
  } catch (err) {
    console.error('Error saving settings:', err)
  }
}

module.exports = {
  loadRegisteredPorts,
  saveRegisteredPorts,
  loadSettings,
  saveSettings
}
```

- [ ] **Step 4: 创建 electron/preload.js**

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  scanPorts: () => ipcRenderer.invoke('port:scan'),
  killProcess: (pid) => ipcRenderer.invoke('port:kill', pid),
  registerPort: (info) => ipcRenderer.invoke('port:register', info),
  unregisterPort: (port) => ipcRenderer.invoke('port:unregister', port),
  getRegisteredPorts: () => ipcRenderer.invoke('port:getRegistered'),
  onPortUpdate: (callback) => {
    ipcRenderer.on('port:update', (event, data) => callback(data))
  },
  minimizeToTray: () => ipcRenderer.send('tray:minimize'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings)
})
```

- [ ] **Step 5: 创建 electron/main.js**

```js
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const { scanPorts } = require('./services/scanner')
const { killProcess } = require('./services/killer')
const { loadRegisteredPorts, saveRegisteredPorts, loadSettings, saveSettings } = require('./services/persistence')

let mainWindow = null
let tray = null
let scanInterval = null
let registeredPorts = []
let settings = { scanInterval: 3000 }

const isDev = !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    title: '端口管理系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-vue/index.html'))
  }

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => mainWindow.show() },
    { label: '退出', click: () => {
      app.isQuitting = true
      app.quit()
    }}
  ])

  tray.setToolTip('端口管理系统')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => mainWindow.show())
}

function startPortScan() {
  if (scanInterval) clearInterval(scanInterval)

  scanInterval = setInterval(async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        const ports = await scanPorts()
        const enrichedPorts = await enrichPortInfo(ports)
        mainWindow.webContents.send('port:update', enrichedPorts)
      } catch (err) {
        console.error('Scan error:', err)
      }
    }
  }, settings.scanInterval)
}

async function enrichPortInfo(ports) {
  const { exec } = require('child_process')

  return new Promise((resolve) => {
    const promises = ports.map(port => new Promise((res) => {
      exec(`tasklist /FI "PID eq ${port.pid}" /FO CSV /NH`, { encoding: 'utf8' }, (error, stdout) => {
        if (error || !stdout) {
          port.processName = `PID: ${port.pid}`
        } else {
          const parts = stdout.split(',')
          port.processName = parts.length >= 2 ? parts[1].replace(/"/g, '').trim() : `PID: ${port.pid}`
        }

        const registered = registeredPorts.find(r => r.port === port.port)
        port.registered = !!registered
        port.projectName = registered?.projectName || ''
        port.remark = registered?.remark || ''

        if (registered && port.registered && port.processName !== `PID: ${port.pid}`) {
          port.conflict = true
        } else {
          port.conflict = false
        }

        res(port)
      })
    }))

    Promise.all(promises).then(resolve)
  })
}

function setupIPC() {
  ipcMain.handle('port:scan', async () => {
    try {
      const ports = await scanPorts()
      return await enrichPortInfo(ports)
    } catch (err) {
      return []
    }
  })

  ipcMain.handle('port:kill', async (event, pid) => {
    return await killProcess(pid)
  })

  ipcMain.handle('port:register', async (event, info) => {
    const existing = registeredPorts.find(p => p.port === info.port)
    if (existing) {
      existing.projectName = info.projectName
      existing.remark = info.remark || ''
      existing.registeredAt = new Date().toISOString()
    } else {
      registeredPorts.push({
        port: info.port,
        projectName: info.projectName,
        remark: info.remark || '',
        registeredAt: new Date().toISOString()
      })
    }
    saveRegisteredPorts(registeredPorts)
    return { success: true }
  })

  ipcMain.handle('port:unregister', async (event, port) => {
    registeredPorts = registeredPorts.filter(p => p.port !== port)
    saveRegisteredPorts(registeredPorts)
    return { success: true }
  })

  ipcMain.handle('port:getRegistered', () => {
    return registeredPorts
  })

  ipcMain.on('tray:minimize', () => {
    mainWindow.hide()
  })

  ipcMain.handle('settings:get', () => settings)

  ipcMain.handle('settings:save', (event, newSettings) => {
    settings = { ...settings, ...newSettings }
    saveSettings(settings)
    startPortScan()
    return { success: true }
  })
}

app.whenReady().then(() => {
  registeredPorts = loadRegisteredPorts()
  settings = { ...settings, ...loadSettings() }
  createWindow()
  createTray()
  setupIPC()
  startPortScan()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
```

---

## Task 3: Vue 前端入口

**Files:**
- Create: `E:/桌面/Port Management/src/main.js`
- Create: `E:/桌面/Port Management/src/App.vue`
- Create: `E:/桌面/Port Management/src/styles/port-manager.css`

- [ ] **Step 1: 创建 src/main.js**

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './styles/port-manager.css'

const app = createApp(App)
app.use(createPinia())
app.use(ElementPlus)
app.mount('#app')
```

- [ ] **Step 2: 创建 src/styles/port-manager.css**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f0f2f5;
  overflow: hidden;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: #001529;
  color: #fff;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h1 {
  font-size: 18px;
  font-weight: 500;
}

.app-main {
  flex: 1;
  padding: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.toolbar-right {
  margin-left: auto;
}

.port-table-container {
  flex: 1;
  background: #fff;
  border-radius: 4px;
  overflow: hidden;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.status-conflict {
  color: #ff4d4f;
}

.status-registered {
  color: #52c41a;
}

.status-unmanaged {
  color: #1890ff;
}
```

- [ ] **Step 3: 创建 src/App.vue**

```vue
<template>
  <div id="app">
    <header class="app-header">
      <h1>端口管理系统</h1>
    </header>

    <main class="app-main">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button type="primary" @click="refreshPorts" :loading="loading">
            刷新
          </el-button>
          <el-button type="success" @click="showRegisterDialog = true">
            登记端口
          </el-button>
          <el-button @click="showSettingsDialog = true">
            设置
          </el-button>
        </div>
        <div class="toolbar-right">
          <el-input
            v-model="searchQuery"
            placeholder="搜索端口或进程..."
            style="width: 200px;"
            clearable
          />
        </div>
      </div>

      <div class="port-table-container">
        <el-table
          :data="filteredPorts"
          stripe
          style="width: 100%; height: 100%;"
          :height="'100%'"
        >
          <el-table-column prop="port" label="端口" width="100" sortable />
          <el-table-column prop="processName" label="进程名" min-width="150" />
          <el-table-column prop="pid" label="PID" width="100" sortable />
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <span class="status-tag">
                <template v-if="row.conflict">
                  <el-tag type="danger">冲突</el-tag>
                </template>
                <template v-else-if="row.registered">
                  <el-tag type="success">已登记</el-tag>
                </template>
                <template v-else>
                  <el-tag type="info">未管理</el-tag>
                </template>
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="projectName" label="项目" min-width="120" />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.conflict"
                type="danger"
                size="small"
                @click="handleKill(row)"
              >
                查杀
              </el-button>
              <el-button
                v-else-if="!row.registered"
                type="primary"
                size="small"
                @click="quickRegister(row)"
              >
                登记
              </el-button>
              <el-button
                v-else
                type="default"
                size="small"
                @click="handleUnregister(row)"
              >
                取消登记
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>

    <!-- 登记弹窗 -->
    <el-dialog v-model="showRegisterDialog" title="登记端口" width="400px">
      <el-form :model="registerForm" label-width="80px">
        <el-form-item label="端口号">
          <el-input-number
            v-model="registerForm.port"
            :min="1"
            :max="65535"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="项目名称">
          <el-input v-model="registerForm.projectName" placeholder="如: my-vue-app" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="registerForm.remark"
            type="textarea"
            :rows="2"
            placeholder="可选备注信息"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRegisterDialog = false">取消</el-button>
        <el-button type="primary" @click="handleRegister">确认</el-button>
      </template>
    </el-dialog>

    <!-- 设置弹窗 -->
    <el-dialog v-model="showSettingsDialog" title="设置" width="400px">
      <el-form :model="settingsForm" label-width="100px">
        <el-form-item label="扫描间隔">
          <el-select v-model="settingsForm.scanInterval" style="width: 100%;">
            <el-option :value="1000" label="1 秒" />
            <el-option :value="3000" label="3 秒" />
            <el-option :value="5000" label="5 秒" />
            <el-option :value="10000" label="10 秒" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettingsDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const ports = ref([])
const loading = ref(false)
const searchQuery = ref('')
const showRegisterDialog = ref(false)
const showSettingsDialog = ref(false)

const registerForm = ref({
  port: null,
  projectName: '',
  remark: ''
})

const settingsForm = ref({
  scanInterval: 3000
})

const filteredPorts = computed(() => {
  if (!searchQuery.value) return ports.value
  const query = searchQuery.value.toLowerCase()
  return ports.value.filter(p =>
    p.port.toString().includes(query) ||
    p.processName.toLowerCase().includes(query) ||
    (p.projectName && p.projectName.toLowerCase().includes(query))
  )
})

async function refreshPorts() {
  loading.value = true
  try {
    const result = await window.electronAPI.scanPorts()
    ports.value = result
  } catch (err) {
    ElMessage.error('扫描失败')
  } finally {
    loading.value = false
  }
}

async function handleKill(row) {
  try {
    await ElMessageBox.confirm(
      `确定要终止进程 ${row.processName} (PID: ${row.pid}) 吗？`,
      '确认查杀',
      { type: 'warning' }
    )
    const result = await window.electronAPI.killProcess(row.pid)
    if (result.success) {
      ElMessage.success('进程已终止')
      await refreshPorts()
    } else {
      ElMessage.error(result.message)
    }
  } catch {
    // 用户取消
  }
}

async function handleRegister() {
  if (!registerForm.value.port || !registerForm.value.projectName) {
    ElMessage.warning('请填写端口号和项目名称')
    return
  }

  try {
    await window.electronAPI.registerPort(registerForm.value)
    ElMessage.success('登记成功')
    showRegisterDialog.value = false
    registerForm.value = { port: null, projectName: '', remark: '' }
    await refreshPorts()
  } catch (err) {
    ElMessage.error('登记失败')
  }
}

async function quickRegister(row) {
  registerForm.value.port = row.port
  registerForm.value.projectName = ''
  registerForm.value.remark = ''
  showRegisterDialog.value = true
}

async function handleUnregister(row) {
  try {
    await ElMessageBox.confirm(
      `确定要取消登记端口 ${row.port} 吗？`,
      '确认取消',
      { type: 'warning' }
    )
    await window.electronAPI.unregisterPort(row.port)
    ElMessage.success('已取消登记')
    await refreshPorts()
  } catch {
    // 用户取消
  }
}

async function handleSaveSettings() {
  try {
    await window.electronAPI.saveSettings(settingsForm.value)
    ElMessage.success('设置已保存')
    showSettingsDialog.value = false
  } catch (err) {
    ElMessage.error('保存设置失败')
  }
}

onMounted(async () => {
  await refreshPorts()

  const settings = await window.electronAPI.getSettings()
  settingsForm.value.scanInterval = settings.scanInterval || 3000

  window.electronAPI.onPortUpdate((data) => {
    ports.value = data
  })
})
</script>
```

---

## Task 4: 安装依赖并测试

**Files:**
- Modify: `E:/桌面/Port Management/` (安装依赖)

- [ ] **Step 1: 进入项目目录并安装依赖**

```bash
cd "E:/桌面/Port Management"
npm install
```

- [ ] **Step 2: 启动 Vite 开发服务器**

```bash
npm run dev
```

预期输出: `Local: http://localhost:5173/`

- [ ] **Step 3: 另开终端启动 Electron**

```bash
cd "E:/桌面/Port Management"
npm run electron:dev
```

预期: Electron 窗口打开，显示端口管理界面

---

## 验证清单

- [ ] Electron 启动正常，窗口显示
- [ ] 端口列表正确加载（显示本机端口）
- [ ] 刷新按钮可手动刷新端口列表
- [ ] 登记端口弹窗可正常填写并提交
- [ ] 冲突端口显示红色"冲突"标签
- [ ] 查杀按钮可终止进程
- [ ] 取消登记可移除端口登记状态
- [ ] 设置弹窗可修改扫描间隔
- [ ] 最小化到托盘功能正常
