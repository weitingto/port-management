const { exec } = require('child_process')

/**
 * 根据 PID 查杀进程
 * @param {number} pid
 * @returns {Promise<{success: boolean, message: string}>}
 */
function killProcess(pid) {
  return new Promise((resolve) => {
    // 验证 PID：必须为正整数
    if (!Number.isInteger(pid) || pid <= 0) {
      resolve({
        success: false,
        message: '无效的 PID'
      })
      return
    }

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
