"use client"

import { useMemo } from "react"
import {
  extractEmailSettings,
  stripEmailSettings,
  DEFAULT_EMAIL_SETTINGS,
} from "@/lib/email/template-renderer"

type EmailSettings = { width: string; bgColor: string; centered: boolean }

type EmailTemplatePreviewProps = {
  template: Record<string, unknown>
}

export function EmailTemplatePreview({ template }: EmailTemplatePreviewProps) {
  const rawHtml = (template.html_template as string) ?? ""
  const rawSubject = (template.subject_template as string) ?? ""

  const srcDoc = useMemo(() => {
    const settings: EmailSettings = extractEmailSettings(rawHtml) ?? DEFAULT_EMAIL_SETTINGS
    const content = stripEmailSettings(rawHtml)

    const wrapperStyles: string[] = []
    if (settings.width !== "full") {
      wrapperStyles.push(`max-width:${settings.width}px`)
    }
    wrapperStyles.push(`background-color:${settings.bgColor}`)
    if (settings.centered) {
      wrapperStyles.push("margin-left:auto")
      wrapperStyles.push("margin-right:auto")
    }
    wrapperStyles.push("padding:24px")
    wrapperStyles.push("font-family:sans-serif")
    wrapperStyles.push("box-shadow:0 1px 3px rgba(0,0,0,0.1)")

    return `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family:sans-serif; margin:0; padding:16px; background:#f3f4f6; }
  img { max-width:100%; }
</style>
</head>
<body>
<div style="${wrapperStyles.join(";")}">
${content}
</div>
</body>
</html>`
  }, [rawHtml])

  return (
    <div className="space-y-3">
      {/* Subject */}
      <div className="text-xs text-muted-foreground">
        Subject: <span className="font-medium text-foreground">{rawSubject}</span>
      </div>

      {/* iframe preview */}
      <div className="overflow-hidden rounded-md border border-border/80 bg-gray-100">
        <iframe
          srcDoc={srcDoc}
          sandbox="allow-same-origin"
          title="Email Preview"
          className="h-[500px] w-full border-0"
        />
      </div>
    </div>
  )
}
