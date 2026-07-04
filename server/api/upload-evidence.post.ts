export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  if (!formData) throw createError({ statusCode: 400, statusMessage: '沒有找到檔案' })

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID
  const results = []

  for (const field of formData) {
    if (field.name === 'files' && field.data) {
      const tgFormData = new FormData()
      const blob = new Blob([field.data], { type: field.type })
      
      tgFormData.append('chat_id', CHAT_ID as string)
      // 使用 sendDocument 確保支援所有手機錄音格式，且音質不被壓縮
      tgFormData.append('document', blob, field.filename)
      tgFormData.append('caption', `📅 證據歸檔：${field.filename}`)

      try {
        const tgResponse = await $fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
          method: 'POST',
          body: tgFormData
        })

        const messageId = tgResponse.result.message_id
        // 處理私密群組/頻道的 ID 格式轉為可點擊連結
        const rawChatId = tgResponse.result.chat.id.toString().replace('-100', '')
        const tgLink = `https://t.me/c/${rawChatId}/${messageId}`

        results.push({
          fileName: field.filename,
          telegramUrl: tgLink,
          status: 'success'
        })
      } catch (error) {
        console.error(`檔案 ${field.filename} 上傳失敗:`, error)
        results.push({ fileName: field.filename, status: 'error' })
      }
    }
  }

  return { success: true, results }
})