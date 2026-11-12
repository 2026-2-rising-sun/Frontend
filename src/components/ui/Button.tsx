import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'danger' | 'live'
export type ButtonSize = 'L' | 'M' | 'S'

interface StyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const cx = ({ variant = 'primary', size = 'M', fullWidth }: StyleProps, extra?: string) =>
  [styles.button, styles[variant], styles[`size${size}`], fullWidth && styles.full, extra].filter(Boolean).join(' ')

/** Figma "Button" (Type × Size × State). Hover/Pressed/Disabled 는 CSS 상태로 구현. */
export function Button({
  variant,
  size,
  fullWidth,
  className,
  type = 'button',
  ...rest
}: StyleProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cx({ variant, size, fullWidth }, className)} {...rest} />
}

/** 버튼 모양의 라우터 링크 */
export function ButtonLink({ variant, size, fullWidth, className, ...rest }: StyleProps & LinkProps) {
  return <Link className={cx({ variant, size, fullWidth }, className)} {...rest} />
}
