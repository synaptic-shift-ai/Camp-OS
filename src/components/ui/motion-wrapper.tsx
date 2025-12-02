"use client"

import type { ReactNode } from "react"
import { useState, useEffect } from "react"
import { motion, type HTMLMotionProps } from "framer-motion"

interface MotionDivProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children?: ReactNode
}

/**
 * Hydration-safe wrapper for framer-motion components.
 * Prevents React hydration error #418 by deferring animation render
 * until after client mount.
 */
export function MotionDiv({ children, className, ...props }: MotionDivProps) {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Render a plain div on server and first client render to match
  if (!isHydrated) {
    return (
      <div className={className as string}>
        {children}
      </div>
    )
  }

  return <motion.div className={className} {...props}>{children}</motion.div>
}
