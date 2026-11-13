import { createServer, request as forward, type IncomingMessage } from 'node:http'

/** 모의 응답. body 가 문자열이면 그대로, 아니면 API 봉투({ success, data, error })에 담아 보낸다. */
export interface MockReply { body: unknown; type?: string }

/** 씨앗이 같으면 같은 수열을 내는 난수 (mulberry32) */
export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const json = (data: unknown) => JSON.stringify({ success: true, data, error: null })

/** port 에서 handle 이 답하는 요청만 직접 응답하고, 나머지(undefined)는 prismPort 의 Prism 으로 넘기는 서버 */
export function startMock(port: number, prismPort: number, handle: (url: URL, req: IncomingMessage) => MockReply | undefined) {
  const server = createServer((req, res) => {
    const reply = handle(new URL(req.url ?? '/', 'http://127.0.0.1'), req)
    if (reply) {
      const raw = typeof reply.body === 'string'
      res.writeHead(200, { 'content-type': reply.type ?? (raw ? 'text/plain' : 'application/json'), 'cache-control': 'no-store' })
      res.end(raw ? reply.body as string : json(reply.body))
      return
    }
    const proxied = forward({ host: '127.0.0.1', port: prismPort, path: req.url, method: req.method, headers: req.headers }, upstream => {
      res.writeHead(upstream.statusCode ?? 502, upstream.headers)
      upstream.pipe(res)
    })
    proxied.on('error', () => { res.writeHead(502); res.end() })
    req.pipe(proxied)
  })
  server.listen(port, '127.0.0.1')
  return server
}
