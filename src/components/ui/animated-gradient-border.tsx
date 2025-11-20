"use client"

import type React from "react"

import { useEffect, useRef } from "react"

interface AnimatedGradientBorderProps {
  children: React.ReactNode
  colors: string[]
  borderWidth?: number
  duration?: number
  className?: string
}

export function AnimatedGradientBorder({
  children,
  colors,
  borderWidth = 1,
  duration = 8,
  className = "",
}: AnimatedGradientBorderProps) {
  const borderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!borderRef.current) return

    const element = borderRef.current
    const colorStops = colors.map((color, i) => `${color} ${(i / (colors.length - 1)) * 100}%`).join(", ")

    element.style.setProperty("--gradient-colors", colorStops)
    element.style.setProperty("--animation-duration", `${duration}s`)
  }, [colors, duration])

  return (
    <div
      ref={borderRef}
      className={`relative rounded-lg ${className}`}
      style={{
        padding: `${borderWidth}px`,
        background: `linear-gradient(90deg, var(--gradient-colors))`,
        backgroundSize: "200% 100%",
        animation: `gradient-shift var(--animation-duration) linear infinite`,
      }}
    >
      <style jsx>{`
        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }
      `}</style>
      <div className="relative rounded-lg bg-zinc-900 h-full">{children}</div>
    </div>
  )
}
