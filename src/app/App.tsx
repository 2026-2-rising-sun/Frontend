import { CartCheckoutPage } from '../features/commerce/CartCheckoutPage'
import { PaymentGroupPage } from '../features/commerce/PaymentGroupPage'
import { CartPage } from '../features/commerce/CartPage'
import { RequireSession } from '../features/auth/RequireSession'
import { SignupPage } from '../features/auth/SignupPage'
import { AccountPage } from '../features/auth/AccountPage'
import { LoginPage } from '../features/auth/LoginPage'
import { useEffect } from 'react'
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
}

/** 화면 이동 시 항상 맨 위에서 시작한다. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function App({ api }: AppProps) {
  return (
    <ApiContext.Provider value={api}>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="products/:productId" element={<ProductDetailPage />} />
            <Route path="lives" element={<LiveListPage />} />
            <Route path="lives/:liveId" element={<LiveWatchPage />} />
            <Route path="cart" element={<RequireSession><CartPage /></RequireSession>} />
            <Route path="checkout/cart" element={<RequireSession><CartCheckoutPage /></RequireSession>} />
            <Route path="payment-groups/:groupNumber" element={<RequireSession><PaymentGroupPage /></RequireSession>} />
            <Route path="checkout" element={<RequireSession><CheckoutPage /></RequireSession>} />
            <Route path="orders/lookup" element={<RequireSession><OrderLookupPage /></RequireSession>} />
            <Route path="orders/:orderNumber" element={<RequireSession><OrderResultPage /></RequireSession>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          {/* 판매자 역할을 검증한 뒤 관리 콘솔을 렌더링한다. */}
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
      </BrowserRouter>
    </ApiContext.Provider>
  )
}

export default App
