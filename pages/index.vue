<script setup>
import { ref, watch, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'

const supabase = useSupabaseClient()

const content = ref('')
const isSaving = ref(false)
const lastSavedTime = ref(null)

// 產生這次輸入專屬的 ID (重新整理就會產生新的，確保每次都是新紀錄)
const sessionId = ref('')
const today = new Date().toISOString().split('T')[0]

onMounted(() => {
  // 網頁載入時，發配一個全新的 UUID 給這次的紀錄
  sessionId.value = crypto.randomUUID()
})

// 自動存檔邏輯 (針對目前的 sessionId 進行更新)
const saveToSupabase = async (newContent) => {
  if (!newContent || !newContent.trim()) return

  isSaving.value = true
  
  await supabase.from('counseling_logs').upsert({ 
    id: sessionId.value, // 指定 ID，確保打字停頓時是更新同一筆，而不是一直新增
    record_date: today,
    content: newContent,
    updated_at: new Date().toISOString()
  })
  
  isSaving.value = false
  lastSavedTime.value = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

// 防抖：停止語音聽寫 1.5 秒後自動存檔
const autoSave = useDebounceFn((newVal) => {
  saveToSupabase(newVal)
}, 1500)

watch(content, (newVal) => {
  autoSave(newVal)
})

const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(content.value)
    alert('✅ 文字已複製！')
  } catch (err) {
    console.error('複製失敗', err)
  }
}

// 寫完一筆，想要立刻寫下一筆的按鈕
const startNewRecord = () => {
  content.value = ''
  sessionId.value = crypto.randomUUID() // 重新發配新 ID
  lastSavedTime.value = null
}
</script>

<template>
  <div class="flex flex-col min-h-[100dvh] p-4 max-w-2xl mx-auto bg-gray-100">
    
    <div class="flex justify-between items-end mb-4 px-1">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 tracking-wide mb-1">新增輔導日誌</h1>
        <NuxtLink to="/history" class="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold shadow-sm active:bg-blue-200">
          📂 前往歷史紀錄
        </NuxtLink>
      </div>
      <span class="text-xs font-medium text-gray-400 mb-1">
        {{ isSaving ? '儲存中...' : (lastSavedTime ? `${lastSavedTime} 已存檔` : '') }}
      </span>
    </div>

    <textarea 
      v-model="content" 
      class="flex-none h-56 p-4 border rounded-2xl text-[16px] leading-relaxed resize-none shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      placeholder="點擊此處，用手機鍵盤麥克風口述新事件..."
    ></textarea>
    
    <div class="mt-3 mb-2 flex gap-2">
      <button @click="startNewRecord" class="px-4 py-3 bg-gray-300 text-gray-700 rounded-xl font-bold active:bg-gray-400">
        新增下一筆
      </button>
      <button @click="copyContent" class="flex-1 py-3 bg-gray-800 text-white rounded-xl font-bold shadow-md active:bg-gray-700">
        複製文字內容
      </button>
    </div>

    <EvidenceUploader :currentDate="today" />
    
  </div>
</template>