import { Alert, Button } from '../../../components/ui'
import type { ApiError } from '../../../domain/errors'

/** 쓰기 동작 실패 안내. 충돌(CONFLICT)이면 최신 내용을 다시 불러오도록 안내한다. */
export function ActionAlert({ error, onReload }: { error: ApiError | null; onReload?: () => void }) {
  if (!error) return null
  if (error.code === 'CONFLICT') {
    return (
      <Alert type="warning" title="다른 곳에서 먼저 바뀌었어요">
        {error.message}
        {onReload && (
          <div style={{ marginTop: 8 }}>
            <Button size="S" variant="secondary" onClick={onReload}>
              최신 내용 불러오기
            </Button>
          </div>
        )}
      </Alert>
    )
  }
  return (
    <Alert type="danger" title={error.code === 'VALIDATION' ? '입력을 확인해 주세요' : '처리하지 못했어요'}>
      {error.message}
    </Alert>
  )
}
