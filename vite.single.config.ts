/**
 * Сборка в один самодостаточный HTML-файл (весь JS и CSS внутри).
 * Открывается двойным кликом без сервера и подходит для встраиваемого хостинга.
 * Запуск: npm run build:single → dist-single/founder-os.html
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { 'import.meta.env.VITE_ROUTER': JSON.stringify('memory') },
  build: { outDir: 'dist-single', emptyOutDir: true },
})
