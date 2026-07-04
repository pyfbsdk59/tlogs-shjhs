<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const supabase = useSupabaseClient()

const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth())
const recordedDates = ref(new Set()) 

const selectedDate = ref(null) // 使用者點選的日期
const dayLogs = ref([]) // 當天的文字紀錄陣列
const dayEvidences = ref([]) // 當天的錄音證據陣列

// (保留之前的 calendarDays 與切換月份邏輯)
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

// --- 新增：點擊日曆讀取當日詳細資料 ---
const loadDayDetails = async (dateStr) => {
  selectedDate.value = dateStr
  
  // 抓取當天所有文字日誌 (依時間排序)
  const { data: logsData } = await supabase
    .from('counseling_logs')
    .select('*')
    .eq('record_date', dateStr)
    .order('updated_at', { ascending: true })
    
  // 抓取當天所有錄音證據
  const { data: evidenceData } = await supabase
    .from('evidence_logs')
    .select('*')
    .eq('log_date', dateStr)

  dayLogs.value = logsData || []
  dayEvidences.value = evidenceData || []
}

// 格式化時間
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
      
      <div v-for="(log, idx) in dayLogs" :key="log.id" class="bg-white p-4 rounded-xl shadow-sm border">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-bold text-gray-500">紀錄 #{{ idx + 1 }}</span>
          <span class="text-xs text-gray-400">{{ formatTime(log.updated_at) }}</span>
        </div>
        <p class="text-gray-800 whitespace-pre-wrap">{{ log.content }}</p>
      </div>
      <p v-if="dayLogs.length === 0" class="text-gray-500 text-center py-4">本日無文字紀錄</p>

      <div v-if="dayEvidences.length > 0" class="bg-red-50 p-4 rounded-xl border border-red-100 mt-4">
        <h4 class="text-sm font-bold text-red-700 mb-3">🎙️ 當日附加檔案 ({{ dayEvidences.length }}筆)</h4>
        <ul class="space-y-2">
          <li v-for="item in dayEvidences" :key="item.id" class="flex justify-between items-center bg-white p-2 rounded-lg border">
            <span class="text-sm text-gray-800 truncate pr-2">{{ item.title }}</span>
            <a :href="item.telegram_url" target="_blank" class="px-3 py-1 bg-gray-200 rounded text-xs font-bold hover:bg-gray-300">
              開啟 TG 聽取
            </a>
          </li>
        </ul>
      </div>
    </div>
    
  </div>
</template>