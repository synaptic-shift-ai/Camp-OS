import type { ReactNode } from "react"

type LayoutProps = {
  children: ReactNode
}

/**
 * Full-viewport shell for campaign create/edit — avoids dashboard main scroll
 * (parent main uses overflow-y-auto + p-6).
 */
export default function CampaignsEditorLayout({ children }: LayoutProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-10 flex flex-col overflow-y-auto bg-background lg:top-0 lg:left-64 lg:overflow-hidden">
      {children}
    </div>
  )
}
