import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // Bind explícito em IPv4: sem isso o Vite sobe só em ::1 e o Chrome, que tenta
  // 127.0.0.1 primeiro, recebe connection refused.
  server: { port: 5180, host: '127.0.0.1' },

  // Demonstração remota via túnel: sem liberar o host, o Vite recusa a requisição
  // que chega com o Host de fora. Restrito ao domínio do Cloudflare de propósito.
  preview: {
    port: 4173,
    host: '127.0.0.1',
    allowedHosts: ['.trycloudflare.com'],
  },
})
