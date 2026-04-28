'use client'

/**
 * Install Prompt Component
 *
 * Detects the PWA beforeinstallprompt event and displays an install button.
 * Allows users to add the app to their home screen on supported browsers.
 */

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the default mini-infobar on mobile
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsDismissed(true)
      }
    } catch {
      // User may have dismissed the prompt
      setDeferredPrompt(null)
    }
  }, [deferredPrompt])

  const handleDismiss = () => {
    setIsDismissed(true)
  }

  if (!deferredPrompt || isDismissed) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-card p-3 shadow-lg">
      <div className="flex-1">
        <p className="text-sm font-medium">Install App</p>
        <p className="text-xs text-muted-foreground">
          Add CampStack to your home screen for quick access.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        className="gap-2"
        onClick={() => void handleInstall()}
      >
        <Download className="h-4 w-4" />
        Install
      </Button>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Dismiss install prompt"
      >
        ×
      </button>
    </div>
  )
}
