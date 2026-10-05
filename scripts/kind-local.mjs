import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto'
const root = resolve(import.meta.dirname, '..')
const backend = resolve(process.env.BACKEND_DIR ?? root + '/../Backend')
const namespace = 'shoppinglive-frontend-local'
const context = process.env.KIND_CONTEXT ?? 'kind-shoppinglive-dev'
if (!context.startsWith('kind-')) throw new Error('A kind context is required')
const run = (name, args, options = {}) => execFileSync(name, args, { encoding: 'utf8', ...options })
const k = args => ['--context', context, '-n', namespace, ...args]
const work = root + '/test-artifacts/kind'; mkdirSync(work, { recursive: true })
const services = ['member', 'shopping', 'commerce', 'live']
const labels = { 'app.kubernetes.io/managed-by': 'shoppinglive-frontend-local' }
const meta = name => ({ name, namespace, labels })
const apply = objects => run('kubectl', k(['apply', '-f', '-']), { input: JSON.stringify({ apiVersion: 'v1', kind: 'List', items: objects }) })
if (process.argv[2] === 'down') {
  const record = JSON.parse(run('kubectl', ['--context', context, 'get', 'namespace', namespace, '-o', 'json']))
  if (record.metadata.labels['app.kubernetes.io/managed-by'] !== labels['app.kubernetes.io/managed-by']) throw new Error('Namespace ownership mismatch')
  console.log(run('kubectl', ['--context', context, 'delete', 'namespace', namespace])); process.exit(0)
}
const sha = run('git', ['rev-parse', 'HEAD'], { cwd: backend }).trim()
if (run('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: backend }).trim()) throw new Error('Backend tracked changes must be committed before building integration images')
console.log('Building the existing Backend commit: ' + sha)
run(resolve(backend, 'gradlew'), ['--no-daemon', '--max-workers=2', ...services.map(s => `:services:${s}-service:bootJar`)], { cwd: backend, stdio: 'inherit' })
try {
  const current = JSON.parse(run('kubectl', ['--context', context, 'get', 'namespace', namespace, '-o', 'json'], { stdio: ['ignore', 'pipe', 'ignore'] }))
  if (current.metadata.labels['app.kubernetes.io/managed-by'] !== labels['app.kubernetes.io/managed-by']) throw new Error('Namespace ownership mismatch')
} catch (e) { if (e.message === 'Namespace ownership mismatch') throw e }
console.log(apply([{ apiVersion: 'v1', kind: 'Namespace', metadata: { name: namespace, labels } }]))
let config
const credentialsFile = work + '/credentials.json'
if (existsSync(credentialsFile)) config = JSON.parse(readFileSync(credentialsFile, 'utf8'))
else {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 }); const kid = 'frontend-local-' + randomUUID()
  config = { kid, password: randomBytes(24).toString('base64url'), private: privateKey.export({ type: 'pkcs8', format: 'pem' }), public: JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' }] }), env: {} }
  for (const pair of ['SHOPPING_MEMBER', 'COMMERCE_MEMBER', 'LIVE_MEMBER', 'COMMERCE_SHOPPING', 'LIVE_SHOPPING', 'SHOPPING_COMMERCE', 'LIVE_COMMERCE']) config.env[pair + '_SERVICE_TOKEN'] = randomBytes(32).toString('base64url')
  writeFileSync(credentialsFile, JSON.stringify(config), { mode: 0o600 })
}
const deployment = (name, image, env = [], volumes = [], mounts = [], probes = false) => ({ apiVersion: 'apps/v1', kind: 'Deployment', metadata: meta(name), spec: { replicas: 1, strategy: { type: 'Recreate' }, selector: { matchLabels: { app: name } }, template: { metadata: { labels: { app: name, ...labels } }, spec: { volumes, containers: [{ name, image, imagePullPolicy: 'IfNotPresent', env, ports: [{ containerPort: 8080 }, { containerPort: 9090 }], volumeMounts: mounts, ...(probes ? { resources: { requests: { memory: '160Mi', cpu: '50m' }, limits: { memory: '512Mi' } }, startupProbe: { httpGet: { path: '/actuator/health/readiness', port: 9090 }, failureThreshold: 90, periodSeconds: 2 }, readinessProbe: { httpGet: { path: '/actuator/health/readiness', port: 9090 }, periodSeconds: 3 } } : {}) }] } } } })
const service = (name, port, targetPort = port) => ({ apiVersion: 'v1', kind: 'Service', metadata: meta(name), spec: { selector: { app: name }, ports: [{ port, targetPort }] } })
const env = record => Object.entries(record).map(([name, value]) => ({ name, value: String(value) }))
const initSql = services.map(s => `CREATE DATABASE ${s};`).join('\n')
console.log(apply([
  { apiVersion: 'v1', kind: 'Secret', metadata: meta('auth'), stringData: { 'private.pem': config.private, 'public.jwks': config.public, ...config.env, POSTGRES_PASSWORD: config.password } },
  { apiVersion: 'v1', kind: 'ConfigMap', metadata: meta('db-init'), data: { 'init.sql': initSql } },
  deployment('postgres', 'postgres:16-alpine', [...env({ POSTGRES_USER: 'frontend', POSTGRES_DB: 'postgres' }), { name: 'POSTGRES_PASSWORD', valueFrom: { secretKeyRef: { name: 'auth', key: 'POSTGRES_PASSWORD' } } }], [{ name: 'init', configMap: { name: 'db-init' } }, { name: 'data', emptyDir: {} }], [{ name: 'init', mountPath: '/docker-entrypoint-initdb.d' }, { name: 'data', mountPath: '/var/lib/postgresql/data' }]), service('postgres', 5432),
  deployment('redis', 'redis:7-alpine'), service('redis', 6379)
]))
for (const s of services) {
  const jars = readdirSync(backend + `/services/${s}-service/build/libs`).filter(n => n.endsWith('.jar') && !n.endsWith('-plain.jar'))
  if (jars.length !== 1) throw new Error('Expected one boot jar for ' + s)
  const dir = work + '/' + s; mkdirSync(dir, { recursive: true })
  writeFileSync(dir + '/app.jar', readFileSync(backend + `/services/${s}-service/build/libs/` + jars[0]))
  writeFileSync(dir + '/Dockerfile', 'FROM eclipse-temurin:21-jdk\nCOPY app.jar /app.jar\nENTRYPOINT ["java","-jar","/app.jar"]\n')
  const image = `shoppinglive-frontend-local/${s}:${sha.slice(0, 12)}`
  run('docker', ['build', '-t', image, dir], { stdio: 'inherit' })
  run('kind', ['load', 'docker-image', image, '--name', context.slice(5)], { stdio: 'inherit' })
  const values = { JAVA_TOOL_OPTIONS: '-Xmx128m -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=48m -XX:MaxDirectMemorySize=32m -XX:ActiveProcessorCount=2 -Xss512k', SERVER_TOMCAT_THREADS_MAX: 24, SERVER_TOMCAT_THREADS_MIN_SPARE: 2, SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE: 5, SPRING_PROFILES_ACTIVE: 'local', SERVER_PORT: 8080, MANAGEMENT_SERVER_PORT: 9090, SPRING_DATASOURCE_URL: `jdbc:postgresql://postgres:5432/${s}`, SPRING_DATASOURCE_USERNAME: 'frontend', MEMBER_LOCAL_TEST_ACCOUNTS_ENABLED: true, MEMBER_JWT_PUBLIC_KEY_SET_LOCATION: 'file:/run/auth/public.jwks', MEMBER_JWT_PRIVATE_KEY_LOCATION: 'file:/run/auth/private.pem', MEMBER_JWT_KEY_ID: config.kid, MEMBER_ACCESS_TOKEN_TTL: 'PT15M', MEMBER_REFRESH_TOKEN_TTL: 'P30D', MEMBER_SESSION_BASE_URL: 'http://member:8080', SHOPPING_SALES_CLIENT_BASE_URL: 'http://commerce:8080', COMMERCE_SHOPPING_CLIENT_BASE_URL: 'http://shopping:8080', LIVE_PRODUCTS_MODE: 'http', LIVE_PRODUCTS_SHOPPING_URL: 'http://shopping:8080', LIVE_PRODUCTS_COMMERCE_URL: 'http://commerce:8080', LIVE_IVS_MODE: 'stub', LIVE_IVS_STUB_READY: true, SHOPPING_IMAGE_DIR: '/tmp/images', SHOPPING_IMAGE_PUBLIC_BASE_URL: '/api/shopping', SPRING_DATA_REDIS_HOST: 'redis', SPRING_DATA_REDIS_PORT: 6379, SPRING_KAFKA_BOOTSTRAP_SERVERS: '127.0.0.1:1', SPRING_KAFKA_ADMIN_AUTO_CREATE: false, SPRING_KAFKA_LISTENER_AUTO_STARTUP: false }
  const secretEnv = Object.keys(config.env).concat('POSTGRES_PASSWORD').map(name => ({ name: name === 'POSTGRES_PASSWORD' ? 'SPRING_DATASOURCE_PASSWORD' : name, valueFrom: { secretKeyRef: { name: 'auth', key: name } } }))
  console.log(apply([deployment(s, image, [...env(values), ...secretEnv], [{ name: 'auth', secret: { secretName: 'auth' } }, { name: 'images', emptyDir: {} }], [{ name: 'auth', mountPath: '/run/auth', readOnly: true }, { name: 'images', mountPath: '/tmp/images' }], true), service(s, 8080)]))
}
for (const s of services) console.log(run('kubectl', k(['wait', 'pod', '-l', 'app=' + s, '--for=condition=Ready', '--timeout=180s'])))
writeFileSync(work + '/state.json', JSON.stringify({ context, namespace, backendSha: sha, services, createdAt: new Date().toISOString() }, null, 2))
console.log('Ready. Run npm run local:frontend to keep service forwarding and the frontend open at http://localhost:5174.')
