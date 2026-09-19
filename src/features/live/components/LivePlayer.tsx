import { useState, type ReactNode } from 'react'
import { PlayIcon } from '../../../components/icons'
import { Button, StatusBadge, liveBadge } from '../../../components/ui'
import type { LiveDetail } from '../../../domain/types'
import styles from './LivePlayer.module.css'

/**
 * 방송 영상 영역. 영상 오류는 상품 영역 오류와 분리해서 이 안에서만 처리한다.
 * 재생은 브라우저 <video> 로 하며, AWS IVS 플레이어 SDK 를 붙일 때는 이 컴포넌트 내부만 바꾼다.
 */
export function LivePlayer({ live }: { live: Pick<LiveDetail, 'status' | 'playbackUrl' | 'title'> }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const failed = live.playbackUrl !== null && failedUrl === live.playbackUrl

  let body
  if (live.status === 'READY') {
    body = <Message title="방송 준비 중이에요" description="예정된 시각에 시작하면 이곳에서 시청할 수 있어요." />
  } else if (live.status === 'ENDED') {
    body = <Message title="방송이 종료되었어요" description="방송은 끝났지만 소개된 상품은 계속 구매할 수 있어요." />
  } else if (failed) {
    body = (
      <Message
        title="영상을 불러오지 못했어요"
        description="네트워크를 확인하고 다시 시도해 주세요. 상품 구매에는 영향이 없어요."
        action={
          <Button variant="secondary" size="S" onClick={() => setAttempt((n) => n + 1)}>
            다시 시도
          </Button>
        }
      />
    )
  } else if (live.playbackUrl) {
    body = (
      <video
        key={attempt}
        className={styles.video}
        src={live.playbackUrl}
        controls
        autoPlay
        muted
        playsInline
        aria-label={live.title}
        onError={() => setFailedUrl(live.playbackUrl)}
      />
    )
  } else {
    body = <Message title="라이브 영상 영역" description="재생 URL 이 연결되면 방송 영상이 이곳에 표시돼요." icon />
  }

  return (
    <div className={styles.player}>
      {body}
      <StatusBadge status={liveBadge(live.status)} className={styles.badge} />
    </div>
  )
}

function Message({ title, description, action, icon }: { title: string; description: string; action?: ReactNode; icon?: boolean }) {
  return (
    <div className={styles.message}>
      {icon && <PlayIcon size={32} />}
      <p className={styles.messageTitle}>{title}</p>
      <p className={styles.messageDesc}>{description}</p>
      {action}
    </div>
  )
}
