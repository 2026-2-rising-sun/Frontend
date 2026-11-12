import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/typography.css'
import './styles/base.css'
import App from './app/App'
import { bootstrap } from './bootstrap/createApi'
import { Button, ResultState } from './components/ui'

// 모든 화면은 동일한 HTTP API 구현을 사용한다.
const root = createRoot(document.getElementById('root')!)
bootstrap().then(({ api }) => {
  root.render(
    <StrictMode>
      <App api={api} />
    </StrictMode>,
  )
}).catch(() => {
  root.render(<main><ResultState type="error" title="로그인 상태를 확인하지 못했어요" message="서버 연결을 확인하고 다시 시도해 주세요."
    action={<Button onClick={() => window.location.reload()}>다시 시도</Button>} /></main>)
})
