# DEX Simulator — Frontend

Vue 3 + Vite + Tailwind CSS 4 + Pinia + Vue Router + lightweight-charts. Backend, deployment, dan dokumentasi lengkap ada di [dex-backend](https://github.com/edopranata/dex-backend).

Clone kedua repository berdampingan:

```
dex/
├── backend/    github.com/edopranata/dex-backend
└── frontend/   github.com/edopranata/dex-frontend   (repo ini)
```

## Perintah

```bash
npm install
npm run dev            # Vite di http://localhost:5173, /api & /sanctum diteruskan ke Laravel :8000
npm run build          # type-check + build ke dist/
npm run build:laravel  # build ke ../backend/public sehingga Laravel menyajikan frontend + API di satu domain
```

Di production, image Docker menjalankan `npm run build:laravel` dari repo ini. Push ke `main` memicu GitHub Actions (build, lalu deploy ke VPS).
