<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  currentDate: { type: String, required: true }
})

const supabase = useSupabaseClient()
const config = useRuntimeConfig()
const fileInput = ref(null)
const isUploading = ref(false)
const uploadProgress = ref(0)
const evidenceList = ref([])

const fetchEvidence = async () => {
  const { data } = await supabase
    .from('evidence_logs')
    .select('*')
    .eq('log_date', props.currentDate)
  if (data) evidenceList.value = data
}

onMounted(() => { fetchEvidence() })

// 🌟 新增：格式化時間函數 (將時間戳轉換為 YYYY-MM-DD_HHmm)
const formatRecordingTime = (timestamp) => {
  const d = new Date(timestamp)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}

const handleBatchUpload = async () => {
  const files = fileInput.value?.files
  if (!files || files.length === 0) return

  isUploading.value = true
  uploadProgress.value = 0
  let successCount = 0

  try {
    let rawApiUrl = config.public.hfApiUrl
    if (!rawApiUrl) throw new Error('未設定 Hugging Face API 網址')
    const hfApiUrl = rawApiUrl.replace(/\/$/, '')

    // 計算每個檔案佔總進度的比例 (例如 2 個檔案，每個佔 50%)
    const sharePerFile = 100 / files.length

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // 🌟 核心優化 1：取得檔案的「真實錄音時間」並重組檔名
      // 這樣即使是三天前錄的音，檔名也會精準標示三天的日期與時間
      const recordTime = formatRecordingTime(file.lastModified)
      const newFilename = `${recordTime}_${file.name}`

      const formData = new FormData()
      // 透過第三個參數，強制把重新命名的檔名傳給後端
      formData.append('file', file, newFilename)
      formData.append('topic_id', new Date(props.currentDate).getMonth() + 1)

      // 🌟 核心優化 2：改用 XHR 追蹤真實的逐 Byte 上傳進度
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${hfApiUrl}/upload/`)

        // 監聽上傳進度事件
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const currentFileProgress = (e.loaded / e.total) * sharePerFile
            uploadProgress.value = Math.floor((i * sharePerFile) + currentFileProgress)
          }
        }

        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText)
              if (result.success) {
                // 存入 Supabase，標題也同步使用帶有日期的檔名
                const { error } = await supabase.from('evidence_logs').insert({
                  log_date: props.currentDate,
                  title: newFilename.split('.')[0], 
                  telegram_url: result.telegram_link,
                  file_name: newFilename
                })
                if (!error) successCount++
                resolve()
              } else {
                reject(new Error('伺服器處理失敗'))
              }
            } catch (err) {
              reject(new Error('伺服器回傳格式錯誤 (非 JSON)'))
            }
          } else {
            // 嘗試解析錯誤訊息
            let errorMsg = `狀態碼 ${xhr.status}`
            try {
              const errData = JSON.parse(xhr.responseText)
              if (errData.detail) errorMsg = errData.detail
            } catch (e) {
               // 忽略 HTML 解析錯誤
            }
            reject(new Error(`伺服器錯誤: ${errorMsg}`))
          }
        }

        xhr.onerror = () => reject(new Error('網路連線中斷'))
        xhr.send(formData)
      })
    }

    if (successCount > 0) {
      alert(`✅ 成功上傳 ${successCount} 筆證據！`)
      fetchEvidence()
    } else {
      alert('上傳失敗，請檢查網路連線。')
    }

  } catch (err) {
    alert('上傳發生錯誤：\n' + err.message)
    console.error(err)
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
    fileInput.value.value = ''
  }
}

const deleteEvidence = async (id) => {
  if (!confirm('⚠️ 確定要刪除這筆錄音證據的連結嗎？')) return
  const { error } = await supabase.from('evidence_logs').delete().eq('id', id)
  if (!error) evidenceList.value = evidenceList.value.filter(item => item.id !== id)
}
</script>

<template>
  <div class="mt-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
    <div class="flex justify-between items-center mb-3">
      <h2 class="text-md font-bold text-gray-800 flex items-center gap-2">
        <span>🎙️</span> 語音證據清單
      </h2>
    </div>

    <!-- 隱藏的輸入框 -->
    <input ref="fileInput" type="file" multiple accept="audio/*,video/mp4" class="hidden" @change="handleBatchUpload" />

    <!-- 批次上傳按鈕 -->
    <button 
      @click="$refs.fileInput.click()"
      :disabled="isUploading"
      class="w-full py-3 mb-4 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 font-medium hover:bg-blue-50 active:bg-blue-100 transition-colors"
    >
      <span v-if="!isUploading">＋ 點擊選取手機錄音補傳 (可批次多選)</span>
      <span v-else>正在加密上傳中 ({{ uploadProgress }}%)...</span>
    </button>

    <!-- 證據列表 -->
    <ul class="space-y-2">
      <li v-for="item in evidenceList" :key="item.id" class="flex flex-col bg-gray-50 p-3 rounded-lg border gap-2">
        <span class="text-sm font-medium text-gray-800 truncate">{{ item.title }}</span>
        
        <div class="flex justify-end gap-2">
          <button @click="deleteEvidence(item.id)" class="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200">
            刪除
          </button>
          <a :href="item.telegram_url" target="_blank" class="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300 whitespace-nowrap">
            開啟 TG 聽取
          </a>
        </div>
      </li>
    </ul>
    <p v-if="evidenceList.length === 0" class="text-xs text-gray-400 text-center py-2">本日尚無附加錄音證據</p>
  </div>
</template>