import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/typography.css'
import './styles/base.css'
import App from './app/App'
import { bootstrap } from './bootstrap/createApi'

// API 구현(실제 / mock)은 bootstrap 에서만 결정된다. 앱은 어떤 구현인지 모른다.
bootstrap().then(({ api, devTools }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App api={api} devTools={devTools} />
    </StrictMode>,
  )
})
