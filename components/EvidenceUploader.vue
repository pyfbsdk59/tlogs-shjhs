export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: '沒有找到檔案，或檔案容量超過伺服器限制' })
  }

  // 1. 確保環境變數有成功抓到 (避免回傳 "undefined" 給 TG)
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID

  if (!BOT_TOKEN || !CHAT_ID) {
    throw createError({ statusCode: 500, statusMessage: '伺服器缺少 Telegram Token 或 Chat ID' })
  }

  const results = []

  for (const field of formData) {
    if (field.name === 'files' && field.data) {
      const tgFormData = new FormData()
      
      // 2. 嚴謹處理檔名與類型 (Telegram API 嚴格要求一定要有 filename)
      const filename = field.filename || `audio_${Date.now()}.m4a`
      const mimeType = field.type || 'application/octet-stream'
      
      const blob = new Blob([field.data], { type: mimeType })
      
      tgFormData.append('chat_id', CHAT_ID)
      tgFormData.append('document', blob, filename)
      tgFormData.append('caption', `📅 證據歸檔：${filename}`)

      try {
        // 3. ⚠️ 關鍵修正：改用全域原生的 fetch，捨棄 $fetch，完美解決 FormData 傳輸錯誤
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
          method: 'POST',
          body: tgFormData
        })

        // 解析 Telegram 的回傳值
        const tgResponse = await response.json()

        if (!tgResponse.ok) {
          throw new Error(tgResponse.description || 'Telegram 拒絕了此檔案')
        }

        const messageId = tgResponse.result.message_id
        const rawChatId = tgResponse.result.chat.id.toString().replace('-100', '')
        const tgLink = `https://t.me/c/${rawChatId}/${messageId}`

        results.push({
          fileName: filename,
          telegramUrl: tgLink,
          status: 'success'
        })
      } catch (error) {
        // 在終端機印出詳細的錯誤原因，方便後續除錯
        console.error(`❌ 檔案 [${filename}] 上傳失敗:`, error)
        results.push({ fileName: filename, status: 'error' })
      }
    }
  }

  return { success: true, results }
})