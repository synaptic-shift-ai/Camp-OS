"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  isHtmlDocumentShell,
  renderWithSampleData,
} from "@/lib/email/template-renderer"

type EmailTemplatePreviewProps = {
  template: Record<string, unknown>
}

const PREVIEW_WRAP_STYLES = `<style id="camp-os-preview-wrap">
  html, body {
    margin: 0;
    padding: 0;
    overflow-x: hidden !important;
    max-width: 100% !important;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  pre, code {
    white-space: pre-wrap !important;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    word-break: break-word;
    max-width: 100%;
  }
  img {
    max-width: 100% !important;
    height: auto !important;
  }
  table {
    max-width: 100%;
  }
  p, div, span, li, td, th, a, h1, h2, h3, h4, h5, h6 {
    overflow-wrap: anywhere;
    word-break: break-word;
    max-width: 100%;
  }
</style>`

function ensureResponsiveViewport(html: string): string {
  if (!html.trim()) return html

  const viewport =
    '<meta name="viewport" content="width=device-width, initial-scale=1">'
  const headInjection = `${viewport}${PREVIEW_WRAP_STYLES}`

  if (isHtmlDocumentShell(html)) {
    const withoutPreviewStyles = html.replace(
      /<style id="camp-os-preview-wrap">[\s\S]*?<\/style>/i,
      "",
    )
    const withViewport = /<meta[^>]+name=["']viewport["']/i.test(
      withoutPreviewStyles,
    )
      ? withoutPreviewStyles
      : withoutPreviewStyles.replace(
          /<head([^>]*)>/i,
          `<head$1>${viewport}`,
        )
    return withViewport.replace(
      /<head([^>]*)>/i,
      `<head$1>${PREVIEW_WRAP_STYLES}`,
    )
  }

  return `<!DOCTYPE html><html><head>${headInjection}</head><body>${html}</body></html>`
}

export function EmailTemplatePreview({ template }: EmailTemplatePreviewProps) {
  const rawHtml = (template.html_template as string) ?? ""
  const rawSubject = (template.subject_template as string) ?? ""
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeHeight, setIframeHeight] = useState(400)

  const { srcDoc, renderedSubject } = useMemo(() => {
    const { html, subject } = renderWithSampleData(rawSubject, rawHtml)
    return {
      srcDoc: ensureResponsiveViewport(html),
      renderedSubject: subject,
    }
  }, [rawHtml, rawSubject])

  const measureIframeHeight = () => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return
    const body = doc.body
    const html = doc.documentElement
    const next = Math.max(
      200,
      Math.ceil(Math.max(body?.scrollHeight ?? 0, html?.scrollHeight ?? 0)),
    )
    setIframeHeight(next)
  }

  useEffect(() => {
    measureIframeHeight()
  }, [srcDoc])

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <p className="break-words text-xs leading-relaxed text-muted-foreground">
        <span>Subject: </span>
        <span className="font-medium text-foreground">{renderedSubject}</span>
      </p>

      <div className="w-full min-w-0 overflow-hidden rounded-md border border-border bg-[#f6f9fc]">
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          sandbox="allow-same-origin"
          title="Email Preview"
          className="block w-full min-w-0 max-w-full border-0 bg-white"
          style={{ height: `${iframeHeight}px` }}
          onLoad={measureIframeHeight}
        />
      </div>
    </div>
  )
}
