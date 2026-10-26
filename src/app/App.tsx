import { AlertSubscriptionsPage } from '../features/notifications/AlertSubscriptionsPage'
import { BuyerRefundDetailPage } from '../features/refunds/BuyerRefundDetailPage'
import { NotificationsPage } from '../features/notifications/NotificationsPage'
import { SellerCouponsPage, SellerCouponEditPage } from '../features/coupons/SellerCouponsPage'
import { CouponsPage } from '../features/coupons/CouponsPage'
import { SellerRefundListPage } from '../features/refunds/SellerRefundListPage'
import { SellerRefundDetailPage } from '../features/refunds/SellerRefundDetailPage'
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
import { SellerLayout } from '../features/seller/SellerLayout'
import { SellerLiveEditPage } from '../features/seller/SellerLiveEditPage'
import { SellerLiveListPage } from '../features/seller/SellerLiveListPage'
import { SellerProductEditPage } from '../features/seller/SellerProductEditPage'
import { SellerProductListPage } from '../features/seller/SellerProductListPage'
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
            <Route path="notifications/subscriptions" element={<RequireSession><AlertSubscriptionsPage /></RequireSession>} />
            <Route path="notifications" element={<RequireSession><NotificationsPage /></RequireSession>} />
            <Route path="products/:productId" element={<ProductDetailPage />} />
            <Route path="lives" element={<LiveListPage />} />
            <Route path="lives/:liveId" element={<LiveWatchPage />} />
            <Route path="coupons" element={<RequireSession><CouponsPage /></RequireSession>} />
            <Route path="cart" element={<RequireSession><CartPage /></RequireSession>} />
            <Route path="checkout/cart" element={<RequireSession><CartCheckoutPage /></RequireSession>} />
            <Route path="payment-groups/:groupNumber/refunds/:refundId" element={<RequireSession><BuyerRefundDetailPage /></RequireSession>} />
            <Route path="payment-groups/:groupNumber" element={<RequireSession><PaymentGroupPage /></RequireSession>} />
            <Route path="checkout" element={<RequireSession><CheckoutPage /></RequireSession>} />
            <Route path="orders/lookup" element={<RequireSession><OrderLookupPage /></RequireSession>} />
            <Route path="orders/:orderNumber" element={<RequireSession><OrderResultPage /></RequireSession>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          {/* 판매자 역할을 검증한 뒤 관리 콘솔을 렌더링한다. */}
          <Route path="seller" element={<SellerLayout />}>
            <Route index element={<Navigate to="products" replace />} />
            <Route path="products" element={<SellerProductListPage />} />
            <Route path="products/new" element={<SellerProductEditPage key="new" />} />
            <Route path="products/:productId" element={<SellerProductEditPage key="edit" />} />
            <Route path="refunds" element={<SellerRefundListPage />} />
            <Route path="refunds/:refundId" element={<SellerRefundDetailPage />} />
            <Route path="coupons" element={<SellerCouponsPage />} />
            <Route path="coupons/new" element={<SellerCouponEditPage key="new" />} />
            <Route path="coupons/:id" element={<SellerCouponEditPage key="edit" />} />
            <Route path="lives" element={<SellerLiveListPage />} />
            <Route path="lives/new" element={<SellerLiveEditPage key="new" />} />
            <Route path="lives/:liveId" element={<SellerLiveEditPage key="edit" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ApiContext.Provider>
  )
}

export default App
