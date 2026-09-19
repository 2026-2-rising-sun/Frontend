import { useEffect, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { Api } from '../domain/ports'
import { AdminLayout } from '../features/admin/AdminLayout'
import { AdminLiveEditPage } from '../features/admin/AdminLiveEditPage'
import { AdminLiveListPage } from '../features/admin/AdminLiveListPage'
import { AdminProductEditPage } from '../features/admin/AdminProductEditPage'
import { AdminProductListPage } from '../features/admin/AdminProductListPage'
import { CheckoutPage } from '../features/commerce/CheckoutPage'
import { OrderLookupPage } from '../features/commerce/OrderLookupPage'
import { OrderResultPage } from '../features/commerce/OrderResultPage'
import { HomePage } from '../features/home/HomePage'
import { LiveListPage } from '../features/live/LiveListPage'
import { LiveWatchPage } from '../features/live/LiveWatchPage'
import { ProductDetailPage } from '../features/shopping/ProductDetailPage'
import { ApiContext } from './apiContext'
import { AppLayout } from './layout/AppLayout'
import { NotFoundPage } from './NotFoundPage'

interface AppProps {
  api: Api
  /** 개발·시연용 화면 도구 (mock 모드에서만 전달됨) */
  devTools?: ComponentType | null
}

/** 화면 이동 시 항상 맨 위에서 시작한다. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function App({ api, devTools: DevTools }: AppProps) {
  return (
    <ApiContext.Provider value={api}>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="products/:productId" element={<ProductDetailPage />} />
            <Route path="lives" element={<LiveListPage />} />
            <Route path="lives/:liveId" element={<LiveWatchPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="orders/lookup" element={<OrderLookupPage />} />
            <Route path="orders/:orderNumber" element={<OrderResultPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          {/* 관리 콘솔: 로그인·역할이 없는 P1 개발·시연용 화면. 공개 내비게이션에는 노출하지 않는다. */}
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="products" replace />} />
            <Route path="products" element={<AdminProductListPage />} />
            <Route path="products/new" element={<AdminProductEditPage key="new" />} />
            <Route path="products/:productId" element={<AdminProductEditPage key="edit" />} />
            <Route path="lives" element={<AdminLiveListPage />} />
            <Route path="lives/new" element={<AdminLiveEditPage key="new" />} />
            <Route path="lives/:liveId" element={<AdminLiveEditPage key="edit" />} />
          </Route>
        </Routes>
        {DevTools && <DevTools />}
      </BrowserRouter>
    </ApiContext.Provider>
  )
}

export default App
