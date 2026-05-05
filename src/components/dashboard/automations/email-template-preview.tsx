"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  DEFAULT_EMAIL_SETTINGS,
  extractEmailSettings,
  renderWithSampleData,
} from "@/lib/email/template-renderer"

type EmailTemplatePreviewProps = {
  template: Record<string, unknown>
}

export function EmailTemplatePreview({ template }: EmailTemplatePreviewProps) {
  const rawHtml = (template.html_template as string) ?? ""
  const rawSubject = (template.subject_template as string) ?? ""
  const previewBg = extractEmailSettings(rawHtml)?.bgColor ?? DEFAULT_EMAIL_SETTINGS.bgColor
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeHeight, setIframeHeight] = useState(500)

  const { srcDoc, renderedSubject } = useMemo(() => {
    const { html, subject } = renderWithSampleData(rawSubject, rawHtml)
    return { srcDoc: html, renderedSubject: subject }
  }, [rawHtml, rawSubject])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return
    const body = doc.body
    const html = doc.documentElement
    const next = Math.max(
      320,
      Math.ceil(Math.max(body?.scrollHeight ?? 0, html?.scrollHeight ?? 0)),
    )
    setIframeHeight(next)
  }, [srcDoc])

  return (
    <div className="space-y-3">
      {/* Subject */}
      <div className="text-xs text-muted-foreground">
        Subject: <span className="font-medium text-foreground">{renderedSubject}</span>
      </div>

      {/* iframe preview */}
      <div
        className="overflow-hidden rounded-md border border-border/80"
        style={{ backgroundColor: previewBg }}
      >
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          sandbox="allow-same-origin"
          title="Email Preview"
          className="w-full border-0"
          style={{ backgroundColor: previewBg, height: `${iframeHeight}px` }}
          onLoad={() => {
            const iframe = iframeRef.current
            if (!iframe) return
            const doc = iframe.contentDocument
            if (!doc) return
            const body = doc.body
            const html = doc.documentElement
            const next = Math.max(
              320,
              Math.ceil(Math.max(body?.scrollHeight ?? 0, html?.scrollHeight ?? 0)),
            )
            setIframeHeight(next)
          }}
        />
      </div>
    </div>
  )
}
