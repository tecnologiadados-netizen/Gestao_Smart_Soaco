"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { UI_TRANSITION_MS } from "@/lib/motion"

export function useTransitionRouter() {
  const router = useRouter()
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const push = useCallback(
    (href: string, options?: { delay?: number; animateExit?: boolean }) => {
      const delay = options?.delay ?? UI_TRANSITION_MS
      const animateExit = options?.animateExit ?? true

      if (timerRef.current) clearTimeout(timerRef.current)
      if (animateExit) setExiting(true)

      timerRef.current = setTimeout(() => {
        router.push(href)
        setExiting(false)
        timerRef.current = null
      }, delay)
    },
    [router]
  )

  return { push, exiting, router }
}
