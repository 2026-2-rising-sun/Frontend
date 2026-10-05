import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const prism = process.argv.includes('--prism')
const port = prism ? 5274 : 5174
const children = []
const logs = root + '/test-artifacts/' + (prism ? 'prism' : 'local'); mkdirSync(logs, { recursive: true })
function start(command, args, name, env = process.env) {
  const log = createWriteStream(logs + '/' + name + '.log', { flags: 'a' })
  const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.pipe(log); child.stderr.pipe(log); child.once('error', error => { console.error(name + ': ' + error.message); stop(1) })
  child.once('exit', code => { if (!stopping) { console.error(name + ' exited: ' + code); stop(code || 1) } })
  children.push(child)
}
let stopping = false
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM'); process.exitCode = code }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop())
if (!prism) {
  for (const service of ['member', 'shopping', 'commerce', 'live']) {
    execFileSync('kubectl', ['--context', process.env.KIND_CONTEXT ?? 'kind-shoppinglive-dev', '-n', 'shoppinglive-frontend-local', 'wait', 'pod', '-l', 'app=' + service, '--for=condition=Ready', '--timeout=180s'], { stdio: 'inherit' })
  }
}
const urls = {}
for (const [index, service] of ['member', 'shopping', 'commerce', 'live'].entries()) {
  const apiPort = (prism ? 18581 : 18481) + index
  urls[service.toUpperCase() + '_URL'] = 'http://127.0.0.1:' + apiPort
  if (prism) start(root + '/node_modules/.bin/prism', ['mock', root + `/../Backend/contracts/api/${service}-service.yaml`, '--host', '127.0.0.1', '--port', String(apiPort)], service)
  else start('kubectl', ['--context', process.env.KIND_CONTEXT ?? 'kind-shoppinglive-dev', '-n', 'shoppinglive-frontend-local', 'port-forward', 'svc/' + service, apiPort + ':8080', '--address=127.0.0.1'], service)
}
// Forwarded processes can be ready a little after Vite. Tests wait for the service route too.
start(root + '/node_modules/.bin/vite', ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], 'vite', { ...process.env, ...urls })
console.log(`Frontend ${prism ? 'Prism contract' : 'kind integration'}: http://localhost:${port}`)
