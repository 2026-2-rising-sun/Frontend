import { PageContainer } from '../components/PageContainer'
import { ButtonLink, ResultState } from '../components/ui'

export function NotFoundPage() {
  return (
    <PageContainer narrow>
      <ResultState
        type="empty"
        title="페이지를 찾을 수 없어요"
        message="주소가 바뀌었거나 존재하지 않는 페이지예요."
        action={<ButtonLink to="/">쇼핑 홈으로</ButtonLink>}
      />
    </PageContainer>
  )
}
