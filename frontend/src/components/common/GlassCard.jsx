import { useState, useRef, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../utils/cn'

/**
 * Surface levels:
 * 1 = standard cards, KPI cards, summary widgets
 * 2 = interactive panels, dropdowns, floating elements
 * 3 = modals, command menus, popovers
 */
const SURFACE_LEVELS = {
  1: 'bg-white dark:bg-[#0E1D19]/90 border border-slate-200/90 dark:border-emerald-500/15 shadow-xs dark:shadow-glass-dark-sm backdrop-blur-md',
  2: 'bg-white/95 dark:bg-[#122420]/95 border border-slate-200 dark:border-emerald-500/20 shadow-sm dark:shadow-glass-dark-md backdrop-blur-lg',
  3: 'bg-white dark:bg-[#162C27] border border-slate-200 dark:border-emerald-500/25 shadow-xl dark:shadow-glass-dark-lg backdrop-blur-xl',
}

export function GlassCard({
  children,
  level = 1,
  className,
  interactive = false,
  tilt = false,
  cursorLight = false,
  onClick,
  ...props
}) {
  const cardRef = useRef(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, opacity: 0 })
  const [tiltStyle, setTiltStyle] = useState({ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' })
  const shouldReduceMotion = useReducedMotion()

  const handleMouseMove = useCallback(
    (e) => {
      if (!cursorLight && !tilt) return
      if (shouldReduceMotion) return

      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (cursorLight) {
        setMousePos({ x, y, opacity: 1 })
      }

      if (tilt && !('ontouchstart' in window)) {
        const centerX = rect.width / 2
        const centerY = rect.height / 2
        const rotateX = ((y - centerY) / centerY) * -2.5
        const rotateY = ((x - centerX) / centerX) * 2.5
        setTiltStyle({
          transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`,
        })
      }
    },
    [cursorLight, tilt, shouldReduceMotion]
  )

  const handleMouseLeave = useCallback(() => {
    if (cursorLight) {
      setMousePos((prev) => ({ ...prev, opacity: 0 }))
    }
    if (tilt) {
      setTiltStyle({
        transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      })
    }
  }, [cursorLight, tilt])

  const surfaceClass = SURFACE_LEVELS[level] || SURFACE_LEVELS[1]

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        ...tiltStyle,
        transition: 'transform 0.18s ease-out, box-shadow 0.2s ease',
      }}
      className={cn(
        'relative rounded-2xl transition-all duration-200 overflow-hidden',
        surfaceClass,
        interactive && 'hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-glass-dark-md cursor-pointer',
        className
      )}
      {...props}
    >
      {/* Subtle cursor-following radial light */}
      {cursorLight && !shouldReduceMotion && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            opacity: mousePos.opacity,
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(16, 185, 129, 0.08), transparent 80%)`,
          }}
        />
      )}

      {/* Card Content */}
      <div className="relative z-10 text-slate-900 dark:text-slate-100">{children}</div>
    </div>
  )
}

export default GlassCard
