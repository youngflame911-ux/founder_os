/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/** Теги PWA (установка на экран «Домой») — только в сборке для хостинга: VITE_PWA=1 */
const pwaTags = (): Plugin => ({
  name: 'fos-pwa-tags',
  transformIndexHtml: (html) =>
    process.env.VITE_PWA === '1'
      ? html.replace(
          '<!--pwa-->',
          [
            '<link rel="manifest" href="./manifest.webmanifest" />',
            '<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />',
            '<meta name="apple-mobile-web-app-capable" content="yes" />',
            '<meta name="mobile-web-app-capable" content="yes" />',
            '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
            '<meta name="apple-mobile-web-app-title" content="Founder OS" />',
          ].join('\n    '),
        )
      : html.replace('<!--pwa-->', ''),
})

export default defineConfig({
  plugins: [react(), pwaTags()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom', globals: true },
  build: {
    target: ['es2019', 'safari13', 'chrome80', 'firefox78', 'edge88'],
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          calendar: ['react-big-calendar', 'gantt-task-react'],
        },
      },
    },
  },
})
