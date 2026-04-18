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
          <el-button type="danger" @click="handleCloseAll" :disabled="ports.length === 0">
            关闭全部
          </el-button>
          <el-input
            v-model="searchQuery"
            placeholder="搜索端口或进程..."
            style="width: 200px;"
            clearable
          />
        </div>
      </div>

      <div class="port-table-container">
        <el-collapse v-model="activeCollapse" class="port-collapse">
          <!-- 知名端口 -->
          <el-collapse-item name="wellKnown" v-if="wellKnownPorts.length > 0">
            <template #title>
              <div class="collapse-title">
                <span>知名端口</span>
                <el-tag type="danger" size="small">0-1023</el-tag>
                <span class="collapse-count">{{ wellKnownPorts.length }} 个</span>
              </div>
            </template>
            <el-table :data="wellKnownPorts" stripe size="small">
              <el-table-column prop="port" label="端口" width="100" sortable />
              <el-table-column label="进程名" min-width="180">
                <template #default="{ row }">
                  <span>{{ row.processName }}</span>
                  <span v-if="row.projectName" class="project-tag">{{ row.projectName }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="pid" label="PID" width="100" sortable />
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <span class="status-tag">
                    <template v-if="row.conflict">
                      <el-tag type="danger" size="small">冲突</el-tag>
                    </template>
                    <template v-else-if="row.registered">
                      <el-tag type="success" size="small">已登记</el-tag>
                    </template>
                    <template v-else>
                      <el-tag type="info" size="small">未管理</el-tag>
                    </template>
                    <span v-if="row.state === 'ESTABLISHED'" class="established-dot"></span>
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button type="danger" size="small" @click="handleClose(row)">关闭</el-button>
                  <el-button v-if="!row.registered" type="primary" size="small" @click="quickRegister(row)">登记</el-button>
                  <el-button v-else type="default" size="small" @click="handleUnregister(row)">取消登记</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>

          <!-- 注册端口 -->
          <el-collapse-item name="registered" v-if="registeredPorts.length > 0">
            <template #title>
              <div class="collapse-title">
                <span>注册端口</span>
                <el-tag type="warning" size="small">1024-49151</el-tag>
                <span class="collapse-count">{{ registeredPorts.length }} 个</span>
              </div>
            </template>
            <el-table :data="registeredPorts" stripe size="small">
              <el-table-column prop="port" label="端口" width="100" sortable />
              <el-table-column label="进程名" min-width="180">
                <template #default="{ row }">
                  <span>{{ row.processName }}</span>
                  <span v-if="row.projectName" class="project-tag">{{ row.projectName }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="pid" label="PID" width="100" sortable />
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <span class="status-tag">
                    <template v-if="row.conflict">
                      <el-tag type="danger" size="small">冲突</el-tag>
                    </template>
                    <template v-else-if="row.registered">
                      <el-tag type="success" size="small">已登记</el-tag>
                    </template>
                    <template v-else>
                      <el-tag type="info" size="small">未管理</el-tag>
                    </template>
                    <span v-if="row.state === 'ESTABLISHED'" class="established-dot"></span>
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button type="danger" size="small" @click="handleClose(row)">关闭</el-button>
                  <el-button v-if="!row.registered" type="primary" size="small" @click="quickRegister(row)">登记</el-button>
                  <el-button v-else type="default" size="small" @click="handleUnregister(row)">取消登记</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>

          <!-- 动态/私有端口 -->
          <el-collapse-item name="dynamic" v-if="dynamicPorts.length > 0">
            <template #title>
              <div class="collapse-title">
                <span>动态/私有端口</span>
                <el-tag type="info" size="small">49152-65535</el-tag>
                <span class="collapse-count">{{ dynamicPorts.length }} 个</span>
              </div>
            </template>
            <el-table :data="dynamicPorts" stripe size="small">
              <el-table-column prop="port" label="端口" width="100" sortable />
              <el-table-column label="进程名" min-width="180">
                <template #default="{ row }">
                  <span>{{ row.processName }}</span>
                  <span v-if="row.projectName" class="project-tag">{{ row.projectName }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="pid" label="PID" width="100" sortable />
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <span class="status-tag">
                    <template v-if="row.conflict">
                      <el-tag type="danger" size="small">冲突</el-tag>
                    </template>
                    <template v-else-if="row.registered">
                      <el-tag type="success" size="small">已登记</el-tag>
                    </template>
                    <template v-else>
                      <el-tag type="info" size="small">未管理</el-tag>
                    </template>
                    <span v-if="row.state === 'ESTABLISHED'" class="established-dot"></span>
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button type="danger" size="small" @click="handleClose(row)">关闭</el-button>
                  <el-button v-if="!row.registered" type="primary" size="small" @click="quickRegister(row)">登记</el-button>
                  <el-button v-else type="default" size="small" @click="handleUnregister(row)">取消登记</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>
        </el-collapse>
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
          <el-input-number
            v-model="settingsForm.scanInterval"
            :min="500"
            :max="60000"
            :step="500"
            style="width: 100%;"
          />
          <span style="margin-left: 8px; color: #999;">毫秒</span>
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
import { ref, computed, shallowRef, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 使用 shallowRef 避免深层响应式开销
const ports = shallowRef([])
const loading = ref(false)
const searchQuery = ref('')
const showRegisterDialog = ref(false)
const showSettingsDialog = ref(false)
const activeCollapse = ref(['registered'])

// 端口分类计算属性（预排序 + 缓存）
const sortedPorts = computed(() => {
  return [...ports.value].sort((a, b) => a.port - b.port)
})

const wellKnownPorts = computed(() => {
  return sortedPorts.value.filter(p => p.port >= 0 && p.port <= 1023)
})

const registeredPorts = computed(() => {
  return sortedPorts.value.filter(p => p.port >= 1024 && p.port <= 49151)
})

const dynamicPorts = computed(() => {
  return sortedPorts.value.filter(p => p.port >= 49152 && p.port <= 65535)
})

const registerForm = ref({
  port: null,
  projectName: '',
  remark: ''
})

const settingsForm = ref({
  scanInterval: 3000
})

const filteredPorts = computed(() => {
  if (!searchQuery.value) return sortedPorts.value
  const query = searchQuery.value.toLowerCase()
  return sortedPorts.value.filter(p =>
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

async function handleClose(row) {
  try {
    await ElMessageBox.confirm(
      `确定要关闭端口 ${row.port} (进程: ${row.processName}, PID: ${row.pid}) 吗？`,
      '确认关闭',
      { type: 'warning' }
    )
    const result = await window.electronAPI.killProcess(row.pid)
    if (result.success) {
      ElMessage.success('端口已关闭')
      await refreshPorts()
    } else {
      ElMessage.error(result.message)
    }
  } catch {
    // 用户取消
  }
}

async function handleCloseAll() {
  try {
    await ElMessageBox.confirm(
      '确定要关闭全部端口吗？\n将终止所有占用端口的进程，可能影响正在运行的服务。',
      '确认关闭全部端口',
      { type: 'warning' }
    )
    const result = await window.electronAPI.closeAllPorts()
    if (result.success) {
      ElMessage.success('已关闭全部端口')
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
    const result = await window.electronAPI.saveSettings(settingsForm.value)
    if (result.success) {
      ElMessage.success('设置已保存')
      showSettingsDialog.value = false
    } else {
      ElMessage.error(result.message || '保存设置失败')
    }
  } catch (err) {
    ElMessage.error('保存设置失败')
  }
}

onMounted(async () => {
  await refreshPorts()

  if (window.electronAPI?.getSettings) {
    const settings = await window.electronAPI.getSettings()
    settingsForm.value.scanInterval = settings.scanInterval || 3000

    window.electronAPI.onPortUpdate((data) => {
      ports.value = data
    })
  }
})
</script>

<style scoped>
.established-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  background-color: #67c23a;
  border-radius: 50%;
  margin-left: 8px;
  vertical-align: middle;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.4);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(103, 194, 58, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0);
  }
}

.port-collapse {
  height: 100%;
  overflow: auto;
}

.port-collapse :deep(.el-collapse-item__header) {
  background-color: #f5f7fa;
  padding: 0 16px;
}

.port-collapse :deep(.el-collapse-item__content) {
  padding: 0;
}

.port-collapse :deep(.el-table) {
  border: none;
}

.collapse-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.collapse-count {
  color: #909399;
  font-size: 12px;
  margin-left: auto;
}

.project-tag {
  margin-left: 8px;
  padding: 2px 6px;
  background-color: #e8f4ff;
  color: #409eff;
  border-radius: 4px;
  font-size: 12px;
}
</style>
