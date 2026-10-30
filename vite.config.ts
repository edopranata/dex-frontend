import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const backend = process.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8000'

// Same-origin in dev and production: /api and /sanctum go to Laravel so the
// Sanctum session cookie works without CORS.
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    // Installable app. The service worker only caches the app shell (HTML, JS, CSS, icons):
    // market data always comes live from the API. A new version waits until the user accepts
    // the "versi baru" prompt (components/PwaUpdate.vue).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'pwa/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'DEX Simulator',
        short_name: 'DEX Sim',
        description: 'Simulator trading kripto DEX dengan harga real dan uang virtual.',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b1018',
        theme_color: '#0b1018',
        categories: ['finance'],
        icons: [
          { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Market', url: '/markets', icons: [{ src: '/pwa/icon-192.png', sizes: '192x192' }] },
          { name: 'Sinyal', url: '/signals', icons: [{ src: '/pwa/icon-192.png', sizes: '192x192' }] },
          { name: 'Portofolio', url: '/portfolio', icons: [{ src: '/pwa/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['mail/**'],
        navigateFallback: '/index.html',
        // Laravel-only pages and endpoints are never answered from the app shell.
        navigateFallbackDenylist: [/^\/api\//, /^\/sanctum\//, /^\/horizon/, /^\/up$/, /^\/health$/, /^\/mail\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend },
      '/sanctum': { target: backend },
      '/horizon': { target: backend },
    },
  },
})
