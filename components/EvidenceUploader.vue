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

// 串接 Hugging Face FastAPI 後端進行上傳
const handleBatchUpload = async () => {
  const files = fileInput.value?.files
  if (!files || files.length === 0) return

  isUploading.value = true
  let successCount = 0

  try {
    const hfApiUrl = config.public.hfApiUrl
    if (!hfApiUrl) throw new Error('尚未設定 Hugging Face API 網址')

    // 針對每一個檔案，傳送給 Hugging Face 後端
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      const formData = new FormData()
      formData.append('file', file)
      // FastAPI 後端強制要求 topic_id，這裡以當前月份作為主題 ID，或根據您的群組設定帶入預設值 0
      formData.append('topic_id', new Date(props.currentDate).getMonth() + 1)

      uploadProgress.value = 10 + Math.floor((i / files.length) * 80)

      // 呼叫 Hugging Face 的 /upload/ 端點
      const response = await fetch(`${hfApiUrl}/upload/`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || '伺服器發生錯誤')
      }

      const result = await response.json()

      // 成功後，將 Hugging Face 回傳的資料 (包含 SHA256 防偽指紋與連結) 存入 Supabase
      if (result.success) {
        const { error } = await supabase.from('evidence_logs').insert({
          log_date: props.currentDate,
          title: result.filename.split('.')[0] || '錄音檔',
          telegram_url: result.telegram_link,
          file_name: result.filename,
          // 若您的資料表有擴充，可以把 result.file_hash 也存起來作為法律證據
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
    alert('上傳發生錯誤：' + err.message)
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