<script setup>
import { ref, watch, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRoute } from 'vue-router'

const supabase = useSupabaseClient()
const route = useRoute()

// 1. 日期初始化邏輯
// 優先檢查網址是否有帶日期參數 (例如從 history 頁面點過來)，若無則預設為今天
const today = new Date().toISOString().split('T')[0]
const currentDate = ref(route.query.date || today)

const content = ref('')
const isSaving = ref(false)
const lastSavedTime = ref(null)

// 2. 載入指定日期的日誌
const fetchLog = async () => {
  // 切換日期時，先清空畫面上的暫存資料
  content.value = ''
  lastSavedTime.value = null

  const { data, error } = await supabase
    .from('counseling_logs')
    .select('content')
    .eq('record_date', currentDate.value)
    .single()
    
  if (data) {
    content.value = data.content
  }
}

// 初次進入頁面時載入
onMounted(() => {
  fetchLog()
})

// 監聽路由變化：確保從日曆點擊其他日期時，即使畫面沒重新整理也能更新資料
watch(() => route.query.date, (newDate) => {
  if (newDate) {
    currentDate.value = newDate
    fetchLog()
  }
})

// 3. 自動存檔邏輯 (Upsert: 根據日期，有就更新，沒有就新增)
const saveToSupabase = async (newContent) => {
  // 避免空值錯誤
  if (newContent === null || newContent === undefined) return

  isSaving.value = true
  
  await supabase.from('counseling_logs').upsert({ 
    record_date: currentDate.value,
    content: newContent,
    updated_at: new Date().toISOString()
  }, { onConflict: 'record_date' })
  
  isSaving.value = false
  lastSavedTime.value = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

// 採用 VueUse 防抖：使用者停止打字或語音聽寫 1.5 秒後，才觸發資料庫存檔
const autoSave = useDebounceFn((newVal) => {
  saveToSupabase(newVal)
}, 1500)

// 監聽文字框的內容變化
watch(content, (newVal) => {
  autoSave(newVal)
})

// 4. 一鍵複製功能
const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(content.value)
    alert('✅ 文字已複製！可前往學校輔導系統貼上。')
  } catch (err) {
    console.error('複製失敗', err)
    alert('複製失敗，請手動全選複製。')
  }
}
</script>

<template>
  <div class="flex flex-col min-h-[100dvh] p-4 max-w-2xl mx-auto bg-gray-100">
    
    <div class="flex justify-between items-end mb-4 px-1">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 tracking-wide mb-1">教學日誌與歸檔</h1>
        <div class="flex items-center gap-3">
          <input 
            type="date" 
            v-model="currentDate" 
            @change="fetchLog" 
            class="bg-transparent text-sm text-gray-600 font-medium focus:outline-none border-b border-gray-300 pb-1 cursor-pointer" 
          />
          
          <NuxtLink 
            to="/history" 
            class="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold shadow-sm active:bg-blue-200 transition-colors"
          >
            📅 歷史日曆
          </NuxtLink>
        </div>
      </div>
      
      <span class="text-xs font-medium text-gray-400 mb-1">
        {{ isSaving ? '儲存中...' : (lastSavedTime ? `${lastSavedTime} 已儲存` : '') }}
      </span>
    </div>

    <textarea 
      v-model="content" 
      class="flex-none h-64 p-4 border rounded-2xl text-[16px] leading-relaxed resize-none shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      placeholder="點擊此處，使用手機鍵盤上的麥克風開始口述當日狀況..."
    ></textarea>
    
    <div class="mt-3 mb-2">
      <button 
        @click="copyContent" 
        class="w-full py-3.5 bg-gray-800 text-white rounded-xl font-bold shadow-md active:bg-gray-700 transition-colors flex justify-center items-center gap-2"
      >
        <span>📋</span> 一鍵複製文字內容
      </button>
    </div>

    <EvidenceUploader :currentDate="currentDate" :key="currentDate" />
    
  </div>
</template>

<style scoped>
/* 避免 iOS Safari 在點擊輸入框時畫面自動放大亂跳，強制設定 16px */
input[type="date"], textarea {
  font-size: 16px !important;
}
</style>