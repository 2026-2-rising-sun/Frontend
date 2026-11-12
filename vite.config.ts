import react from '@vitejs/plugin-react'
import { servicePorts, publicServices } from './scripts/services.ts'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: Object.fromEntries(Object.entries(servicePorts).filter(([service]) => publicServices.includes(service)).map(([service, port]) => [
        `/api/${service}`, {
          target: env[`${service.toUpperCase()}_URL`] ?? `http://127.0.0.1:${port}`,
          changeOrigin: true,
          configure(proxy) { proxy.on('proxyReq', request => request.removeHeader('origin')) },
          rewrite: (path: string) => path.replace(`/api/${service}`, ''),
        },
      ])),
    },
  }
})
