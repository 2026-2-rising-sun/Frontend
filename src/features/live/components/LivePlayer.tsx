import { useEffect, useRef, useState, type ReactNode } from 'react'
import type HlsType from 'hls.js'
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
          <Button variant="secondary" size="S" onClick={() => { setFailedUrl(null); setAttempt((n) => n + 1) }}>
            다시 시도
          </Button>
        }
      />
    )
  } else if (live.playbackUrl) {
    body = (
      <StreamVideo url={live.playbackUrl} attempt={attempt} title={live.title} onError={() => setFailedUrl(live.playbackUrl)} />
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

function StreamVideo({ url, title, attempt, onError }: { url: string; title: string; attempt: number; onError: () => void }) {
  const ref = useRef<HTMLVideoElement>(null); const errorRef = useRef(onError)
  useEffect(() => { errorRef.current = onError }, [onError])
  useEffect(() => {
    const video = ref.current!; let player: HlsType | undefined; let stopped = false
    if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = url
    else {
      void import('hls.js').then(({ default: Hls }) => {
        if (stopped) return
        if (Hls.isSupported()) {
          player = new Hls(); player.loadSource(url); player.attachMedia(video)
          player.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) errorRef.current() })
        } else video.src = url
      }).catch(() => { if (!stopped) errorRef.current() })
    }
    return () => { stopped = true; player?.destroy(); video.removeAttribute('src'); video.load() }
  }, [url, attempt])
  return <video ref={ref} className={styles.video} controls autoPlay muted playsInline aria-label={title} onError={() => errorRef.current()} />
}
