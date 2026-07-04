<script setup>
import { ref, watch, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'

const supabase = useSupabaseClient()
const content = ref('')
const isSaving = ref(false)
const lastSavedTime = ref(null)

// 取得今天日期 (YYYY-MM-DD)
const today = new Date().toISOString().split('T')[0]
const currentDate = ref(today)

// 載入今日的文字日誌
const fetchLog = async () => {
  const { data, error } = await supabase
    .from('counseling_logs')
    .select('content')
    .eq('record_date', currentDate.value)
    .single()
    
  if (data) content.value = data.content
}

onMounted(() => {
  fetchLog()
})

// 自動存檔邏輯 (Upsert: 有就更新，沒有就新增)
const saveToSupabase = async (newContent) => {
  isSaving.value = true
  
  await supabase.from('counseling_logs').upsert({ 
    record_date: currentDate.value,
    content: newContent,
    updated_at: new Date().toISOString()
  }, { onConflict: 'record_date' })
  
  isSaving.value = false
  lastSavedTime.value = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

// 防抖：停止打字/語音輸入 1.5 秒後自動存檔
const autoSave = useDebounceFn((newVal) => {
  saveToSupabase(newVal)
}, 1500)

watch(content, (newVal) => {
  autoSave(newVal)
})

const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(content.value)
    alert('文字已複製！')
  } catch (err) {
    console.error('複製失敗', err)
  }
}
</script>

<template>
  <div class="flex flex-col min-h-[100dvh] p-4 max-w-2xl mx-auto bg-gray-100">
    
    <div class="flex justify-between items-end mb-4 px-1">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 tracking-wide">日誌與證據歸檔</h1>
        <input type="date" v-model="currentDate" @change="fetchLog" class="mt-1 bg-transparent text-sm text-gray-500 font-medium focus:outline-none" />
      </div>
      <span class="text-xs font-medium text-gray-400">
        {{ isSaving ? '儲存中...' : (lastSavedTime ? `${lastSavedTime} 已儲存` : '') }}
      </span>
    </div>

    <textarea 
      v-model="content" 
      class="flex-none h-64 p-4 border rounded-2xl text-[16px] leading-relaxed resize-none shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      placeholder="點擊此處，使用手機鍵盤上的麥克風開始口述當日狀況..."
    ></textarea>
    
    <div class="mt-3">
      <button @click="copyContent" class="w-full py-3 bg-gray-800 text-white rounded-xl font-bold shadow active:bg-gray-700 transition-colors">
        一鍵複製文字內容
      </button>
    </div>

    <EvidenceUploader :currentDate="currentDate" />
    
  </div>
</template>

<style scoped>
/* 避免 iOS Safari 在輸入時畫面亂跳 */
input, textarea {
  font-size: 16px !important;
}
</style>