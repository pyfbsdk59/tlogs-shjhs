<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const supabase = useSupabaseClient()

const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth())
const recordedDates = ref(new Set()) 

const selectedDate = ref(null)
const dayLogs = ref([]) 

// 編輯狀態管理
const editingId = ref(null) // 記錄目前正在編輯哪一筆日誌的 ID
const editContent = ref('') // 暫存編輯中的文字

const calendarDays = computed(() => {
  const days = []
  const firstDay = new Date(currentYear.value, currentMonth.value, 1).getDay()
  const totalDays = new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= totalDays; i++) {
    const dateStr = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    days.push({ day: i, date: dateStr, hasRecord: recordedDates.value.has(dateStr) })
  }
  return days
})

const fetchMonthlyRecords = async () => {
  const startDate = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-01`
  const endDate = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-31`
  const { data } = await supabase.from('counseling_logs').select('record_date').gte('record_date', startDate).lte('record_date', endDate)
  recordedDates.value.clear()
  if (data) data.forEach(log => recordedDates.value.add(log.record_date))
}

const prevMonth = () => { currentMonth.value === 0 ? (currentMonth.value = 11, currentYear.value--) : currentMonth.value-- }
const nextMonth = () => { currentMonth.value === 11 ? (currentMonth.value = 0, currentYear.value++) : currentMonth.value++ }
watch([currentYear, currentMonth], fetchMonthlyRecords)
onMounted(fetchMonthlyRecords)

// 載入當日資料
const loadDayDetails = async (dateStr) => {
  selectedDate.value = dateStr
  editingId.value = null // 切換日期時清除編輯狀態
  
  const { data: logsData } = await supabase
    .from('counseling_logs')
    .select('*')
    .eq('record_date', dateStr)
    .order('updated_at', { ascending: true })

  dayLogs.value = logsData || []
}

// --- 日誌文字編輯與刪除功能 ---
const startEdit = (log) => {
  editingId.value = log.id
  editContent.value = log.content
}

const cancelEdit = () => {
  editingId.value = null
  editContent.value = ''
}

const saveEdit = async (logId) => {
  const { error } = await supabase
    .from('counseling_logs')
    .update({ 
      content: editContent.value,
      updated_at: new Date().toISOString()
    })
    .eq('id', logId)

  if (!error) {
    // 更新本地畫面
    const target = dayLogs.value.find(log => log.id === logId)
    if (target) target.content = editContent.value
    editingId.value = null // 退出編輯模式
  } else {
    alert('儲存失敗！')
  }
}

const deleteLog = async (logId) => {
  if (!confirm('⚠️ 確定要刪除這筆文字日誌嗎？刪除後無法復原。')) return

  const { error } = await supabase
    .from('counseling_logs')
    .delete()
    .eq('id', logId)

  if (!error) {
    // 從畫面陣列中移除
    dayLogs.value = dayLogs.value.filter(log => log.id !== logId)
    
    // 如果當天所有日誌都被刪光了，重新抓取日曆亮點
    if (dayLogs.value.length === 0) {
      fetchMonthlyRecords()
    }
  } else {
    alert('刪除失敗！')
  }
}

const formatTime = (isoString) => new Date(isoString).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="flex flex-col min-h-[100dvh] p-4 max-w-2xl mx-auto bg-gray-50 pb-20">
    
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800">歷史紀錄區</h1>
      <NuxtLink to="/" class="px-4 py-2 bg-gray-800 text-white rounded-lg font-medium shadow-sm">
        ＋ 新增紀錄
      </NuxtLink>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border p-4 mb-6">
      <div class="flex justify-between items-center mb-4">
        <button @click="prevMonth" class="p-2 bg-gray-100 rounded-lg">⬅️</button>
        <h2 class="text-lg font-bold text-gray-800">{{ currentYear }} 年 {{ currentMonth + 1 }} 月</h2>
        <button @click="nextMonth" class="p-2 bg-gray-100 rounded-lg">➡️</button>
      </div>
      <div class="grid grid-cols-7 gap-2 text-center text-sm font-semibold text-gray-500 mb-2">
        <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
      </div>
      <div class="grid grid-cols-7 gap-2">
        <div v-for="(item, index) in calendarDays" :key="index" class="aspect-square">
          <button 
            v-if="item" 
            @click="loadDayDetails(item.date)"
            class="w-full h-full flex flex-col justify-center items-center rounded-xl border relative transition-colors"
            :class="[
              selectedDate === item.date ? 'ring-2 ring-blue-500 bg-blue-100' : 
              item.hasRecord ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'
            ]"
          >
            <span class="text-lg font-medium" :class="item.hasRecord ? 'text-blue-700' : 'text-gray-600'">{{ item.day }}</span>
            <span v-if="item.hasRecord" class="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1"></span>
          </button>
        </div>
      </div>
    </div>
    
    <div v-if="selectedDate" class="space-y-4">
      <h3 class="text-xl font-bold text-gray-800 border-b pb-2">{{ selectedDate }} 的紀錄</h3>
      
      <div v-for="(log, idx) in dayLogs" :key="log.id" class="bg-white p-4 rounded-xl shadow-sm border relative">
        <div class="flex justify-between items-center mb-3">
          <span class="text-sm font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">紀錄 #{{ idx + 1 }}</span>
          <span class="text-xs text-gray-400">{{ formatTime(log.updated_at) }}</span>
        </div>

        <div v-if="editingId === log.id">
          <textarea 
            v-model="editContent" 
            class="w-full min-h-[120px] p-3 border-2 border-blue-300 rounded-lg text-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 bg-blue-50"
          ></textarea>
          <div class="flex justify-end gap-2">
            <button @click="cancelEdit" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium">取消</button>
            <button @click="saveEdit(log.id)" class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">儲存修改</button>
          </div>
        </div>

        <div v-else>
          <p class="text-gray-800 whitespace-pre-wrap leading-relaxed mb-4">{{ log.content }}</p>
          <div class="flex justify-end gap-2 border-t pt-3">
            <button @click="deleteLog(log.id)" class="px-3 py-1.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-md text-sm font-bold">
              刪除紀錄
            </button>
            <button @click="startEdit(log)" class="px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md text-sm font-bold">
              編輯文字
            </button>
          </div>
        </div>
      </div>

      <p v-if="dayLogs.length === 0" class="text-gray-500 text-center py-4 bg-white rounded-xl border border-dashed">本日尚無文字紀錄</p>

      <EvidenceUploader :currentDate="selectedDate" :key="selectedDate" />
      
    </div>
    
  </div>
</template>