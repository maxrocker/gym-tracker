import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' keeps every emitted asset path relative, so the same build works whether it's
// deployed at a domain root (Vercel) or under a subpath (GitHub Pages project site).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '.',
        name: 'Gym Tracker',
        short_name: 'Gym Tracker',
        description: 'Offline-first gym progress tracker — machines, sets, body weight, and history.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#101114',
        theme_color: '#2563eb',
        orientation: 'portrait-primary',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        // App-shell/offline-first: unmatched navigations fall back to the cached shell instead
        // of a network error, since this app never talks to a server.
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 200 } },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
