<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const supabase = useSupabaseClient()
const router = useRouter()

// 控制當前顯示的年月
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth()) // 0-11
const recordedDates = ref(new Set()) // 儲存有紀錄的日期字串 (YYYY-MM-DD)
const isLoading = ref(false)

// 取得當月天數與空白佔位符，用於產生網格日曆
const calendarDays = computed(() => {
  const days = []
  const firstDay = new Date(currentYear.value, currentMonth.value, 1).getDay()
  const totalDays = new Date(currentYear.value, currentMonth.value + 1, 0).getDate()

  // 填補月初的空白
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  // 填補實際日期
  for (let i = 1; i <= totalDays; i++) {
    const dateStr = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    days.push({
      day: i,
      date: dateStr,
      hasRecord: recordedDates.value.has(dateStr)
    })
  }
  return days
})

// 從 Supabase 撈取當月有紀錄的日期
const fetchMonthlyRecords = async () => {
  isLoading.value = true
  const startDate = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-01`
  const endDate = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-31`

  // 查詢這個月內有建立過日誌的日期
  const { data } = await supabase
    .from('counseling_logs')
    .select('record_date')
    .gte('record_date', startDate)
    .lte('record_date', endDate)

  recordedDates.value.clear()
  if (data) {
    data.forEach(log => recordedDates.value.add(log.record_date))
  }
  isLoading.value = false
}

// 切換月份
const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}
const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

// 監聽月份變化，重新抓取資料
watch([currentYear, currentMonth], () => {
  fetchMonthlyRecords()
})

onMounted(() => {
  fetchMonthlyRecords()
})

// 點擊日期，跳轉至首頁並帶入日期參數
const goToDate = (dateStr) => {
  router.push({ path: '/', query: { date: dateStr } })
}
</script>

<template>
  <div class="flex flex-col min-h-[100dvh] p-4 max-w-2xl mx-auto bg-gray-50">
    
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800 tracking-wide">歷史紀錄日曆</h1>
      <NuxtLink to="/" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium shadow-sm active:bg-gray-300">
        返回今日
      </NuxtLink>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border p-4 mb-4">
      <div class="flex justify-between items-center mb-4">
        <button @click="prevMonth" class="p-2 bg-gray-100 rounded-lg active:bg-gray-200">⬅️ 上個月</button>
        <h2 class="text-lg font-bold text-gray-800">{{ currentYear }} 年 {{ currentMonth + 1 }} 月</h2>
        <button @click="nextMonth" class="p-2 bg-gray-100 rounded-lg active:bg-gray-200">下個月 ➡️</button>
      </div>

      <div class="grid grid-cols-7 gap-2 text-center text-sm font-semibold text-gray-500 mb-2">
        <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
      </div>

      <div class="grid grid-cols-7 gap-2">
        <div v-for="(item, index) in calendarDays" :key="index" class="aspect-square">
          <button 
            v-if="item" 
            @click="goToDate(item.date)"
            class="w-full h-full flex flex-col justify-center items-center rounded-xl border relative transition-colors"
            :class="item.hasRecord ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' : 'bg-white border-gray-100 hover:bg-gray-50'"
          >
            <span class="text-lg font-medium" :class="item.hasRecord ? 'text-blue-700' : 'text-gray-600'">
              {{ item.day }}
            </span>
            <span v-if="item.hasRecord" class="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1"></span>
          </button>
        </div>
      </div>
    </div>
    
  </div>
</template>