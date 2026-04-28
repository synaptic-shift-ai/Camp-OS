'use client'

import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShowPrompt(false)
    setDeferredPrompt(null)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border bg-white p-4 shadow-lg md:hidden">
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Install CampOS</p>
          <p className="text-xs text-muted-foreground">
            Add to your home screen for quick access to housekeeping tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPrompt(false)}
          className="shrink-0 rounded p-1 hover:bg-muted"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Install App
      </button>
    </div>
  )
}
