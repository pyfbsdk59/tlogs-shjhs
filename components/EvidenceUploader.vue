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

const formatRecordingTime = (timestamp) => {
  const d = new Date(timestamp)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}

// 🌟 新增：專門用來產生乾淨下載網址的函數 (避開 Vue 模板編譯錯誤)
const getDownloadUrl = (messageId) => {
  if (!config.public.hfApiUrl) return '#'
  
  // 使用安全的字串方法 (endsWith 與 slice) 取代正規表達式
  const baseUrl = config.public.hfApiUrl.endsWith('/') 
    ? config.public.hfApiUrl.slice(0, -1) 
    : config.public.hfApiUrl
    
  return `${baseUrl}/download/${messageId}`
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
    
    // 在 script 區塊使用正規表達式是絕對安全的
    const hfApiUrl = rawApiUrl.replace(/\/$/, '')

    const sharePerFile = 100 / files.length

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const recordTime = formatRecordingTime(file.lastModified)
      const newFilename = `${recordTime}_${file.name}`

      const formData = new FormData()
      formData.append('file', file, newFilename)
      formData.append('topic_id', new Date(props.currentDate).getMonth() + 1)

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${hfApiUrl}/upload/`)

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
                const { error } = await supabase.from('evidence_logs').insert({
                  log_date: props.currentDate,
                  title: newFilename.split('.')[0], 
                  telegram_url: result.telegram_link,
                  file_name: newFilename,
                  message_id: result.message_id 
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
            let errorMsg = `狀態碼 ${xhr.status}`
            try {
              const errData = JSON.parse(xhr.responseText)
              if (errData.detail) errorMsg = errData.detail
            } catch (e) {}
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

    <input ref="fileInput" type="file" multiple accept="audio/*,video/mp4" class="hidden" @change="handleBatchUpload" />

    <button 
      @click="$refs.fileInput.click()"
      :disabled="isUploading"
      class="w-full py-3 mb-4 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 font-medium hover:bg-blue-50 active:bg-blue-100 transition-colors"
    >
      <span v-if="!isUploading">＋ 點擊選取手機錄音補傳 (可批次多選)</span>
      <span v-else>正在加密上傳中 ({{ uploadProgress }}%)...</span>
    </button>

    <ul class="space-y-3">
      <li v-for="item in evidenceList" :key="item.id" class="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-200 gap-3">
        <span class="text-sm font-bold text-gray-800 break-all">{{ item.title }}</span>
        
        <div class="flex flex-wrap gap-2">
          
          <a 
            v-if="item.message_id"
            :href="getDownloadUrl(item.message_id)" 
            target="_blank" 
            class="flex-1 text-center px-2 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 shadow-sm whitespace-nowrap"
          >
            ▶️ 立即串流下載🔗
          </a>

          <a 
            :href="item.telegram_url" 
            target="_blank" 
            class="flex-1 text-center px-2 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 shadow-sm whitespace-nowrap"
          >
            ✈️ TG 原文
          </a>

          <button 
            @click="deleteEvidence(item.id)" 
            class="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 shadow-sm whitespace-nowrap"
          >
            🗑️ 刪除
          </button>
          
        </div>
      </li>
    </ul>
    
    <p v-if="evidenceList.length === 0" class="text-xs text-gray-400 text-center py-2">本日尚無附加錄音證據</p>
  </div>
</template>