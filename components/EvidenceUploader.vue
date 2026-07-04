<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  currentDate: { type: String, required: true }
})

const supabase = useSupabaseClient()
const fileInput = ref(null)
const isUploading = ref(false)
const uploadProgress = ref(0)
const evidenceList = ref([])

// 載入當日已存在的證據
const fetchEvidence = async () => {
  const { data } = await supabase
    .from('evidence_logs')
    .select('*')
    .eq('log_date', props.currentDate)
  if (data) evidenceList.value = data
}

onMounted(() => {
  fetchEvidence()
})

const handleBatchUpload = async () => {
  const files = fileInput.value?.files
  if (!files || files.length === 0) return

  isUploading.value = true
  uploadProgress.value = 10

  const formData = new FormData()
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i])
  }

  try {
    uploadProgress.value = 50
    const response = await $fetch('/api/upload-evidence', {
      method: 'POST',
      body: formData
    })

    if (response.success) {
      uploadProgress.value = 80
      const insertData = response.results
        .filter(r => r.status === 'success')
        .map(r => ({
          log_date: props.currentDate,
          title: r.fileName.split('.')[0],
          telegram_url: r.telegramUrl,
          file_name: r.fileName
        }))

      if (insertData.length > 0) {
        const { data, error } = await supabase
          .from('evidence_logs')
          .insert(insertData)
          .select()

        if (!error && data) {
          evidenceList.value.push(...data)
          alert(`成功上傳 ${insertData.length} 筆錄音證據！`)
        }
      }
    }
  } catch (err) {
    alert('批次上傳發生錯誤')
    console.error(err)
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
    fileInput.value.value = ''
  }
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
      <span v-if="!isUploading">＋ 點擊選取手機錄音檔 (可批次多選)</span>
      <span v-else>正在加密上傳中 ({{ uploadProgress }}%)...</span>
    </button>

    <ul class="space-y-2">
      <li v-for="item in evidenceList" :key="item.id" class="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
        <span class="text-sm font-medium text-gray-800 truncate pr-2 flex-1">{{ item.title }}</span>
        <a :href="item.telegram_url" target="_blank" class="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300 whitespace-nowrap">
          開啟 TG 存證
        </a>
      </li>
    </ul>
    <p v-if="evidenceList.length === 0" class="text-xs text-gray-400 text-center py-2">本日尚無附加錄音證據</p>
  </div>
</template>