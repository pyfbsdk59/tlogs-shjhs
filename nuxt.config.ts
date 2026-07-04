export default defineNuxtConfig({
  modules: [
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
    '@nuxtjs/supabase'
  ],
  runtimeConfig: {
    public: {
      hfApiUrl: process.env.NUXT_PUBLIC_HF_API_URL
    }
  },
  supabase: {
    redirect: false
  },
  compatibilityDate: '2024-04-03'
})