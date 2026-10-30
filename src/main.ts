import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { usePwaStore } from './stores/pwa'
import { useThemeStore } from './stores/theme'
import './style.css'

const pinia = createPinia()
const app = createApp(App).use(pinia).use(router)
useThemeStore(pinia)
usePwaStore(pinia)
app.mount('#app')
