"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Compass } from "lucide-react"
import { DashboardTour } from "@/components/dashboard/setup-wizard/dashboard-tour"

function QuickTourPromptContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [quickTourCompleted, setQuickTourCompleted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchStatus() {
      try {
        const res = await fetch("/api/onboarding/quick-tour-status")
        const data = res.ok ? await res.json() : { quickTourCompleted: false }
        if (!cancelled) {
          setQuickTourCompleted(Boolean(data.quickTourCompleted))
        }
      } catch {
        if (!cancelled) setQuickTourCompleted(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStatus()
    return () => {
      cancelled = true
    }
  }, [])

  const clearQuickTourParam = () => {
    const url = new URL(window.location.href)
    if (url.searchParams.get("quick_tour") === "1") {
      url.searchParams.delete("quick_tour")
      router.replace(url.pathname + url.search, { scroll: false })
    }
  }

  const markCompleted = async () => {
    try {
      await fetch("/api/onboarding/quick-tour-status", { method: "PATCH" })
      setQuickTourCompleted(true)
    } catch {
      // still hide locally on error
      setQuickTourCompleted(true)
    }
    clearQuickTourParam()
  }

  const handleStartTour = () => {
    setOpen(true)
  }

  const handleCloseDialog = () => {
    setOpen(false)
    clearQuickTourParam()
  }

  const handleCompleteOrSkip = () => {
    markCompleted()
    setOpen(false)
  }

  const handleMaybeLater = () => {
    markCompleted()
  }

  if (loading || quickTourCompleted) return null

  // Show alert on every dashboard visit until user completes or dismisses (persisted in DB)
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Compass className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">You&apos;re all set!</p>
            <p className="text-sm text-muted-foreground">
              Take a quick tour to learn where everything is on your dashboard.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleMaybeLater}>
            Maybe later
          </Button>
          <Button size="sm" onClick={handleStartTour}>
            Start quick tour
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCloseDialog()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick tour</DialogTitle>
          </DialogHeader>
          <DashboardTour
            onComplete={handleCompleteOrSkip}
            onSkip={handleCompleteOrSkip}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

export function QuickTourPrompt() {
  return (
    <Suspense fallback={null}>
      <QuickTourPromptContent />
    </Suspense>
  )
}
