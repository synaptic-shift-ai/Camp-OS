"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useProperty } from "@/components/property-context"
import { SetupModal } from "./setup-modal"
import { LimitedDashboardBanner } from "./limited-dashboard-banner"

const MODAL_SEEN_KEY = "campos_setup_modal_seen"

export function SetupCheckGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { hasIncompleteSetup, incompleteProperties, isLoading, selectedProperty } = useProperty()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (isLoading) return

    // Only show modal if:
    // 1. User has incomplete setup
    // 2. Haven't seen the modal before (or cleared localStorage)
    if (hasIncompleteSetup) {
      const hasSeenModal = localStorage.getItem(MODAL_SEEN_KEY) === "true"
      if (!hasSeenModal) {
        setShowModal(true)
      }
    }
  }, [hasIncompleteSetup, isLoading])

  const handleStartSetup = () => {
    // Mark modal as seen
    localStorage.setItem(MODAL_SEEN_KEY, "true")
    setShowModal(false)

    // Navigate to wizard with first incomplete property
    const firstIncompleteProperty = incompleteProperties[0]
    if (firstIncompleteProperty) {
      router.push(`/dashboard/sites?wizard=true&propertyId=${firstIncompleteProperty.id}`)
    }
  }

  const handleDismissModal = () => {
    // Mark as seen but don't start setup
    localStorage.setItem(MODAL_SEEN_KEY, "true")
    setShowModal(false)
  }

  const handleCompleteSetup = () => {
    // Navigate to wizard with current property or first incomplete
    const targetProperty = selectedProperty && !selectedProperty.onboarding_completed
      ? selectedProperty
      : incompleteProperties[0]

    if (targetProperty) {
      router.push(`/dashboard/sites?wizard=true&propertyId=${targetProperty.id}`)
    }
  }

  return (
    <>
      {/* Setup Welcome Modal */}
      {showModal && (
        <SetupModal
          open={showModal}
          onStartSetup={handleStartSetup}
          onDismiss={handleDismissModal}
          properties={incompleteProperties}
        />
      )}

      {/* Dashboard Content with Limited Access Indicator */}
      {hasIncompleteSetup ? (
        <div className="relative">
          {/* Banner at top of dashboard */}
          <LimitedDashboardBanner
            incompleteCount={incompleteProperties.length}
            onCompleteSetup={handleCompleteSetup}
          />

          {/* Dashboard content - still accessible but with banner */}
          <div className="mt-4">
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </>
  )
}
