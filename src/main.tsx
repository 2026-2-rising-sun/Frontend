import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/typography.css'
import './styles/base.css'
import App from './app/App'
import { bootstrap } from './bootstrap/createApi'

// 모든 화면은 동일한 HTTP API 구현을 사용한다.
bootstrap().then(({ api }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App api={api} />
    </StrictMode>,
  )
})
