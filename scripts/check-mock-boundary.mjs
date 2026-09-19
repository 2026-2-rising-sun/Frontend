#!/usr/bin/env node
/**
 * mock 경계 검사.
 * mock 과 실제 코드를 파일·의존성 양쪽에서 분리해 두었는지 검사한다.
 * (`npm run lint` 에 포함되어 CI 에서도 실행된다.)
 *
 * 규칙
 *  1. src/mocks 는 src/bootstrap 만 import 할 수 있다.        → mock 을 지울 때 지울 곳이 한 곳뿐이어야 한다.
 *  2. src/mocks 는 src/domain(계약)과 자기 자신만 import 한다.  → mock 이 화면·실제 API 코드를 알면 안 된다.
 *  3. src/api/http 는 src/bootstrap 과 src/api 안에서만 import 한다. → 화면은 실제 구현이 아니라 domain 계약만 본다.
 *  4. src/domain 은 다른 계층을 import 하지 않는다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

const under = (file, folder) => file === folder || file.startsWith(folder + sep)
const IMPORT_RE = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

const MOCKS = join(SRC, 'mocks')
const BOOTSTRAP = join(SRC, 'bootstrap')
const HTTP = join(SRC, 'api', 'http')
const API = join(SRC, 'api')
const DOMAIN = join(SRC, 'domain')

const violations = []

for (const file of walk(SRC).filter((f) => /\.(ts|tsx|css)$/.test(f))) {
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1]
    if (!specifier.startsWith('.')) continue // 외부 패키지는 검사 대상이 아니다
    const target = resolve(dirname(file), specifier)
    const where = `${relative(ROOT, file)} → ${specifier}`

    if (under(target, MOCKS) && !under(file, MOCKS) && !under(file, BOOTSTRAP)) {
      violations.push(`[1] mock 은 bootstrap 에서만 import 할 수 있어요: ${where}`)
    }
    if (under(file, MOCKS) && !under(target, MOCKS) && !under(target, DOMAIN)) {
      violations.push(`[2] mock 은 domain 과 mocks 내부만 import 할 수 있어요: ${where}`)
    }
    if (under(target, HTTP) && !under(file, API) && !under(file, BOOTSTRAP)) {
      violations.push(`[3] 실제 API 어댑터는 bootstrap 에서만 import 할 수 있어요: ${where}`)
    }
    if (under(file, DOMAIN) && !under(target, DOMAIN)) {
      violations.push(`[4] domain 은 다른 계층을 import 할 수 없어요: ${where}`)
    }
  }
}

if (violations.length > 0) {
  console.error(`mock 경계 위반 ${violations.length}건\n` + violations.map((v) => `  - ${v}`).join('\n'))
  process.exit(1)
}
console.log('mock 경계 검사 통과')
