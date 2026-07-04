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

const handleBatchUpload = async () => {
  const files = fileInput.value?.files
  if (!files || files.length === 0) return

  isUploading.value = true
  let successCount = 0

  try {
    // 1. 安全處理 API 網址，自動去除結尾多餘的斜線
    let rawApiUrl = config.public.hfApiUrl
    if (!rawApiUrl) {
      throw new Error('未抓取到環境變數 NUXT_PUBLIC_HF_API_URL，請檢查 .env 或 Vercel 後台設定')
    }
    const hfApiUrl = rawApiUrl.replace(/\/$/, '') 
    
    // 印出實際呼叫的網址，方便在 F12 控制台中除錯
    console.log('準備傳送至 Hugging Face:', `${hfApiUrl}/upload/`)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const formData = new FormData()
      formData.append('file', file)
      formData.append('topic_id', new Date(props.currentDate).getMonth() + 1)

      uploadProgress.value = 10 + Math.floor((i / files.length) * 80)

      const response = await fetch(`${hfApiUrl}/upload/`, {
        method: 'POST',
        body: formData
      })

      // 2. 防禦性解析：先用 text() 讀取，不要直接用 json()
      const responseText = await response.text()

      if (!response.ok) {
        console.error('伺服器錯誤內容:', responseText)
        try {
          // 嘗試解析是不是預期的 JSON 錯誤訊息
          const errData = JSON.parse(responseText)
          throw new Error(errData.detail || '伺服器拒絕請求')
        } catch (e) {
          // 如果解析 JSON 失敗 (代表是 HTML 網頁)，就報出這段話
          throw new Error(`伺服器回傳了非 API 資料 (Status: ${response.status})。可能是網址錯誤或 HF 正在休眠。`)
        }
      }

      // 如果順利走到這裡，代表一定是合法的 JSON 了
      const result = JSON.parse(responseText)

      if (result.success) {
        const { error } = await supabase.from('evidence_logs').insert({
          log_date: props.currentDate,
          title: result.filename.split('.')[0] || '錄音檔',
          telegram_url: result.telegram_link,
          file_name: result.filename
        })
        if (!error) successCount++
      }
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