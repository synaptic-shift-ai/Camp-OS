"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { UnsavedChangesDialog, UnsavedChangesSavingOverlay } from "@/components/unsaved-changes-dialog"

interface UseUnsavedChangesGuardOptions {
  onSave?: () => Promise<void> | void
  message?: string
}

interface UseUnsavedChangesGuardReturn {
  UnsavedChangesDialog: React.FC
  markClean: () => void
  /** Call before programmatic navigation after a successful save so history guards do not block it. */
  beginIntentionalNavigation: () => void
  requestNavigation: (navigate: () => void) => void
}

export function useUnsavedChangesGuard(
  isDirty: boolean,
  options?: UseUnsavedChangesGuardOptions
): UseUnsavedChangesGuardReturn {
  const { onSave, message = "You have unsaved changes. Would you like to save before leaving?" } = options ?? {}

  const [showDialog, setShowDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const isSavingRef = useRef(false)
  const pendingNavigationRef = useRef<(() => void) | null>(null)
  const isIntentionalNavigationRef = useRef(false)
  const pushedHistoryEntryRef = useRef(false)

  const shouldBlockNavigation = useCallback(() => {
    return !isIntentionalNavigationRef.current && !isSavingRef.current
  }, [])

  const showNavigationDialog = useCallback(() => {
    if (shouldBlockNavigation()) {
      setShowDialog(true)
    }
  }, [shouldBlockNavigation])

  // ── beforeunload ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return
    const handler = (event: BeforeUnloadEvent) => {
      // Save & leave / discard already persisted — skip native "Leave site?" prompt
      if (isIntentionalNavigationRef.current) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  // ── popstate / pushState ──────────────────────────────────────────────
  useEffect(() => {
    if (isDirty) {
      // Push an extra history entry so browser back doesn't leave the page
      window.history.pushState(null, "", window.location.href)
      pushedHistoryEntryRef.current = true
    } else if (pushedHistoryEntryRef.current) {
      // isDirty flipped back to false — remove the phantom entry once (skip during save & leave / discard nav)
      pushedHistoryEntryRef.current = false
      if (!isIntentionalNavigationRef.current) {
        window.history.back()
      }
    }

    if (!isDirty) return

    const handlePopState = () => {
      if (!shouldBlockNavigation()) return

      // Push another entry to prevent actual back navigation
      window.history.pushState(null, "", window.location.href)

      // Show dialog with no pending nav — discard will go back
      pendingNavigationRef.current = null
      showNavigationDialog()
    }

    window.addEventListener("popstate", handlePopState)
    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [isDirty, showNavigationDialog, shouldBlockNavigation])

  // ── Document click capture — intercept in-app link clicks ────────────
  useEffect(() => {
    if (!isDirty) return

    const handleClick = (e: MouseEvent) => {
      if (!shouldBlockNavigation()) return

      const target = (e.target as HTMLElement).closest("a")
      if (!target) return

      const href = target.getAttribute("href")
      if (!href || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) return
      if (href.startsWith("#") || href === window.location.pathname) return

      e.preventDefault()
      e.stopPropagation()
      pendingNavigationRef.current = () => {
        window.location.href = href
      }
      showNavigationDialog()
    }

    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [isDirty, shouldBlockNavigation, showNavigationDialog])

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleDiscard = useCallback(() => {
    isIntentionalNavigationRef.current = true
    setShowDialog(false)

    const nav = pendingNavigationRef.current
    pendingNavigationRef.current = null

    if (nav) {
      // Execute after one frame so the dialog close doesn't re-trigger guards
      requestAnimationFrame(() => {
        nav()
      })
    } else {
      // Browser back — popstate listener will ignore due to intentional flag
      requestAnimationFrame(() => {
        window.history.back()
      })
    }
  }, [])

  const handleSaveAndLeave = useCallback(async () => {
    isIntentionalNavigationRef.current = true
    isSavingRef.current = true
    setIsSaving(true)
    setShowDialog(false)

    try {
      await onSave?.()
      const nav = pendingNavigationRef.current
      pendingNavigationRef.current = null

      if (nav) {
        requestAnimationFrame(() => {
          nav()
        })
      } else {
        requestAnimationFrame(() => {
          window.history.back()
        })
      }
    } catch {
      // Caller handles error toast — allow beforeunload again on failed save
      isIntentionalNavigationRef.current = false
      isSavingRef.current = false
      setIsSaving(false)
    }
  }, [onSave])

  const markClean = useCallback(() => {
    setShowDialog(false)
    pendingNavigationRef.current = null
  }, [])

  const beginIntentionalNavigation = useCallback(() => {
    isIntentionalNavigationRef.current = true
    setShowDialog(false)
    pendingNavigationRef.current = null
  }, [])

  // ── Dialog component ─────────────────────────────────────────────────
  const DialogComponent = useMemo(() => {
    const Comp: React.FC = () => (
      <>
        <UnsavedChangesDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          message={message}
          onDiscard={handleDiscard}
          {...(onSave ? { onSaveAndLeave: handleSaveAndLeave } : {})}
          isSaving={isSaving}
        />
        <UnsavedChangesSavingOverlay visible={isSaving} />
      </>
    )
    Comp.displayName = "UnsavedChangesDialogGuard"
    return Comp
  }, [showDialog, message, handleDiscard, handleSaveAndLeave, onSave, isSaving])

  const requestNavigation = useCallback((navigate: () => void) => {
    if (!isDirty) {
      navigate()
      return
    }
    if (!shouldBlockNavigation()) {
      return
    }
    pendingNavigationRef.current = navigate
    showNavigationDialog()
  }, [isDirty, shouldBlockNavigation, showNavigationDialog])

  return {
    UnsavedChangesDialog: DialogComponent,
    markClean,
    beginIntentionalNavigation,
    requestNavigation,
  }
}
