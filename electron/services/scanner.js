const { exec } = require('child_process')

// 进程名缓存（进程名不会频繁变化，整个生命周期内有效）
const processNameCache = new Map()

/**
 * 批量获取所有进程名（一次性查询，内存中匹配）
 * @returns {Promise<Map<number, string>>}
 */
function batchGetProcessNames() {
  return new Promise((resolve) => {
    exec('tasklist /FO CSV /NH', { encoding: 'utf8' }, (error, stdout) => {
      const pidToName = new Map()
      if (error || !stdout) {
        resolve(pidToName)
        return
      }
      const lines = stdout.split('\n')
      for (const line of lines) {
        // CSV格式: "imagename","pid","sessionname","session#","memusage"
        // 使用正则更可靠地解析，跳过格式不正确的行
        const match = line.match(/^"([^"]+)","(\d+)"/)
        if (match) {
          const name = match[1].trim()
          const pid = parseInt(match[2], 10)
          if (pid && name && name !== 'Image' && name !== 'System Idle Process') {
            pidToName.set(pid, name)
          }
        }
      }
      resolve(pidToName)
    })
  })
}

/**
 * 扫描本机端口占用情况
 * @returns {Promise<Array<{port: number, processName: string, pid: number, status: string}>>}
 */
async function scanPorts() {
  const netstatOutput = await new Promise((resolve, reject) => {
    exec('netstat -ano', { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        reject(error)
        return
      }
      resolve(stdout)
    })
  })

  const lines = netstatOutput.split('\n')
  const portMap = new Map()
  // 改进正则：更精确匹配 IPv4 地址，避免误匹配
  const regex = /TCP\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)\s+(\w+)\s+(\d+)/

  for (const line of lines) {
    const match = line.match(regex)
    if (match) {
      const localPort = parseInt(match[2], 10)
      const state = match[5]
      const pid = parseInt(match[6], 10)

      // 验证端口和 PID 有效性
      if (localPort > 0 && localPort <= 65535 && pid > 0 && (state === 'LISTENING' || state === 'ESTABLISHED')) {
        if (!portMap.has(localPort)) {
          portMap.set(localPort, { pid, state })
        } else {
          // 如果已有记录，优先保留 ESTABLISHED（活跃连接）
          const existing = portMap.get(localPort)
          if (state === 'ESTABLISHED' && existing.state !== 'ESTABLISHED') {
            portMap.set(localPort, { pid, state })
          }
        }
      }
    }
  }

  // 收集所有需要的 PID
  const uniquePids = [...new Set(Array.from(portMap.values()).map(({ pid }) => pid))]

  // 批量查询缺失的进程名
  const missingPids = uniquePids.filter(pid => !processNameCache.has(pid))
  if (missingPids.length > 0) {
    const newNames = await batchGetProcessNames()
    for (const [pid, name] of newNames) {
      processNameCache.set(pid, name)
    }
  }

  // 构建结果
  const ports = Array.from(portMap.entries()).map(([port, info]) => ({
    port,
    pid: info.pid,
    processName: processNameCache.get(info.pid) || 'Unknown',
    state: info.state,
    status: 'in_use'
  }))

  return ports
}

/**
 * 清除进程名缓存
 */
function clearCache() {
  processNameCache.clear()
}

module.exports = { scanPorts, clearCache }
