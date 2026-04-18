const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const { scanPorts } = require('./services/scanner')
const { killProcess } = require('./services/killer')
const { loadRegisteredPorts, saveRegisteredPorts, loadSettings, saveSettings } = require('./services/persistence')

let mainWindow = null
let tray = null
let scanIntervalId = null
let registeredPorts = []
let settings = { scanInterval: 3000 }

// 防抖相关
let scanDebounceTimer = null
const SCAN_DEBOUNCE_MS = 300

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

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
  if (scanIntervalId) {
    clearInterval(scanIntervalId)
    scanIntervalId = null
  }

  doScan()

  scanIntervalId = setInterval(() => {
    doScan()
  }, settings.scanInterval)
}

async function doScan() {
  if (!mainWindow || mainWindow.isDestroyed()) return

  // 防抖：清除之前的扫描
  if (scanDebounceTimer) {
    clearTimeout(scanDebounceTimer)
  }

  scanDebounceTimer = setTimeout(async () => {
    try {
      const ports = await scanPorts()
      const enrichedPorts = enrichPortInfo(ports)
      mainWindow.webContents.send('port:update', enrichedPorts)
    } catch (err) {
      console.error('Scan error:', err)
    }
  }, SCAN_DEBOUNCE_MS)
}

// 优化：进程名已在 scanner 中获取，只需添加登记信息
function enrichPortInfo(ports) {
  return ports.map(port => {
    const registered = registeredPorts.find(r => r.port === port.port)
    return {
      ...port,
      registered: !!registered,
      projectName: registered?.projectName || '',
      remark: registered?.remark || '',
      conflict: registered && port.processName !== 'Unknown'
    }
  })
}

function setupIPC() {
  ipcMain.handle('port:scan', async () => {
    try {
      const ports = await scanPorts()
      return enrichPortInfo(ports)
    } catch (err) {
      return []
    }
  })

  ipcMain.handle('port:kill', async (event, pid) => {
    // 验证 PID 必须为正整数
    if (!Number.isInteger(pid) || pid <= 0) {
      return { success: false, message: '无效的 PID' }
    }
    return await killProcess(pid)
  })

  ipcMain.handle('port:closeAll', async () => {
    try {
      const ports = await scanPorts()
      const uniquePids = [...new Set(ports.map(p => p.pid))]
      const results = []
      for (const pid of uniquePids) {
        const result = await killProcess(pid)
        results.push({ pid, ...result })
      }
      return { success: true, results }
    } catch (err) {
      return { success: false, message: err.message }
    }
  })

  ipcMain.handle('port:register', async (event, info) => {
    // 验证端口号：必须为 1-65535 范围内的整数
    if (!Number.isInteger(info.port) || info.port < 1 || info.port > 65535) {
      return { success: false, message: '端口号必须在 1-65535 之间' }
    }
    // 验证项目名称：必填且长度合理
    if (!info.projectName || typeof info.projectName !== 'string' || info.projectName.trim().length === 0) {
      return { success: false, message: '项目名称不能为空' }
    }
    if (info.projectName.length > 100) {
      return { success: false, message: '项目名称过长' }
    }
    // 备注长度限制
    if (info.remark && info.remark.length > 500) {
      return { success: false, message: '备注过长' }
    }

    const existing = registeredPorts.find(p => p.port === info.port)
    if (existing) {
      existing.projectName = info.projectName.trim()
      existing.remark = (info.remark || '').trim()
      existing.registeredAt = new Date().toISOString()
    } else {
      registeredPorts.push({
        port: info.port,
        projectName: info.projectName.trim(),
        remark: (info.remark || '').trim(),
        registeredAt: new Date().toISOString()
      })
    }
    saveRegisteredPorts(registeredPorts)
    return { success: true }
  })

  ipcMain.handle('port:unregister', async (event, port) => {
    // 验证端口号
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { success: false, message: '无效的端口号' }
    }
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
    try {
      // 验证扫描间隔：500-60000 毫秒
      if (newSettings.scanInterval !== undefined) {
        const interval = Number(newSettings.scanInterval)
        if (!Number.isInteger(interval) || interval < 500 || interval > 60000) {
          return { success: false, message: '扫描间隔必须在 500-60000 毫秒之间' }
        }
        settings.scanInterval = interval
      }
      saveSettings(settings)
      // 清除之前的防抖定时器
      if (scanDebounceTimer) {
        clearTimeout(scanDebounceTimer)
        scanDebounceTimer = null
      }
      if (scanIntervalId) {
        clearInterval(scanIntervalId)
        scanIntervalId = setInterval(() => doScan(), settings.scanInterval)
      }
      return { success: true }
    } catch (err) {
      console.error('Settings save error:', err)
      return { success: false, message: err.message }
    }
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
