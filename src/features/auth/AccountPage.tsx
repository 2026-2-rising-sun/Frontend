import { Navigate } from 'react-router-dom'
import { PageContainer } from '../../components/PageContainer'
import { ButtonLink } from '../../components/ui'
import { useSession } from './useSession'
import styles from './LoginPage.module.css'

export function AccountPage() {
  const session = useSession()
  if (!session) return <Navigate to="/login" replace state={{ from: '/account' }} />
  return <PageContainer narrow><section className={styles.form}>
    <h1>내 계정</h1>
    <p>{session.displayName}</p>
    <p>{session.email}</p>
    <p>{session.role === 'SELLER' ? '판매자 계정' : '유저 계정'}</p>
    {session.role === 'SELLER' && <ButtonLink to="/admin/products">판매자 콘솔</ButtonLink>}
    <ButtonLink to="/" variant="secondary">쇼핑몰로</ButtonLink>
  </section></PageContainer>
}
