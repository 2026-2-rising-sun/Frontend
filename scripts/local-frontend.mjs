import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const prism = process.argv.includes('--prism')
const namespace = process.env.KIND_NAMESPACE ?? 'shoppinglive-frontend-local'
const port = prism ? 5274 : 5174
const children = []
const logs = root + '/test-artifacts/' + (prism ? 'prism' : 'local'); mkdirSync(logs, { recursive: true })
function start(command, args, name, env = process.env) {
  const log = createWriteStream(logs + '/' + name + '.log', { flags: 'a' })
  const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.pipe(log); child.stderr.pipe(log); child.once('error', error => { console.error(name + ': ' + error.message); stop(1) })
  child.once('exit', code => { if (!stopping) { console.error(name + ' 종료 코드: ' + code); stop(code || 1) } })
  children.push(child)
}
let stopping = false
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM'); process.exitCode = code }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop())
if (!prism) {
  for (const service of ['member', 'shopping', 'commerce', 'live', 'notification']) {
    execFileSync('kubectl', ['--context', process.env.KIND_CONTEXT ?? 'kind-shoppinglive-dev', '-n', namespace, 'rollout', 'status', 'deployment/' + service, '--timeout=180s'], { stdio: 'inherit' })
  }
}
const urls = {}
for (const [index, service] of ['member', 'shopping', 'commerce', 'live', 'notification'].entries()) {
  const apiPort = (prism ? 18581 : 18481) + index
  urls[service.toUpperCase() + '_URL'] = 'http://127.0.0.1:' + apiPort
  if (prism) start(root + '/node_modules/.bin/prism', ['mock', root + `/../Backend/contracts/api/${service}-service.yaml`, '--host', '127.0.0.1', '--port', String(apiPort)], service)
  else start('kubectl', ['--context', process.env.KIND_CONTEXT ?? 'kind-shoppinglive-dev', '-n', namespace, 'port-forward', 'svc/' + service, apiPort + ':8080', '--address=127.0.0.1'], service)
}
// 포트 전달 프로세스가 Vite보다 늦게 준비될 수 있으므로 테스트는 서비스 경로도 기다린다.
start(root + '/node_modules/.bin/vite', ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], 'vite', { ...process.env, ...urls })
console.log(`프런트엔드 ${prism ? 'Prism 계약 모의 서버' : 'kind 연동'}: http://localhost:${port}`)
