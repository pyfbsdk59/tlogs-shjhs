export default defineNuxtConfig({
  modules: [
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
    '@nuxtjs/supabase'
  ],
  supabase: {
    // 開發初期建議先關閉自動路由攔截，方便測試
    redirect: false 
  }
})