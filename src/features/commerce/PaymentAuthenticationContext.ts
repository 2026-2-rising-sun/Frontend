import { createContext } from 'react'
import type { PaymentAuthentication } from '../../domain/orderSheets'
export const PaymentAuthenticationContext = createContext<PaymentAuthentication | null>(null)
