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
