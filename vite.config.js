import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'favicon.ico', 'placeholder.png'],
      manifest: {
        name: 'Budget Rent PH',
        short_name: 'BudgetRent',
        description: 'Affordable rentals across the Philippines',
        theme_color: '#003366',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
        display: 'standalone',
        background_color: '#F8FAFC'
      }
    })
  ],
})
