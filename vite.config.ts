import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: Object.fromEntries(['member', 'shopping', 'commerce', 'live'].map((service, index) => [
        `/api/${service}`, {
          target: env[`${service.toUpperCase()}_URL`] ?? `http://127.0.0.1:${8081 + index}`,
          changeOrigin: true,
          configure(proxy) { proxy.on('proxyReq', request => request.removeHeader('origin')) },
          rewrite: (path: string) => path.replace(`/api/${service}`, ''),
        },
      ])),
    },
  }
})
