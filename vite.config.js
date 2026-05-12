import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    host: true,
    port: 3000
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'masked-icon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'IT OPS - SOLUSIKU ID Card Control Center',
        short_name: 'IT OPS Solusiku',
        description: 'ID Card Automation & Control Center',
        theme_color: '#b91c1c',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 30000000 // 30 MB
      },
      devOptions: {
        enabled: true
      }
    })
  ]
});
