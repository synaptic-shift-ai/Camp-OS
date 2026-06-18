"use client"

import {
  useRef,
  useCallback,
  useEffect,
  useState,
  Fragment,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
} from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { VARIABLE_GROUPS } from "@/lib/email/variable-definitions"
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link,
  ImageIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Braces,
  Type,
  Code,
  CodeXml,
  Table,
  SquarePlus,
  MousePointerClick,
  Trash2,
  Undo2,
  Redo2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { isFullEmailDocument } from "@/lib/email/template-renderer"

// ============================================================================
// Types
// ============================================================================

export type RichEditorHandle = {
  insertVariable: (text: string) => void
}

type RichEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  /** Rendered at the right end of the email settings bar (e.g. mobile variables trigger) */
  toolbarEnd?: ReactNode
}

type EmailAlign = "left" | "center" | "right"

type EmailSettings = {
  width: string
  bgColor: string
  centered: boolean
  align: EmailAlign
}

// ============================================================================
// Constants
// ============================================================================

const FONT_SIZES = [
  { value: "1", label: "Small" },
  { value: "3", label: "Normal" },
  { value: "5", label: "Large" },
  { value: "7", label: "Heading" },
]

type FontOption = { name: string; family: string; isGoogle?: boolean }
type FontGroup = { label: string; fonts: FontOption[] }

const FONT_GROUPS: FontGroup[] = [
  {
    label: "System Fonts",
    fonts: [
      { name: "Default", family: "sans-serif" },
      { name: "Arial", family: "Arial, sans-serif" },
      { name: "Helvetica", family: "Helvetica, sans-serif" },
      { name: "Georgia", family: "Georgia, serif" },
      { name: "Times New Roman", family: "'Times New Roman', serif" },
      { name: "Courier New", family: "'Courier New', monospace" },
      { name: "Verdana", family: "Verdana, sans-serif" },
      { name: "Tahoma", family: "Tahoma, sans-serif" },
    ],
  },
  {
    label: "Sans-serif",
    fonts: [
      { name: "Inter", family: "'Inter', sans-serif", isGoogle: true },
      { name: "Roboto", family: "'Roboto', sans-serif", isGoogle: true },
      { name: "Open Sans", family: "'Open Sans', sans-serif", isGoogle: true },
      { name: "Lato", family: "'Lato', sans-serif", isGoogle: true },
      { name: "Montserrat", family: "'Montserrat', sans-serif", isGoogle: true },
      { name: "Poppins", family: "'Poppins', sans-serif", isGoogle: true },
      { name: "Raleway", family: "'Raleway', sans-serif", isGoogle: true },
      { name: "Nunito", family: "'Nunito', sans-serif", isGoogle: true },
      { name: "Ubuntu", family: "'Ubuntu', sans-serif", isGoogle: true },
    ],
  },
  {
    label: "Serif",
    fonts: [
      { name: "Playfair Display", family: "'Playfair Display', serif", isGoogle: true },
      { name: "Merriweather", family: "'Merriweather', serif", isGoogle: true },
      { name: "Lora", family: "'Lora', serif", isGoogle: true },
      { name: "Crimson Text", family: "'Crimson Text', serif", isGoogle: true },
      { name: "Libre Baskerville", family: "'Libre Baskerville', serif", isGoogle: true },
      { name: "DM Serif Display", family: "'DM Serif Display', serif", isGoogle: true },
    ],
  },
  {
    label: "Display & Other",
    fonts: [
      { name: "Dancing Script", family: "'Dancing Script', cursive", isGoogle: true },
      { name: "Pacifico", family: "'Pacifico', cursive", isGoogle: true },
      { name: "Oswald", family: "'Oswald', sans-serif", isGoogle: true },
      { name: "Bebas Neue", family: "'Bebas Neue', sans-serif", isGoogle: true },
      { name: "Josefin Sans", family: "'Josefin Sans', sans-serif", isGoogle: true },
      { name: "Work Sans", family: "'Work Sans', sans-serif", isGoogle: true },
    ],
  },
]

/** All Google fonts flattened (for pre-loading) */
const GOOGLE_FONTS = FONT_GROUPS.flatMap((g) => g.fonts).filter((f) => f.isGoogle)

/** Insert a Google Fonts <link> tag into <head> if not already present */
const loadedFontNames = new Set<string>()
function loadGoogleFont(fontName: string) {
  if (loadedFontNames.has(fontName)) return
  const encoded = fontName.replace(/ /g, '+')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,400;0,700;1,400&display=swap`
  link.setAttribute('data-google-font', fontName)
  document.head.appendChild(link)
  loadedFontNames.add(fontName)
}

/** Find a font option by its family string */
function findFontByFamily(family: string): FontOption | undefined {
  return FONT_GROUPS.flatMap((g) => g.fonts).find((f) => f.family === family)
}

function normalizeEmailAlign(settings: Partial<EmailSettings> | null | undefined): EmailAlign {
  const align = settings?.align
  if (align === "left" || align === "center" || align === "right") return align
  return settings?.centered === false ? "left" : "center"
}

function normalizeEmailSettings(settings: Partial<EmailSettings> | null | undefined): EmailSettings {
  const align = normalizeEmailAlign(settings)
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    align,
    centered: align === "center",
  }
}

const DEFAULT_SETTINGS: EmailSettings = {
  width: "600",
  bgColor: "#ffffff",
  centered: true,
  align: "center",
}

// ============================================================================
// Helpers
// ============================================================================

/** Extract email settings from existing HTML (returns null if not found) */
function extractSettings(html: string): EmailSettings | null {
  const match = html.match(/<!--email-settings:(.*?)-->/)
  if (!match) return null
  const encoded = match[1]
  if (!encoded) return null
  try {
    const decoded = atob(encoded)
    return normalizeEmailSettings(JSON.parse(decoded) as Partial<EmailSettings>)
  } catch {
    return null
  }
}

/** Infer settings from legacy templates that don't have embedded settings metadata. */
function inferSettingsFromHtml(html: string): Partial<EmailSettings> | null {
  const source = html || ""

  // Prefer the outer email canvas/background over inner card/table colors.
  const bgMatch =
    source.match(/<body[^>]*\sbgcolor\s*=\s*["']([^"']+)["']/i) ??
    source.match(/<body[^>]*\sstyle\s*=\s*["'][^"']*background(?:-color)?\s*:\s*([^;"']+)/i) ??
    source.match(/<table[^>]*(?:width\s*=\s*["']100%["'][^>]*\sbgcolor\s*=\s*["']([^"']+)["']|\sbgcolor\s*=\s*["']([^"']+)["'][^>]*width\s*=\s*["']100%["'])/i) ??
    source.match(/html\s*,\s*body\s*\{[^}]*background(?:-color)?\s*:\s*([^;!}]+)/i) ??
    source.match(/background-color\s*:\s*([^;"'>]+)/i) ??
    source.match(/bgcolor\s*=\s*["']([^"']+)["']/i)
  const bgColor = (bgMatch?.[1] ?? bgMatch?.[2])?.trim()

  // Width can be declared as table width="600" or style max-width/width.
  const widthMatch =
    source.match(/<table[^>]+width\s*=\s*["'](\d{3,4}|100%)["']/i) ??
    source.match(/max-width\s*:\s*(\d{3,4})px/i) ??
    source.match(/width\s*:\s*(\d{3,4})px/i)
  const widthRaw = widthMatch?.[1]?.trim()
  const width =
    widthRaw === "100%"
      ? "full"
      : widthRaw && /^\d{3,4}$/.test(widthRaw)
        ? widthRaw
        : undefined

  const inferred: Partial<EmailSettings> = {}
  if (bgColor) inferred.bgColor = bgColor
  if (width) inferred.width = width

  return Object.keys(inferred).length > 0 ? inferred : null
}

function resolveSettingsFromHtml(html: string, saved: EmailSettings | null): EmailSettings {
  const inferred = inferSettingsFromHtml(html)
  if (isFullEmailDocument(html) && inferred) {
    return normalizeEmailSettings({ ...saved, ...inferred })
  }
  return normalizeEmailSettings(saved ?? inferred)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Rewrite legacy shell background color in full-template HTML. */
function applyLegacyShellBg(html: string, bgColor: string): string {
  const inferredBg = inferSettingsFromHtml(html)?.bgColor
  const candidates = Array.from(
    new Set(
      [inferredBg, "#f6f9fc"]
        .filter((v): v is string => Boolean(v))
        .map((v) => v.toLowerCase())
    )
  )

  let next = html
  for (const candidate of candidates) {
    const esc = escapeRegExp(candidate)
    next = next
      .replace(new RegExp(`background-color\\s*:\\s*${esc}`, "gi"), `background-color:${bgColor}`)
      .replace(new RegExp(`background\\s*:\\s*${esc}`, "gi"), `background:${bgColor}`)
      .replace(new RegExp(`bgcolor\\s*=\\s*["']${esc}["']`, "gi"), `bgcolor="${bgColor}"`)
  }
  return next
}

function applyLegacyShellAlign(html: string, align: EmailAlign): string {
  const margin = align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0 auto 0 0"
  let next = html
  next = next.replace(
    /<table\b(?=[^>]*max-width\s*:\s*\d+px)(?![^>]*\salign=)/i,
    (match) => `${match} align="${align}"`,
  )
  next = next.replace(
    /(<table\b(?=[^>]*max-width\s*:\s*\d+px)[^>]*\salign=)["'](?:left|center|right)["']/i,
    `$1"${align}"`,
  )
  next = next.replace(
    /(<table\b(?=[^>]*max-width\s*:\s*\d+px)[^>]*style=["'][^"']*)margin\s*:\s*0\s+auto([^"']*["'])/i,
    `$1margin:${margin}$2`,
  )
  return next
}


/** Strip settings comment from HTML */
export function stripSettings(html: string): string {
  return html.replace(/<!--email-settings:.*?-->\s*/, "")
}

/** Wrap content HTML with email settings (stored as hidden comment) */
function wrapWithSettings(content: string, settings: EmailSettings): string {
  const encoded = btoa(JSON.stringify(settings))
  return `<!--email-settings:${encoded}-->${content}`
}

// ----------------------------------------------------------------------------
// Document-shell extraction (for visual editing of full <!DOCTYPE html> templates)
// ----------------------------------------------------------------------------

/** Placeholder embedded in the original document shell where the editable body lives. */
const DOCUMENT_BODY_PLACEHOLDER = "<!--__camp_os_editable_body__-->"
const TBODY_MERGE_ATTR = "data-camp-os-tbody-merge"

function buildTbodyMergePlaceholder(tag: string): string {
  return `<tr ${TBODY_MERGE_ATTR}="true"><td colspan="99" style="padding:10px 12px;color:#52525b;background-color:#fafafa;font-family:monospace;font-size:12px;line-height:18px;">${tag}</td></tr>`
}

function protectTbodyMergeTags(html: string): string {
  const normalized = repairTbodyMergePlacement(html)
  return normalized.replace(/(<tbody\b[^>]*>)([\s\S]*?)(<\/tbody>)/gi, (_match, open: string, inner: string, close: string) => {
    const protectedInner = inner.replace(
      /(^|<\/tr\s*>\s*)\s*(\{\{[^}]+\}\})(\s*)(?=<tr\b|$)/gi,
      (_innerMatch, prefix: string, tag: string, suffix: string) =>
        `${prefix}${buildTbodyMergePlaceholder(tag)}${suffix}`,
    )
    return `${open}${protectedInner}${close}`
  })
}

function repairTbodyMergePlacement(html: string): string {
  let next = html
  for (let i = 0; i < 3; i += 1) {
    const repaired = next
      .replace(
        /(\{\{[\w.]+_html\}\})(\s*<table\b[^>]*>[\s\S]*?<thead\b[\s\S]*?<\/thead>\s*<tbody\b[^>]*>)\s*(<\/tbody>)/gi,
        "$2$1$3",
      )
      .replace(
        /(\{\{[\w.]+_html\}\})(\s*<thead\b[\s\S]*?<\/thead>\s*<tbody\b[^>]*>)\s*(<\/tbody>)/gi,
        "$2$1$3",
      )
      .replace(
        /(\{\{[\w.]+_html\}\})(\s*<table\b[^>]*>[\s\S]*?<tbody\b[^>]*>\s*<tr\b(?=[^>]*>[\s\S]*?<th\b)[\s\S]*?<\/tr>)/gi,
        "$2$1",
      )
      .replace(
        /(\{\{[\w.]+_html\}\})(\s*<tbody\b[^>]*>\s*<tr\b(?=[^>]*>[\s\S]*?<th\b)[\s\S]*?<\/tr>)/gi,
        "$2$1",
      )
      .replace(
        /(<\/thead>\s*)(\{\{[\w.]+_html\}\})(\s*<tbody\b[^>]*>)\s*(<\/tbody>)/gi,
        "$1$3$2$4",
      )
      .replace(
        /(<tbody\b[^>]*>)\s*(<\/tbody>)\s*(\{\{[\w.]+_html\}\})/gi,
        "$1$3$2",
      )
    if (repaired === next) break
    next = repaired
  }
  return next
}

function restoreTbodyMergePlaceholders(html: string): string {
  const restored = html
    .replace(
      new RegExp(`<tbody\\b([^>]*)>\\s*<tr\\b(?=[^>]*${TBODY_MERGE_ATTR}=["']true["'])[^>]*>[\\s\\S]*?(\\{\\{[^}]+\\}\\})[\\s\\S]*?<\\/tr>\\s*<\\/tbody>`, "gi"),
      "<tbody$1>$2</tbody>",
    )
    .replace(
      new RegExp(`<tr\\b(?=[^>]*${TBODY_MERGE_ATTR}=["']true["'])[^>]*>[\\s\\S]*?(\\{\\{[^}]+\\}\\})[\\s\\S]*?<\\/tr>`, "gi"),
      "$1",
    )
  return repairTbodyMergePlacement(restored)
}

/** True when the HTML opens with a full document shell (DOCTYPE / <html>). */
function isHtmlDocumentShell(html: string): boolean {
  const t = html.trimStart()
  return /^<!DOCTYPE\s+html/i.test(t) || /^<html[\s>]/i.test(t)
}

/**
 * Foster-parenting hazard: a merge tag as the first child of <tbody> is invalid
 * HTML and gets reparented outside the table by contentEditable, corrupting the
 * template. We protect those merge tags with temporary editable rows.
 */
function hasMalformedTbodyMergeTag(_html: string): boolean {
  return false
}

/**
 * Parse a full HTML document, extracting the body's inner HTML and a "shell"
 * string with a placeholder where the body content originally was. The shell is
 * later reassembled via `reconstructWithShell` so the document <head>, <style>,
 * and outer body wrapping are preserved across edits.
 */
function parseDocumentShell(
  html: string,
): { bodyContent: string; shell: string } | null {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return null
  }
  if (!isHtmlDocumentShell(html)) return null

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(protectTbodyMergeTags(html), "text/html")
    const body = doc.body
    if (!body) return null

    const bodyContent = body.innerHTML
    body.innerHTML = DOCUMENT_BODY_PLACEHOLDER

    const doctype = doc.doctype
      ? `<!DOCTYPE ${doc.doctype.name}>`
      : "<!DOCTYPE html>"
    const shell = doctype + doc.documentElement.outerHTML

    return { bodyContent, shell }
  } catch {
    return null
  }
}

/** Insert edited body content back into the original document shell. */
function reconstructWithShell(bodyContent: string, shell: string): string {
  return shell.replace(DOCUMENT_BODY_PLACEHOLDER, bodyContent)
}

// ----------------------------------------------------------------------------
// CTA button helpers
// ----------------------------------------------------------------------------

/** Marker attribute used to reliably identify buttons we create. */
const CTA_BUTTON_ATTR = "data-cta-button"

const DEFAULT_BUTTON_BG = "#2563eb"
const DEFAULT_BUTTON_FG = "#ffffff"
const DEFAULT_BUTTON_GRADIENT_FROM = "#ef4444"
const DEFAULT_BUTTON_GRADIENT_TO = "#ec4899"

type ButtonBgMode = "solid" | "gradient"

const DEFAULT_BUTTON_PREVIEW_STYLE: React.CSSProperties = {
  display: "inline-block",
  background: DEFAULT_BUTTON_BG,
  color: DEFAULT_BUTTON_FG,
  padding: "12px 28px",
  borderRadius: "6px",
  fontWeight: 600,
  fontSize: "15px",
  fontFamily: "sans-serif",
  lineHeight: 1,
  textDecoration: "none",
}

function buildButtonBackground(
  mode: ButtonBgMode,
  solidColor: string,
  gradientFrom: string,
  gradientTo: string,
): string {
  return mode === "gradient"
    ? `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`
    : solidColor
}

/** Build the inline-style string for a CTA button (email-safe). */
function buildButtonStyle(
  bgColor: string,
  textColor: string,
  bgMode: ButtonBgMode = "solid",
  gradientFrom = DEFAULT_BUTTON_GRADIENT_FROM,
  gradientTo = DEFAULT_BUTTON_GRADIENT_TO,
): string {
  const background = buildButtonBackground(bgMode, bgColor, gradientFrom, gradientTo)

  return [
    "display:inline-block",
    bgMode === "gradient" ? `background:${background}` : `background-color:${background}`,
    `color:${textColor}`,
    "padding:12px 28px",
    "border-radius:6px",
    "text-decoration:none",
    "font-weight:600",
    "font-size:15px",
    "font-family:sans-serif",
    "line-height:1",
    "mso-padding-alt:0",
  ].join(";") + ";"
}

/** True when an element is an <a> we should treat as a CTA button. */
function isButtonAnchor(el: Element | null): el is HTMLAnchorElement {
  if (!el || el.tagName !== "A") return false
  const a = el as HTMLAnchorElement
  if (a.getAttribute(CTA_BUTTON_ATTR) === "true") return true
  // Heuristic for legacy template buttons: inline-block <a> with a
  // background color and padding (matches typical email CTA styling).
  const style = a.getAttribute("style") ?? ""
  return (
    /display\s*:\s*inline-block/i.test(style) &&
    /padding\s*:/i.test(style) &&
    /background(-color)?\s*:/i.test(style)
  )
}

/** Walk up from `target` until we find a CTA-button anchor inside `root`. */
function findEnclosingButton(
  target: EventTarget | null,
  root: HTMLElement | null,
): HTMLAnchorElement | null {
  if (!root) return null
  let el = target as Node | null
  while (el && el !== root) {
    if (el.nodeType === 1 && isButtonAnchor(el as Element)) {
      return el as HTMLAnchorElement
    }
    el = (el as Node).parentNode
  }
  return null
}

/** Extract an inline CSS property value from a raw style attribute. */
function readRawInlineStyle(el: HTMLElement, prop: string): string | null {
  const raw = el.getAttribute("style") ?? ""
  const m = raw.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"))
  return m?.[1]?.trim() ?? null
}

/** Extract an inline CSS property value from a style string. */
function readInlineStyle(el: HTMLElement, prop: string): string | null {
  const inline = el.style.getPropertyValue(prop)
  if (inline) return inline.trim()
  return readRawInlineStyle(el, prop)
}

/** True when a CSS color string represents "no color" (transparent / unset). */
function isTransparentColor(value: string | null | undefined): boolean {
  if (!value) return true
  const v = value.trim()
  return (
    v === "" ||
    v === "transparent" ||
    /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(v)
  )
}

function readElementColorValue(el: HTMLElement, kind: "background" | "text"): string | null {
  if (kind === "text") {
    return readInlineStyle(el, "color")
  }

  const rawBackgroundColor = readRawInlineStyle(el, "background-color")
  if (!isTransparentColor(rawBackgroundColor)) return rawBackgroundColor

  const rawBackground = readRawInlineStyle(el, "background")
  if (!isTransparentColor(rawBackground)) return rawBackground

  const bgcolor = el.getAttribute("bgcolor")
  if (!isTransparentColor(bgcolor)) return bgcolor

  const backgroundColor = el.style.getPropertyValue("background-color").trim()
  if (!isTransparentColor(backgroundColor)) return backgroundColor

  const background = el.style.getPropertyValue("background").trim()
  if (!isTransparentColor(background)) return background

  return null
}

function readComputedColorValue(el: HTMLElement, kind: "background" | "text"): string | null {
  try {
    const styles = window.getComputedStyle(el)
    if (kind === "text") {
      return styles.getPropertyValue("color").trim()
    }

    const backgroundColor = styles.getPropertyValue("background-color").trim()
    if (!isTransparentColor(backgroundColor)) return backgroundColor

    const backgroundImage = styles.getPropertyValue("background-image").trim()
    if (backgroundImage && backgroundImage !== "none") return backgroundImage
  } catch {
    // getComputedStyle can throw for detached nodes; ignore and continue.
  }

  return null
}

function isGradientBackground(value: string | null | undefined): boolean {
  return /(?:linear|radial|conic)-gradient\s*\(/i.test(value ?? "")
}

function readButtonBackgroundValue(
  anchor: HTMLAnchorElement,
  bgElement: HTMLElement | null,
): string {
  const visualBg = bgElement ?? anchor
  return (
    readElementColorValue(visualBg, "background") ??
    (typeof window !== "undefined" ? readComputedColorValue(visualBg, "background") : null) ??
    readElementColorValue(anchor, "background") ??
    DEFAULT_BUTTON_BG
  )
}

function extractBackgroundColors(value: string): [string, string] {
  const matches = value.match(/#[0-9a-f]{3,6}\b|rgba?\([^)]*\)/gi) ?? []
  const first = toHexColor(matches[0] ?? value, DEFAULT_BUTTON_BG)
  const second = toHexColor(matches[1] ?? matches[0] ?? value, first)
  return [first, second]
}

function findButtonBackgroundElement(
  el: HTMLElement,
  root: HTMLElement | null = null,
): HTMLElement | null {
  let current: HTMLElement | null = el
  let depth = 0
  while (current && depth < 6) {
    if (root && current === root) break

    const inline = readElementColorValue(current, "background")
    if (!isTransparentColor(inline)) return current

    if (typeof window !== "undefined") {
      const computed = readComputedColorValue(current, "background")
      if (!isTransparentColor(computed)) return current
    }

    current = current.parentElement
    depth += 1
  }

  return null
}

function readCssValue(el: HTMLElement, prop: string, fallback: string): string {
  const inline = readInlineStyle(el, prop)
  if (inline) return inline

  if (typeof window !== "undefined") {
    try {
      const computed = window.getComputedStyle(el).getPropertyValue(prop).trim()
      if (computed) return computed
    } catch {
      // Detached nodes can fail computed-style reads.
    }
  }

  return fallback
}

function readButtonPreviewStyle(
  anchor: HTMLAnchorElement,
  bgElement: HTMLElement | null,
): React.CSSProperties {
  const background = readButtonBackgroundValue(anchor, bgElement)

  return {
    ...DEFAULT_BUTTON_PREVIEW_STYLE,
    background,
    color: readCssValue(anchor, "color", DEFAULT_BUTTON_FG),
    padding: readCssValue(anchor, "padding", "12px 28px"),
    borderRadius: readCssValue(anchor, "border-radius", "6px"),
    fontWeight: readCssValue(anchor, "font-weight", "600"),
    fontSize: readCssValue(anchor, "font-size", "15px"),
    fontFamily: readCssValue(anchor, "font-family", "sans-serif"),
    lineHeight: readCssValue(anchor, "line-height", "1"),
    textDecoration: readCssValue(anchor, "text-decoration", "none"),
  }
}

/**
 * Resolve the effective color of a button anchor for either its background or
 * its text.
 *
 * Many email templates style the *visual* button via a wrapper (`<td>`, a
 * surrounding `<span>`, or a `bgcolor` attribute) rather than on the `<a>`
 * itself, so for backgrounds we walk a short way up the ancestor chain until
 * we find a non-transparent color. Text color inherits in CSS, so reading it
 * straight from the anchor is reliable.
 */
function readButtonColor(
  el: HTMLElement,
  kind: "background" | "text",
  fallback: string,
  root: HTMLElement | null = null,
): string {
  const prop = kind === "background" ? "background-color" : "color"

  if (typeof window !== "undefined") {
    let current: HTMLElement | null = el
    let depth = 0
    while (current && depth < 6) {
      // Stop at the editor root (don't pick up the page background).
      if (root && current === root) break

      const inline = readElementColorValue(current, kind)
      if (!isTransparentColor(inline)) return toHexColor(inline, fallback)

      const computed = readComputedColorValue(current, kind)
      if (!isTransparentColor(computed)) return toHexColor(computed, fallback)

      // Text color inherits, so the anchor itself is the right answer.
      if (kind === "text") break

      current = current.parentElement
      depth += 1
    }
  }

  // Fallback: parse the anchor's inline style directly.
  const inline = readInlineStyle(el, prop)
  if (inline) return toHexColor(inline, fallback)

  if (kind === "background") {
    const bgcolor = el.getAttribute("bgcolor")
    if (bgcolor) return toHexColor(bgcolor, fallback)
  }

  return fallback
}

/**
 * Best-effort conversion of a CSS color (`rgb(...)`, named, or `#hex`) into a
 * 6-digit `#rrggbb` value usable by `<input type="color">`.
 */
function toHexColor(value: string | null, fallback: string): string {
  if (!value) return fallback
  const v = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return (
      "#" +
      v
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
        .toLowerCase()
    )
  }
  const hex = v.match(/#[0-9a-f]{6}\b/i)
  if (hex) return hex[0].toLowerCase()
  const shortHex = v.match(/#[0-9a-f]{3}\b/i)
  if (shortHex) return toHexColor(shortHex[0], fallback)
  const rgb = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) {
    const toHex = (n: string | undefined) =>
      Math.max(0, Math.min(255, parseInt(n ?? "0", 10)))
        .toString(16)
        .padStart(2, "0")
    return `#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`.toLowerCase()
  }
  return fallback
}

// ----------------------------------------------------------------------------
// Email content-box helpers
// ----------------------------------------------------------------------------

const EMAIL_BOX_ATTR = "data-email-box"
const EDITOR_SELECTED_BOX_ATTR = "data-editor-selected-box"
const EDITOR_SELECTED_TABLE_ATTR = "data-editor-selected-table"
const EDITOR_SELECTED_CELL_ATTR = "data-editor-selected-cell"
const EDITOR_SELECTED_LINE_ATTR = "data-editor-selected-line"
const EDITOR_EMPTY_ATTR = "data-editor-empty"
const DEFAULT_BOX_BG = "#ffffff"
const DEFAULT_BOX_PADDING = "32"
const DEFAULT_BOX_WIDTH = "460"
const DEFAULT_BOX_RADIUS = "0"
const DEFAULT_BOX_BORDER_WIDTH = "0"
const DEFAULT_BOX_BORDER_COLOR = "#e4e4e7"

function maxPaddingPx(style: string): number {
  const paddingMatches = Array.from(style.matchAll(/padding(?:-[^:]*)?\s*:\s*([^;]+)/gi))
  return paddingMatches.reduce((max, match) => {
    const values = Array.from((match[1] ?? "").matchAll(/(\d+(?:\.\d+)?)px/gi))
    return values.reduce((innerMax, valueMatch) => {
      const px = Number.parseFloat(valueMatch[1] ?? "0")
      return Number.isNaN(px) ? innerMax : Math.max(innerMax, px)
    }, max)
  }, 0)
}

function isEmailBoxElement(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false
  if (el.getAttribute(EMAIL_BOX_ATTR) === "true") return true

  const tag = el.tagName
  const style = el.getAttribute("style") ?? ""
  const widthAttr = el.getAttribute("width") ?? ""
  const hasFixedWidth =
    /max-width\s*:\s*\d+px/i.test(style) ||
    /width\s*:\s*\d+px/i.test(style) ||
    /^\d{3,4}$/.test(widthAttr.trim())
  const hasBackground =
    /background(?:-color)?\s*:/i.test(style) ||
    Boolean(el.getAttribute("bgcolor"))
  const hasPadding = /padding(?:-[^:]*)?\s*:/i.test(style)
  const hasLargePadding = maxPaddingPx(style) >= 16
  const hasBorderStyle = /border(?:-radius)?\s*:/i.test(style)

  if (tag === "TABLE") {
    return hasFixedWidth && (hasBackground || hasBorderStyle || hasPadding)
  }

  // Email template sections are often rendered as styled div/section blocks
  // inside the outer table. Treat those as editable boxes so a colored middle
  // section can be selected separately from the full email card.
  if (["DIV", "SECTION", "ARTICLE"].includes(tag)) {
    return hasBackground && (hasPadding || hasBorderStyle)
  }

  // Some templates use one padded TD as the white content area around colored
  // inner sections. Select that larger content cell, while avoiding small
  // label/value cells in detail tables.
  if (tag === "TD") {
    const isLargeContentCell = hasLargePadding && el.children.length > 1
    return (hasBackground && (hasPadding || hasBorderStyle)) || isLargeContentCell
  }

  return false
}

function isLargeContentCell(el: HTMLElement): boolean {
  if (el.tagName !== "TD") return false
  return maxPaddingPx(el.getAttribute("style") ?? "") >= 16 && el.children.length > 1
}

function findDirectChild(parent: HTMLElement, target: EventTarget | Node | null): ChildNode | null {
  let node = target as Node | null
  while (node && node.parentNode && node.parentNode !== parent) {
    node = node.parentNode
  }
  return node?.parentNode === parent ? (node as ChildNode) : null
}

function isEmailSectionBoundary(node: ChildNode, container: HTMLElement): boolean {
  return node.nodeType === Node.ELEMENT_NODE &&
    node !== container &&
    isEmailBoxElement(node as Element)
}

function hasMeaningfulContent(nodes: ChildNode[]): boolean {
  return nodes.some((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) return true
    return Boolean(node.textContent?.trim())
  })
}

function createSectionBoxFromContentCell(
  target: EventTarget | Node | null,
  container: HTMLElement,
): HTMLElement | null {
  if (!isLargeContentCell(container)) return null

  const directChild = findDirectChild(container, target)
  if (!directChild) return null
  if (isEmailSectionBoundary(directChild, container)) return null

  let start: ChildNode = directChild
  while (start.previousSibling && !isEmailSectionBoundary(start.previousSibling, container)) {
    start = start.previousSibling
  }

  let end: ChildNode = directChild
  while (end.nextSibling && !isEmailSectionBoundary(end.nextSibling, container)) {
    end = end.nextSibling
  }

  const nodes: ChildNode[] = []
  let current: ChildNode | null = start
  while (current) {
    nodes.push(current)
    if (current === end) break
    current = current.nextSibling
  }

  if (!hasMeaningfulContent(nodes)) return null

  const wrapper = document.createElement("div")
  wrapper.setAttribute(EMAIL_BOX_ATTR, "true")
  wrapper.setAttribute(
    "style",
    [
      "display:block",
      "width:100%",
      `background-color:${readBoxBg(container)}`,
      "padding:0",
      "margin:0",
      "box-sizing:border-box",
    ].join(";") + ";",
  )

  container.insertBefore(wrapper, start)
  for (const node of nodes) {
    wrapper.appendChild(node)
  }

  return wrapper
}

function findEnclosingEmailBox(
  target: EventTarget | Node | null,
  root: HTMLElement | null,
): HTMLElement | null {
  if (!root) return null
  let el = target as Node | null
  while (el && el !== root) {
    if (el.nodeType === 1 && isEmailBoxElement(el as Element)) {
      return el as HTMLElement
    }
    el = el.parentNode
  }
  return null
}

function getBoxPaddingElement(box: HTMLElement): HTMLElement {
  if (box.tagName !== "TABLE") return box
  return (box.querySelector("td") as HTMLElement | null) ?? box
}

function readBoxBg(box: HTMLElement): string {
  return toHexColor(
    readElementColorValue(box, "background") ??
    (typeof window !== "undefined" ? readComputedColorValue(box, "background") : null),
    DEFAULT_BOX_BG,
  )
}

function readBoxPadding(box: HTMLElement): string {
  const paddingEl = getBoxPaddingElement(box)
  const padding = readInlineStyle(paddingEl, "padding") ??
    (typeof window !== "undefined"
      ? window.getComputedStyle(paddingEl).getPropertyValue("padding").trim()
      : "")
  const first = padding.match(/\d+/)?.[0]
  return first ?? DEFAULT_BOX_PADDING
}

function readBoxWidth(box: HTMLElement): string {
  const width = readInlineStyle(box, "max-width") ??
    readInlineStyle(box, "width") ??
    box.getAttribute("width") ??
    (typeof window !== "undefined"
      ? window.getComputedStyle(box).getPropertyValue("max-width").trim()
      : "")
  const first = width.match(/\d+/)?.[0]
  return first ?? DEFAULT_BOX_WIDTH
}

function readBoxRadius(box: HTMLElement): string {
  const radius = readInlineStyle(box, "border-radius") ??
    (typeof window !== "undefined"
      ? window.getComputedStyle(box).getPropertyValue("border-radius").trim()
      : "")
  const first = radius.match(/\d+/)?.[0]
  return first ?? DEFAULT_BOX_RADIUS
}

function readBoxBorderWidth(box: HTMLElement): string {
  const borderWidth = readInlineStyle(box, "border-width") ??
    readInlineStyle(box, "border-top-width") ??
    (typeof window !== "undefined"
      ? window.getComputedStyle(box).getPropertyValue("border-top-width").trim()
      : "")
  const first = borderWidth.match(/\d+/)?.[0]
  return first ?? DEFAULT_BOX_BORDER_WIDTH
}

function readBoxBorderColor(box: HTMLElement): string {
  const rawBorder = readRawInlineStyle(box, "border")
  const explicitBorderColor = rawBorder?.match(/#[0-9a-f]{3,6}\b|rgba?\([^)]*\)/i)?.[0] ??
    readInlineStyle(box, "border-color") ??
    readInlineStyle(box, "border-top-color")

  if (explicitBorderColor) {
    return toHexColor(explicitBorderColor, DEFAULT_BOX_BORDER_COLOR)
  }

  if (readBoxBorderWidth(box) === "0") {
    return DEFAULT_BOX_BORDER_COLOR
  }

  const computedBorderColor = typeof window !== "undefined"
    ? window.getComputedStyle(box).getPropertyValue("border-top-color").trim()
    : ""
  return toHexColor(computedBorderColor, DEFAULT_BOX_BORDER_COLOR)
}

function applyBoxBorder(box: HTMLElement, width: string, color: string): void {
  const parsed = Number.parseInt(width, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    box.style.border = "0"
    return
  }

  box.style.border = `${parsed}px solid ${color}`
}

function applyBoxWidth(box: HTMLElement, width: string): void {
  box.style.maxWidth = `${width}px`
  box.style.width = "100%"
  if (box.tagName === "TABLE") {
    box.setAttribute("width", "100%")
  }
}

function marginStyleForAlign(align: EmailAlign): { marginLeft: string; marginRight: string } {
  if (align === "right") return { marginLeft: "auto", marginRight: "0" }
  if (align === "center") return { marginLeft: "auto", marginRight: "auto" }
  return { marginLeft: "0", marginRight: "auto" }
}

function readObjectAlign(el: HTMLElement): EmailAlign {
  const marginLeft = readInlineStyle(el, "margin-left") ?? ""
  const marginRight = readInlineStyle(el, "margin-right") ?? ""
  const alignAttr = el.getAttribute("align")
  if (alignAttr === "left" || alignAttr === "center" || alignAttr === "right") return alignAttr
  if (marginLeft === "auto" && marginRight === "auto") return "center"
  if (marginLeft === "auto") return "right"
  return "left"
}

function applyObjectAlign(el: HTMLElement, align: EmailAlign): void {
  const margins = marginStyleForAlign(align)
  el.style.marginLeft = margins.marginLeft
  el.style.marginRight = margins.marginRight

  if (el.tagName === "TABLE") {
    el.setAttribute("align", align)
  } else {
    el.style.display = el.style.display || "block"
  }
}

function cleanEditorHtml(editor: HTMLElement): string {
  const clone = editor.cloneNode(true) as HTMLElement
  clone.querySelectorAll(`[${EDITOR_SELECTED_BOX_ATTR}]`).forEach((el) => {
    el.removeAttribute(EDITOR_SELECTED_BOX_ATTR)
  })
  clone.querySelectorAll(`[${EDITOR_SELECTED_TABLE_ATTR}]`).forEach((el) => {
    el.removeAttribute(EDITOR_SELECTED_TABLE_ATTR)
  })
  clone.querySelectorAll(`[${EDITOR_SELECTED_CELL_ATTR}]`).forEach((el) => {
    el.removeAttribute(EDITOR_SELECTED_CELL_ATTR)
  })
  clone.querySelectorAll(`[${EDITOR_SELECTED_LINE_ATTR}]`).forEach((el) => {
    el.removeAttribute(EDITOR_SELECTED_LINE_ATTR)
  })

  const emptyPlaceholder = clone.querySelector(`[${EDITOR_EMPTY_ATTR}="true"]`)
  if (emptyPlaceholder && clone.children.length === 1 && !clone.textContent?.trim()) {
    return ""
  }
  clone.querySelectorAll(`[${EDITOR_EMPTY_ATTR}]`).forEach((el) => {
    el.removeAttribute(EDITOR_EMPTY_ATTR)
  })
  return restoreTbodyMergePlaceholders(clone.innerHTML)
}

function ensureEditorHasEditableEmptyBlock(editor: HTMLElement | null, focus = false): void {
  if (!editor) return
  if ((editor.textContent ?? "").trim() || editor.querySelector("img,table,hr,a,button")) return

  editor.innerHTML = `<p ${EDITOR_EMPTY_ATTR}="true"><br></p>`
  if (!focus) return

  editor.focus()
  const target = editor.querySelector(`[${EDITOR_EMPTY_ATTR}="true"]`) ?? editor
  const range = document.createRange()
  range.selectNodeContents(target)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function createEmailBox(
  bgColor: string,
  padding: string,
  width = DEFAULT_BOX_WIDTH,
): HTMLTableElement {
  const table = document.createElement("table")
  table.setAttribute(EMAIL_BOX_ATTR, "true")
  table.setAttribute("role", "presentation")
  table.setAttribute("width", "100%")
  table.setAttribute("cellspacing", "0")
  table.setAttribute("cellpadding", "0")
  table.setAttribute("border", "0")
  table.setAttribute("bgcolor", bgColor)
  table.setAttribute(
    "style",
    [
      `max-width:${width}px`,
      "width:100%",
      "margin:0 auto",
      `background-color:${bgColor}`,
      "border-radius:12px",
      "border:1px solid #e4e4e7",
      "overflow:hidden",
    ].join(";") + ";",
  )

  const tbody = document.createElement("tbody")
  const tr = document.createElement("tr")
  const td = document.createElement("td")
  td.setAttribute("style", `padding:${padding}px;`)
  tr.appendChild(td)
  tbody.appendChild(tr)
  table.appendChild(tbody)
  return table
}

function findEditableTable(
  target: EventTarget | Node | null,
  root: HTMLElement | null,
): HTMLTableElement | null {
  if (!root) return null
  let el = target as Node | null
  while (el && el !== root) {
    if (el.nodeType === 1) {
      const element = el as HTMLElement
      if (element.tagName === "TABLE") {
        const table = element as HTMLTableElement
        if (table.getAttribute(EMAIL_BOX_ATTR) === "true") return null
        const style = table.getAttribute("style") ?? ""
        const hasHeader = tableHasOwnHeader(table)
        const hasBorder = /border\s*:/i.test(style) || getTableEditableRows(table).some((row) =>
          Array.from(row.cells).some((cell) => /border\s*:/i.test(cell.getAttribute("style") ?? "")),
        )
        const hasManyCells = getTableEditableRows(table).reduce((count, row) => count + row.cells.length, 0) >= 4
        if ((hasHeader || hasBorder) && hasManyCells) return table
      }
    }
    el = el.parentNode
  }
  return null
}

function findEditableLine(
  target: EventTarget | Node | null,
  root: HTMLElement | null,
): HTMLElement | null {
  if (!root) return null
  let el = target as Node | null
  while (el && el !== root) {
    if (el.nodeType === 1) {
      const element = el as HTMLElement
      if (element.tagName === "HR") return element
      const style = element.getAttribute("style") ?? ""
      const hasLineBorder = /border-(?:top|bottom)\s*:/i.test(style)
      const mostlyEmpty = (element.textContent ?? "").replace(/\u00a0/g, "").trim().length === 0
      if ((element.tagName === "TD" || element.tagName === "DIV") && hasLineBorder && mostlyEmpty) {
        return element
      }
    }
    el = el.parentNode
  }
  return null
}

function readLineWidth(line: HTMLElement): string {
  const raw = readInlineStyle(line, "border-top-width") ??
    readInlineStyle(line, "border-bottom-width") ??
    readInlineStyle(line, "height") ??
    (typeof window !== "undefined"
      ? window.getComputedStyle(line).getPropertyValue("border-top-width").trim()
      : "")
  return raw.match(/\d+/)?.[0] ?? "1"
}

function readLineColor(line: HTMLElement): string {
  const rawBorder = readRawInlineStyle(line, "border-top") ?? readRawInlineStyle(line, "border-bottom")
  const color = rawBorder?.match(/#[0-9a-f]{3,6}\b|rgba?\([^)]*\)/i)?.[0] ??
    readInlineStyle(line, "border-color") ??
    readInlineStyle(line, "border-top-color") ??
    (typeof window !== "undefined"
      ? window.getComputedStyle(line).getPropertyValue("border-top-color").trim()
      : "")
  return toHexColor(color, "#111111")
}

function applyLineStyle(line: HTMLElement, width: string, color: string): void {
  const px = Math.max(0, Number.parseInt(width, 10) || 0)
  if (line.tagName === "HR") {
    line.style.border = "0"
    line.style.borderTop = `${px}px solid ${color}`
    line.style.height = "0"
    line.style.margin = line.style.margin || "20px 0"
    return
  }

  line.style.borderTop = `${px}px solid ${color}`
}

function readTableBorderWidth(table: HTMLTableElement): string {
  const raw = readInlineStyle(table, "border-width") ??
    readInlineStyle(table, "border-top-width") ??
    (typeof window !== "undefined"
      ? window.getComputedStyle(table).getPropertyValue("border-top-width").trim()
      : "")
  return raw.match(/\d+/)?.[0] ?? "1"
}

function readTableBorderColor(table: HTMLTableElement): string {
  const rawBorder = readRawInlineStyle(table, "border")
  const color = rawBorder?.match(/#[0-9a-f]{3,6}\b|rgba?\([^)]*\)/i)?.[0] ??
    readInlineStyle(table, "border-color") ??
    readInlineStyle(table, "border-top-color") ??
    (typeof window !== "undefined"
      ? window.getComputedStyle(table).getPropertyValue("border-top-color").trim()
      : "")
  return toHexColor(color, "#dddddd")
}

function readTableHeaderBg(table: HTMLTableElement): string {
  const header = table.querySelector("th") as HTMLElement | null
  if (!header) return "#3d3d3d"
  return toHexColor(readElementColorValue(header, "background"), "#3d3d3d")
}

function readTableHeaderTextColor(table: HTMLTableElement): string {
  const header = table.querySelector("th") as HTMLElement | null
  if (!header) return "#ffffff"
  return toHexColor(readElementColorValue(header, "text"), "#ffffff")
}

function applyTableBorder(table: HTMLTableElement, width: string, color: string): void {
  const px = Math.max(0, Number.parseInt(width, 10) || 0)
  table.style.border = px > 0 ? `${px}px solid ${color}` : "0"
  table.style.borderCollapse = "collapse"
  table.querySelectorAll("td,th").forEach((cell) => {
    ; (cell as HTMLElement).style.borderBottom = px > 0 ? `${px}px solid ${color}` : "0"
  })
}

function applyTableHeaderStyle(table: HTMLTableElement, bg: string, color: string): void {
  table.querySelectorAll("th").forEach((cell) => {
    const th = cell as HTMLElement
    th.style.backgroundColor = bg
    th.style.color = color
  })
}

function createEditableTable(): HTMLTableElement {
  const table = document.createElement("table")
  table.setAttribute("role", "presentation")
  table.setAttribute("width", "100%")
  table.setAttribute("cellspacing", "0")
  table.setAttribute("cellpadding", "0")
  table.setAttribute("border", "0")
  table.setAttribute("style", "width:100%;border-collapse:collapse;border:1px solid #dddddd;margin:16px 0;")
  const thead = document.createElement("thead")
  const headRow = document.createElement("tr")
    ;["Column 1", "Column 2", "Column 3"].forEach((label) => {
      const th = document.createElement("th")
      th.textContent = label
      th.setAttribute("style", "background-color:#3d3d3d;color:#ffffff;font-size:12px;font-weight:700;padding:10px 12px;text-align:left;border-bottom:1px solid #dddddd;")
      headRow.appendChild(th)
    })
  thead.appendChild(headRow)
  const tbody = document.createElement("tbody")
  for (let rowIndex = 0; rowIndex < 2; rowIndex += 1) {
    const tr = document.createElement("tr")
    for (let colIndex = 0; colIndex < 3; colIndex += 1) {
      const td = document.createElement("td")
      td.textContent = rowIndex === 0 && colIndex === 0 ? "Item" : ""
      td.setAttribute("style", "color:#333333;font-size:13px;padding:8px 12px;border-bottom:1px solid #dddddd;")
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(thead)
  table.appendChild(tbody)
  return table
}

function tableHasOwnHeader(table: HTMLTableElement): boolean {
  if (table.tHead && table.tHead.rows.length > 0) return true
  return Array.from(table.rows).some((row) =>
    Array.from(row.cells).some((cell) => cell.tagName === "TH"),
  )
}

function isTbodyMergeRow(row: HTMLTableRowElement): boolean {
  return row.getAttribute(TBODY_MERGE_ATTR) === "true"
}

function findTableCell(
  target: EventTarget | Node | null,
  table: HTMLTableElement,
): HTMLTableCellElement | null {
  let node = target as Node | null
  while (node && node !== table) {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      ((node as HTMLElement).tagName === "TD" || (node as HTMLElement).tagName === "TH")
    ) {
      return node as HTMLTableCellElement
    }
    node = node.parentNode
  }
  return table.querySelector("th,td") as HTMLTableCellElement | null
}

function getCellColumnIndex(cell: HTMLTableCellElement | null): number {
  const row = cell?.parentElement as HTMLTableRowElement | null
  if (!cell || !row) return 0
  return Math.max(0, Array.from(row.cells).indexOf(cell))
}

function getTableEditableRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(table.rows).filter((row) => !isTbodyMergeRow(row))
}

function getTableColumnCount(table: HTMLTableElement): number {
  return Math.max(1, ...getTableEditableRows(table).map((row) => row.cells.length))
}

function getCellAtColumn(table: HTMLTableElement, columnIndex: number): HTMLTableCellElement | null {
  for (const row of getTableEditableRows(table)) {
    const cell = row.cells[columnIndex]
    if (cell) return cell as HTMLTableCellElement
  }
  return null
}

function readTableColumnWidth(table: HTMLTableElement, columnIndex: number): string {
  const cell = getCellAtColumn(table, columnIndex)
  const raw = cell
    ? readInlineStyle(cell, "width") ?? cell.getAttribute("width") ??
    (typeof window !== "undefined"
      ? window.getComputedStyle(cell).getPropertyValue("width").trim()
      : "")
    : ""
  return raw.match(/\d+/)?.[0] ?? "120"
}

function applyTableColumnWidth(table: HTMLTableElement, columnIndex: number, width: string): void {
  const px = Math.max(1, Number.parseInt(width, 10) || 1)
  getTableEditableRows(table).forEach((row) => {
    const cell = row.cells[columnIndex] as HTMLTableCellElement | undefined
    if (!cell) return
    cell.style.width = `${px}px`
    cell.setAttribute("width", String(px))
  })
}

function cloneTableCellStyle(
  source: HTMLTableCellElement | null,
  target: HTMLTableCellElement,
): void {
  const style = source?.getAttribute("style")
  if (style) {
    target.setAttribute("style", style)
    return
  }

  target.setAttribute(
    "style",
    target.tagName === "TH"
      ? "background-color:#3d3d3d;color:#ffffff;font-size:12px;font-weight:700;padding:10px 12px;text-align:left;border-bottom:1px solid #dddddd;"
      : "color:#333333;font-size:13px;padding:8px 12px;border-bottom:1px solid #dddddd;",
  )
}

function createCellForRow(
  row: HTMLTableRowElement,
  source: HTMLTableCellElement | null,
): HTMLTableCellElement {
  const isHeaderRow = row.parentElement?.tagName === "THEAD" ||
    Array.from(row.cells).some((cell) => cell.tagName === "TH")
  const cell = document.createElement(isHeaderRow ? "th" : "td") as HTMLTableCellElement
  cloneTableCellStyle(source, cell)
  cell.textContent = isHeaderRow ? "Column" : ""
  return cell
}

function getOrCreateTbody(table: HTMLTableElement): HTMLTableSectionElement {
  return table.tBodies[0] ?? table.createTBody()
}

function findTableBodyTemplateCell(
  table: HTMLTableElement,
  columnIndex: number,
): HTMLTableCellElement | null {
  for (const row of Array.from(table.tBodies).flatMap((tbody) => Array.from(tbody.rows))) {
    if (isTbodyMergeRow(row)) continue
    const cell = row.cells[columnIndex]
    if (cell) return cell as HTMLTableCellElement
  }
  return getCellAtColumn(table, columnIndex)
}

function addTableRowAfterSelection(
  table: HTMLTableElement,
  selectedCell: HTMLTableCellElement | null,
): HTMLTableCellElement | null {
  const tbody = getOrCreateTbody(table)
  const columnCount = getTableColumnCount(table)
  const tr = document.createElement("tr")

  for (let index = 0; index < columnCount; index += 1) {
    const source = findTableBodyTemplateCell(table, index)
    const td = document.createElement("td") as HTMLTableCellElement
    cloneTableCellStyle(source, td)
    td.textContent = ""
    tr.appendChild(td)
  }

  const selectedRow = selectedCell?.parentElement as HTMLTableRowElement | null
  if (selectedRow && selectedRow.parentElement === tbody && !isTbodyMergeRow(selectedRow)) {
    tbody.insertBefore(tr, selectedRow.nextSibling)
  } else {
    const lastMergeRow = Array.from(tbody.rows).reverse().find(isTbodyMergeRow)
    tbody.insertBefore(tr, lastMergeRow?.nextSibling ?? null)
  }

  return tr.cells[0] as HTMLTableCellElement | null
}

function removeTableRowAtSelection(
  table: HTMLTableElement,
  selectedCell: HTMLTableCellElement | null,
): HTMLTableCellElement | null {
  const row = selectedCell?.parentElement as HTMLTableRowElement | null
  const rows = getTableEditableRows(table)
  if (!row || isTbodyMergeRow(row) || rows.length <= 1) return selectedCell

  const nextRow = row.nextElementSibling as HTMLTableRowElement | null
  const prevRow = row.previousElementSibling as HTMLTableRowElement | null
  const columnIndex = getCellColumnIndex(selectedCell)
  row.remove()
  const fallbackRow = nextRow && !isTbodyMergeRow(nextRow) ? nextRow : prevRow
  return (fallbackRow?.cells[columnIndex] as HTMLTableCellElement | undefined) ?? getCellAtColumn(table, columnIndex)
}

function addTableColumnAfterSelection(
  table: HTMLTableElement,
  selectedCell: HTMLTableCellElement | null,
): HTMLTableCellElement | null {
  const columnIndex = getCellColumnIndex(selectedCell)
  let inserted: HTMLTableCellElement | null = null

  getTableEditableRows(table).forEach((row) => {
    const source = (row.cells[columnIndex] as HTMLTableCellElement | undefined) ??
      (row.cells[row.cells.length - 1] as HTMLTableCellElement | undefined) ??
      null
    const cell = createCellForRow(row, source)
    row.insertBefore(cell, row.cells[columnIndex + 1] ?? null)
    if (!inserted) inserted = cell
  })

  return inserted
}

function removeTableColumnAtSelection(
  table: HTMLTableElement,
  selectedCell: HTMLTableCellElement | null,
): HTMLTableCellElement | null {
  const columnCount = getTableColumnCount(table)
  if (columnCount <= 1) return selectedCell

  const columnIndex = Math.min(getCellColumnIndex(selectedCell), columnCount - 1)
  getTableEditableRows(table).forEach((row) => {
    row.cells[columnIndex]?.remove()
  })

  const nextIndex = Math.max(0, Math.min(columnIndex, getTableColumnCount(table) - 1))
  return getCellAtColumn(table, nextIndex)
}

function createTbodyMergePlaceholderRow(tag: string): HTMLTableRowElement {
  const tr = document.createElement("tr")
  tr.setAttribute(TBODY_MERGE_ATTR, "true")
  const td = document.createElement("td")
  td.setAttribute("colspan", "99")
  td.setAttribute(
    "style",
    "padding:10px 12px;color:#52525b;background-color:#fafafa;font-family:monospace;font-size:12px;line-height:18px;",
  )
  td.textContent = tag
  tr.appendChild(td)
  return tr
}

function firstElementInside(node: Node | null): HTMLElement | null {
  if (!node) return null
  if (node.nodeType === Node.ELEMENT_NODE) return node as HTMLElement
  for (const child of Array.from(node.childNodes)) {
    const found = firstElementInside(child)
    if (found) return found
  }
  return null
}

function findNextElementAfterNode(node: Node, boundary: HTMLElement): HTMLElement | null {
  let current: Node | null = node
  while (current && current !== boundary) {
    let sibling = current.nextSibling
    while (sibling) {
      const found = firstElementInside(sibling)
      if (found) return found
      sibling = sibling.nextSibling
    }
    current = current.parentNode
  }
  return null
}

function findTbodyMergeTargetTable(start: HTMLElement | null): HTMLTableElement | null {
  if (!start) return null
  const candidates = start.tagName === "TABLE"
    ? [start as HTMLTableElement, ...Array.from(start.querySelectorAll("table"))]
    : Array.from(start.querySelectorAll("table"))
  return candidates.find((table) => Boolean(table.tBodies[0]) && tableHasOwnHeader(table)) ?? null
}

function protectOrphanTbodyMergeText(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text)
  }

  textNodes.forEach((node) => {
    if (node.parentElement?.closest("tbody")) return
    const match = node.data.match(/\{\{[\w.]+_html\}\}/)
    if (!match) return

    const nextElement = findNextElementAfterNode(node, root)
    const table = findTbodyMergeTargetTable(nextElement)
    const tbody = table?.tBodies[0]
    if (!tbody) return

    const tag = match[0]
    node.data = node.data.replace(tag, "")
    tbody.appendChild(createTbodyMergePlaceholderRow(tag))
  })
}


/** Build wrapper div style from settings */
function wrapperStyle(settings: EmailSettings): React.CSSProperties {
  const margins = marginStyleForAlign(settings.align)
  const width = settings.width === "full" ? "100%" : "100%"
  const maxWidth = settings.width === "full" ? undefined : `${settings.width}px`
  return {
    backgroundColor: settings.bgColor,
    width,
    maxWidth,
    marginLeft: margins.marginLeft,
    marginRight: margins.marginRight,
  }
}

// ============================================================================
// RichEditor
// ============================================================================

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(function RichEditor({
  value,
  onChange,
  placeholder = "Write your email content here...",
  className,
  minHeight = "250px",
  toolbarEnd,
}, ref) {
  const rootRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)
  const lastRangeRef = useRef<Range | null>(null)
  const settingsSaveTimerRef = useRef<number | null>(null)
  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] })
  const currentHistoryRef = useRef<string | null>(null)
  const isRestoringHistoryRef = useRef(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  // Routed through a ref so the imperative handle always uses the latest save
  // closure (which captures documentShell, settings, etc. defined below).
  const saveRef = useRef<(html: string) => void>(() => { })

  useImperativeHandle(ref, () => ({
    insertVariable: (text: string) => {
      const editorEl = editorRef.current
      if (!editorEl) return

      editorEl.focus()

      if (lastRangeRef.current) {
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(lastRangeRef.current)
      }

      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        const textNode = document.createTextNode(text)
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        selection.removeAllRanges()
        selection.addRange(range)
      }

      saveRef.current(cleanEditorHtml(editorEl))
    },
  }))

  // Parse existing settings from value
  const initialContent = repairTbodyMergePlacement(stripSettings(value))
  const savedSettings = extractSettings(value)
  const [settings, setSettings] = useState<EmailSettings>(() =>
    resolveSettingsFromHtml(initialContent, savedSettings),
  )
  // Full HTML documents and protected tbody merge tags open in visual mode.
  const [sourceMode, setSourceMode] = useState(false)
  const [sourceValue, setSourceValue] = useState("")
  // When the incoming value is a full HTML document, we edit only its <body>
  // contents in visual mode and keep the surrounding <html>/<head>/<body>
  // wrapper here so we can reassemble it on save.
  const [documentShell, setDocumentShell] = useState<string | null>(() => {
    const parsed = parseDocumentShell(initialContent)
    return parsed?.shell ?? null
  })

  // Link dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Email content box controls
  const selectedBoxRef = useRef<HTMLElement | null>(null)
  const [selectedBoxActive, setSelectedBoxActive] = useState(false)
  const [selectedBoxBg, setSelectedBoxBg] = useState(DEFAULT_BOX_BG)
  const [selectedBoxPadding, setSelectedBoxPadding] = useState(DEFAULT_BOX_PADDING)
  const [selectedBoxWidth, setSelectedBoxWidth] = useState(DEFAULT_BOX_WIDTH)
  const [selectedBoxRadius, setSelectedBoxRadius] = useState(DEFAULT_BOX_RADIUS)
  const [selectedBoxBorderWidth, setSelectedBoxBorderWidth] = useState(DEFAULT_BOX_BORDER_WIDTH)
  const [selectedBoxBorderColor, setSelectedBoxBorderColor] = useState(DEFAULT_BOX_BORDER_COLOR)
  const [selectedBoxAlign, setSelectedBoxAlign] = useState<EmailAlign>("center")

  // Table controls
  const selectedTableRef = useRef<HTMLTableElement | null>(null)
  const selectedTableCellRef = useRef<HTMLTableCellElement | null>(null)
  const [selectedTableActive, setSelectedTableActive] = useState(false)
  const [selectedTableBorderWidth, setSelectedTableBorderWidth] = useState("1")
  const [selectedTableBorderColor, setSelectedTableBorderColor] = useState("#dddddd")
  const [selectedTableHeaderBg, setSelectedTableHeaderBg] = useState("#3d3d3d")
  const [selectedTableHeaderTextColor, setSelectedTableHeaderTextColor] = useState("#ffffff")
  const [selectedTableColumnWidth, setSelectedTableColumnWidth] = useState("120")
  const [selectedTableColumnIndex, setSelectedTableColumnIndex] = useState(0)
  const [selectedTableAlign, setSelectedTableAlign] = useState<EmailAlign>("center")

  // Divider line controls
  const selectedLineRef = useRef<HTMLElement | null>(null)
  const [selectedLineActive, setSelectedLineActive] = useState(false)
  const [selectedLineWidth, setSelectedLineWidth] = useState("1")
  const [selectedLineColor, setSelectedLineColor] = useState("#111111")

  // Button (CTA) dialog
  const [buttonDialogOpen, setButtonDialogOpen] = useState(false)
  const [buttonText, setButtonText] = useState("")
  const [buttonUrl, setButtonUrl] = useState("")
  const [buttonBgMode, setButtonBgMode] = useState<ButtonBgMode>("solid")
  const [buttonBgColor, setButtonBgColor] = useState(DEFAULT_BUTTON_BG)
  const [buttonGradientFrom, setButtonGradientFrom] = useState(DEFAULT_BUTTON_GRADIENT_FROM)
  const [buttonGradientTo, setButtonGradientTo] = useState(DEFAULT_BUTTON_GRADIENT_TO)
  const [buttonTextColor, setButtonTextColor] = useState(DEFAULT_BUTTON_FG)
  const [buttonPreviewStyle, setButtonPreviewStyle] = useState<React.CSSProperties>(DEFAULT_BUTTON_PREVIEW_STYLE)
  const [buttonBgEdited, setButtonBgEdited] = useState(false)
  // When set, the dialog is editing an existing button instead of inserting one.
  const editingButtonRef = useRef<HTMLAnchorElement | null>(null)
  const editingButtonBgRef = useRef<HTMLElement | null>(null)
  const [isEditingButton, setIsEditingButton] = useState(false)

  // Font selector
  const [selectedFontFamily, setSelectedFontFamily] = useState("sans-serif")
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false)
  const fontDropdownRef = useRef<HTMLDivElement>(null)

  // Pure content (without settings comment)
  const contentOnly = repairTbodyMergePlacement(stripSettings(value))
  const needsSourceOnly = false
  const isWideEmailLayout = isFullEmailDocument(contentOnly)
  const canvasBgColor = settings.bgColor

  // Seed source textarea from initial value (visual body syncs in the effect below).
  useEffect(() => {
    setSourceValue(repairTbodyMergePlacement(stripSettings(value)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateHistoryControls = useCallback(() => {
    setCanUndo(historyRef.current.past.length > 0)
    setCanRedo(historyRef.current.future.length > 0)
  }, [])

  const recordHistoryContent = useCallback((html: string) => {
    const normalized = repairTbodyMergePlacement(html)
    if (isRestoringHistoryRef.current) {
      currentHistoryRef.current = normalized
      updateHistoryControls()
      return
    }

    const current = currentHistoryRef.current
    if (current === null) {
      currentHistoryRef.current = normalized
      updateHistoryControls()
      return
    }
    if (current === normalized) return

    historyRef.current.past.push(current)
    if (historyRef.current.past.length > 100) {
      historyRef.current.past.shift()
    }
    historyRef.current.future = []
    currentHistoryRef.current = normalized
    updateHistoryControls()
  }, [updateHistoryControls])

  // Sync external value changes
  useEffect(() => {
    const newContent = repairTbodyMergePlacement(stripSettings(value))
    const malformed = hasMalformedTbodyMergeTag(newContent)

    if (malformed && !sourceMode) {
      setSourceValue(newContent)
      setSourceMode(true)
      return
    }

    if (sourceMode) {
      setSourceValue(newContent)
      return
    }

    // Visual mode: if the value is a full HTML document, extract its body
    // content into the contentEditable area and keep the shell aside so save()
    // can reassemble it. Otherwise, render the value directly.
    const parsed = parseDocumentShell(newContent)
    setDocumentShell(parsed?.shell ?? null)
    const bodyContent = parsed?.bodyContent ?? newContent
    const visualContent = protectTbodyMergeTags(bodyContent)
    if (currentHistoryRef.current === null) {
      currentHistoryRef.current = restoreTbodyMergePlaceholders(bodyContent)
      updateHistoryControls()
    }

    if (editorRef.current) {
      if (!mountedRef.current) mountedRef.current = true
      if (document.activeElement === editorRef.current) return
      const currentVisualContent = protectTbodyMergeTags(cleanEditorHtml(editorRef.current))
      if (currentVisualContent !== visualContent) {
        editorRef.current.innerHTML = visualContent
        protectOrphanTbodyMergeText(editorRef.current)
        ensureEditorHasEditableEmptyBlock(editorRef.current)
        selectedBoxRef.current?.removeAttribute(EDITOR_SELECTED_BOX_ATTR)
        selectedTableRef.current?.removeAttribute(EDITOR_SELECTED_TABLE_ATTR)
        selectedTableCellRef.current?.removeAttribute(EDITOR_SELECTED_CELL_ATTR)
        selectedBoxRef.current = null
        selectedTableRef.current = null
        selectedTableCellRef.current = null
        setSelectedBoxActive(false)
        setSelectedTableActive(false)
      }
    }
    const metadataSettings = extractSettings(value)
    setSettings(resolveSettingsFromHtml(newContent, metadataSettings))
  }, [value, sourceMode, updateHistoryControls])

  /** Get raw content from editor */
  const getContent = useCallback(() => {
    const editor = editorRef.current
    return editor ? cleanEditorHtml(editor) : ""
  }, [])

  /** Save body-only content from the visual editor (reassembles with shell). */
  const save = useCallback((html: string) => {
    let clean = repairTbodyMergePlacement(html.replace(/^\s+|\s+$/g, ""))
    recordHistoryContent(clean)
    if (documentShell) {
      // Visual-mode edit of a full HTML document: wrap body content back into
      // the preserved shell before persisting, then sync the template canvas
      // background stored in body/table attributes and inline styles.
      const reassembled = applyLegacyShellAlign(
        applyLegacyShellBg(
          reconstructWithShell(clean, documentShell),
          settings.bgColor,
        ),
        settings.align,
      )
      const parsed = parseDocumentShell(reassembled)
      setDocumentShell(parsed?.shell ?? documentShell)
      onChange(wrapWithSettings(reassembled, settings))
      return
    }
    if (isFullEmailDocument(clean)) {
      clean = applyLegacyShellAlign(applyLegacyShellBg(clean, settings.bgColor), settings.align)
    }
    onChange(wrapWithSettings(clean, settings))
  }, [onChange, settings, documentShell, recordHistoryContent])

  /**
   * Save raw source-mode HTML. We don't reassemble with the existing shell —
   * the user is editing the full document directly — but we do refresh the
   * tracked shell so that toggling back into visual mode extracts the latest
   * body content cleanly.
   */
  const saveSource = useCallback((html: string) => {
    let clean = repairTbodyMergePlacement(html.replace(/^\s+|\s+$/g, ""))
    const parsed = parseDocumentShell(clean)
    setDocumentShell(parsed?.shell ?? null)
    if (isFullEmailDocument(clean)) {
      clean = applyLegacyShellAlign(applyLegacyShellBg(clean, settings.bgColor), settings.align)
    }
    onChange(wrapWithSettings(clean, settings))
  }, [onChange, settings])

  // Keep saveRef in sync so the imperative insertVariable picks up the latest
  // save() closure (which depends on documentShell + settings).
  useEffect(() => {
    saveRef.current = save
  }, [save])

  const execCommand = useCallback((command: string, cmdValue?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, cmdValue)
  }, [])

  const handleInput = useCallback(() => {
    save(getContent())
  }, [getContent, save])

  const handleBlur = useCallback(() => {
    // Save current selection range for later restoration (variable insertion)
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      lastRangeRef.current = selection.getRangeAt(0).cloneRange()
    }
    save(getContent())
  }, [getContent, save])

  const scheduleEditorSave = useCallback(() => {
    if (settingsSaveTimerRef.current) {
      window.clearTimeout(settingsSaveTimerRef.current)
    }
    settingsSaveTimerRef.current = window.setTimeout(() => {
      settingsSaveTimerRef.current = null
      save(getContent())
    }, 180)
  }, [getContent, save])

  const clearSelectedTable = useCallback(() => {
    selectedTableRef.current?.removeAttribute(EDITOR_SELECTED_TABLE_ATTR)
    selectedTableCellRef.current?.removeAttribute(EDITOR_SELECTED_CELL_ATTR)
    selectedTableRef.current = null
    selectedTableCellRef.current = null
    setSelectedTableActive(false)
  }, [])

  const clearSelectedLine = useCallback(() => {
    selectedLineRef.current?.removeAttribute(EDITOR_SELECTED_LINE_ATTR)
    selectedLineRef.current = null
    setSelectedLineActive(false)
  }, [])

  const clearSelectedEmailBox = useCallback(() => {
    selectedBoxRef.current?.removeAttribute(EDITOR_SELECTED_BOX_ATTR)
    selectedBoxRef.current = null
    setSelectedBoxActive(false)
  }, [])

  const restoreHistoryContent = useCallback((html: string) => {
    const editor = editorRef.current
    if (!editor) return

    isRestoringHistoryRef.current = true
    try {
      editor.innerHTML = protectTbodyMergeTags(html)
      protectOrphanTbodyMergeText(editor)
      ensureEditorHasEditableEmptyBlock(editor, true)
      clearSelectedEmailBox()
      clearSelectedLine()
      clearSelectedTable()
      save(html)
    } finally {
      isRestoringHistoryRef.current = false
    }
  }, [clearSelectedEmailBox, clearSelectedLine, clearSelectedTable, save])

  const undoHistory = useCallback(() => {
    const previous = historyRef.current.past.pop()
    if (previous === undefined) return

    const current = currentHistoryRef.current ?? getContent()
    historyRef.current.future.push(current)
    currentHistoryRef.current = previous
    updateHistoryControls()
    restoreHistoryContent(previous)
  }, [getContent, restoreHistoryContent, updateHistoryControls])

  const redoHistory = useCallback(() => {
    const next = historyRef.current.future.pop()
    if (next === undefined) return

    const current = currentHistoryRef.current ?? getContent()
    historyRef.current.past.push(current)
    currentHistoryRef.current = next
    updateHistoryControls()
    restoreHistoryContent(next)
  }, [getContent, restoreHistoryContent, updateHistoryControls])

  const handleHistoryShortcut = useCallback((e: KeyboardEvent | React.KeyboardEvent) => {
    const isModifier = e.metaKey || e.ctrlKey
    if (!isModifier || e.altKey) return false

    const key = e.key.toLowerCase()
    if (key === "z" && !e.shiftKey && historyRef.current.past.length > 0) {
      e.preventDefault()
      undoHistory()
      return true
    }

    if ((key === "y" || (key === "z" && e.shiftKey)) && historyRef.current.future.length > 0) {
      e.preventDefault()
      redoHistory()
      return true
    }

    return false
  }, [redoHistory, undoHistory])

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    handleHistoryShortcut(e)
  }, [handleHistoryShortcut])

  useEffect(() => {
    if (sourceMode) return

    function handleDocumentKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      const root = rootRef.current
      const target = e.target as Node | null
      if (!root || !target || !root.contains(target)) return

      const targetEl = target.nodeType === Node.ELEMENT_NODE
        ? target as HTMLElement
        : target.parentElement
      if (targetEl?.closest("input, textarea, select")) return

      handleHistoryShortcut(e)
    }

    document.addEventListener("keydown", handleDocumentKeyDown)
    return () => document.removeEventListener("keydown", handleDocumentKeyDown)
  }, [handleHistoryShortcut, sourceMode])

  const selectEmailBox = useCallback((box: HTMLElement | null) => {
    selectedBoxRef.current?.removeAttribute(EDITOR_SELECTED_BOX_ATTR)
    clearSelectedTable()
    clearSelectedLine()

    if (!box || !editorRef.current?.contains(box)) {
      selectedBoxRef.current = null
      setSelectedBoxActive(false)
      return
    }

    box.setAttribute(EDITOR_SELECTED_BOX_ATTR, "true")
    selectedBoxRef.current = box
    setSelectedBoxActive(true)
    setSelectedBoxBg(readBoxBg(box))
    setSelectedBoxPadding(readBoxPadding(box))
    setSelectedBoxWidth(readBoxWidth(box))
    setSelectedBoxRadius(readBoxRadius(box))
    setSelectedBoxBorderWidth(readBoxBorderWidth(box))
    setSelectedBoxBorderColor(readBoxBorderColor(box))
    setSelectedBoxAlign(readObjectAlign(box))
  }, [clearSelectedLine, clearSelectedTable])

  const selectTable = useCallback((table: HTMLTableElement | null, cell?: HTMLTableCellElement | null) => {
    selectedTableRef.current?.removeAttribute(EDITOR_SELECTED_TABLE_ATTR)
    selectedTableCellRef.current?.removeAttribute(EDITOR_SELECTED_CELL_ATTR)
    clearSelectedEmailBox()
    clearSelectedLine()

    if (!table || !editorRef.current?.contains(table)) {
      selectedTableRef.current = null
      selectedTableCellRef.current = null
      setSelectedTableActive(false)
      return
    }

    const selectedCell = cell && table.contains(cell) ? cell : findTableCell(table, table)
    const columnIndex = getCellColumnIndex(selectedCell)

    table.setAttribute(EDITOR_SELECTED_TABLE_ATTR, "true")
    selectedCell?.setAttribute(EDITOR_SELECTED_CELL_ATTR, "true")
    selectedTableRef.current = table
    selectedTableCellRef.current = selectedCell
    setSelectedTableActive(true)
    setSelectedTableBorderWidth(readTableBorderWidth(table))
    setSelectedTableBorderColor(readTableBorderColor(table))
    setSelectedTableHeaderBg(readTableHeaderBg(table))
    setSelectedTableHeaderTextColor(readTableHeaderTextColor(table))
    setSelectedTableColumnIndex(columnIndex)
    setSelectedTableColumnWidth(readTableColumnWidth(table, columnIndex))
    setSelectedTableAlign(readObjectAlign(table))
  }, [clearSelectedEmailBox, clearSelectedLine])

  const selectLine = useCallback((line: HTMLElement | null) => {
    selectedLineRef.current?.removeAttribute(EDITOR_SELECTED_LINE_ATTR)
    clearSelectedEmailBox()
    clearSelectedTable()

    if (!line || !editorRef.current?.contains(line)) {
      selectedLineRef.current = null
      setSelectedLineActive(false)
      return
    }

    line.setAttribute(EDITOR_SELECTED_LINE_ATTR, "true")
    selectedLineRef.current = line
    setSelectedLineActive(true)
    setSelectedLineWidth(readLineWidth(line))
    setSelectedLineColor(readLineColor(line))
  }, [clearSelectedEmailBox, clearSelectedTable])

  // -- Link dialog --
  const openLinkDialog = useCallback(() => {
    const sel = window.getSelection()
    if (sel && sel.toString().length > 0) {
      setLinkText(sel.toString())
    } else {
      setLinkText("")
    }
    setLinkUrl("")
    setLinkDialogOpen(true)
  }, [])

  const applyLink = useCallback(() => {
    const url = linkUrl.trim()
    if (!url) return
    editorRef.current?.focus()

    // If text was selected, replace selection with a link
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && linkText) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const a = document.createElement("a")
      a.href = url
      a.textContent = linkText
      a.target = "_blank"
      range.insertNode(a)
      // Move cursor after link
      range.setStartAfter(a)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      document.execCommand("createLink", false, url)
    }

    setLinkDialogOpen(false)
    handleBlur()
  }, [linkUrl, linkText, handleBlur])

  // -- Button (CTA) dialog --

  /** Reset dialog fields and open it in "insert" mode. */
  const openInsertButtonDialog = useCallback(() => {
    // Preserve current selection so we can re-target the cursor on apply.
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      lastRangeRef.current = selection.getRangeAt(0).cloneRange()
    }

    editingButtonRef.current = null
    editingButtonBgRef.current = null
    setIsEditingButton(false)

    const selectedText = selection?.toString() ?? ""
    setButtonText(selectedText || "Click here")
    setButtonUrl("")
    setButtonBgMode("solid")
    setButtonBgColor(DEFAULT_BUTTON_BG)
    setButtonGradientFrom(DEFAULT_BUTTON_GRADIENT_FROM)
    setButtonGradientTo(DEFAULT_BUTTON_GRADIENT_TO)
    setButtonTextColor(DEFAULT_BUTTON_FG)
    setButtonPreviewStyle(DEFAULT_BUTTON_PREVIEW_STYLE)
    setButtonBgEdited(false)
    setButtonDialogOpen(true)
  }, [])

  /** Open the dialog in "edit" mode pre-filled from the given anchor. */
  const openEditButtonDialog = useCallback((anchor: HTMLAnchorElement) => {
    const bgElement = findButtonBackgroundElement(anchor, editorRef.current)
    const background = readButtonBackgroundValue(anchor, bgElement)
    const [firstBg, secondBg] = extractBackgroundColors(background)
    const bgMode: ButtonBgMode = isGradientBackground(background) ? "gradient" : "solid"

    editingButtonRef.current = anchor
    editingButtonBgRef.current = bgElement
    setIsEditingButton(true)
    setButtonText(anchor.textContent ?? "")
    setButtonUrl(anchor.getAttribute("href") ?? "")
    setButtonBgMode(bgMode)
    setButtonBgColor(firstBg)
    setButtonGradientFrom(firstBg)
    setButtonGradientTo(secondBg)
    setButtonTextColor(
      readButtonColor(anchor, "text", DEFAULT_BUTTON_FG, editorRef.current),
    )
    setButtonPreviewStyle(readButtonPreviewStyle(anchor, bgElement))
    setButtonBgEdited(false)
    setButtonDialogOpen(true)
  }, [])

  /**
   * Click handler installed on the contentEditable surface. When the user
   * clicks (or focuses via click) on a CTA button, we surface the edit dialog
   * instead of letting the cursor land inside the anchor (which makes the
   * button hard to delete or modify).
   */
  const handleEditorMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = findEnclosingButton(e.target, editorRef.current)
      if (!anchor) return
      e.preventDefault()
      openEditButtonDialog(anchor)
    },
    [openEditButtonDialog],
  )

  /**
   * Place the caret immediately before the given element, focusing the editor.
   */
  const placeCaretBefore = useCallback((el: HTMLElement) => {
    const editor = editorRef.current
    if (!editor || !editor.contains(el)) return

    let before = el.previousSibling
    if (!before || before.nodeType !== Node.TEXT_NODE) {
      const tn = document.createTextNode("\u200B")
      el.parentNode?.insertBefore(tn, el)
      before = tn
    }

    editor.focus()
    const range = document.createRange()
    range.setStart(before, (before as Text).length)
    range.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    lastRangeRef.current = range.cloneRange()
  }, [])

  /**
   * Place the caret immediately after the given element, focusing the editor.
   * Used after the button dialog closes so the user has an obvious cursor
   * position next to the button (and can press Backspace, type adjacent text,
   * or navigate with arrow keys).
   */
  const placeCaretAfter = useCallback((el: HTMLElement) => {
    const editor = editorRef.current
    if (!editor || !editor.contains(el)) return

    // Insert a zero-width space directly after the button if the next sibling
    // isn't a text node — this guarantees the browser has a text node it can
    // anchor the caret to outside the anchor element, instead of snapping the
    // selection back inside the link.
    let after = el.nextSibling
    if (!after || after.nodeType !== Node.TEXT_NODE) {
      const tn = document.createTextNode("\u200B")
      el.parentNode?.insertBefore(tn, el.nextSibling)
      after = tn
    }

    editor.focus()
    const range = document.createRange()
    range.setStart(after, (after as Text).length)
    range.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    lastRangeRef.current = range.cloneRange()
  }, [])

  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    ensureEditorHasEditableEmptyBlock(editorRef.current, true)
    if (findEnclosingButton(e.target, editorRef.current)) return

    const line = findEditableLine(e.target, editorRef.current)
    if (line) {
      selectLine(line)
      return
    }

    const table = findEditableTable(e.target, editorRef.current)
    if (table) {
      selectTable(table, findTableCell(e.target, table))
      return
    }

    const box = findEnclosingEmailBox(e.target, editorRef.current)
    const selectableBox = box && isLargeContentCell(box)
      ? createSectionBoxFromContentCell(e.target, box) ?? box
      : box
    selectEmailBox(selectableBox)
    if (selectableBox && selectableBox !== box) {
      save(getContent())
    }

    window.requestAnimationFrame(() => {
      const selection = window.getSelection()
      if (!selection?.anchorNode) return

      const anchor = findEnclosingButton(selection.anchorNode, editorRef.current)
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      if (e.clientX < rect.left + rect.width / 2) {
        placeCaretBefore(anchor)
      } else {
        placeCaretAfter(anchor)
      }
    })
  }, [getContent, placeCaretAfter, placeCaretBefore, save, selectEmailBox, selectLine, selectTable])

  const insertDividerLine = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const line = document.createElement("hr")
    line.setAttribute("style", "border:0;border-top:1px solid #111111;height:0;margin:20px 0;")

    editor.focus()
    const selection = window.getSelection()
    if (lastRangeRef.current && selection) {
      selection.removeAllRanges()
      selection.addRange(lastRangeRef.current)
    }

    const activeSelection = window.getSelection()
    if (activeSelection && activeSelection.rangeCount > 0 && editor.contains(activeSelection.anchorNode)) {
      const range = activeSelection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(line)
    } else {
      editor.appendChild(line)
    }

    placeCaretAfter(line)
    selectLine(line)
    save(getContent())
  }, [getContent, placeCaretAfter, save, selectLine])

  const insertTable = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const table = createEditableTable()

    editor.focus()
    const selection = window.getSelection()
    if (lastRangeRef.current && selection) {
      selection.removeAllRanges()
      selection.addRange(lastRangeRef.current)
    }

    const activeSelection = window.getSelection()
    if (activeSelection && activeSelection.rangeCount > 0 && editor.contains(activeSelection.anchorNode)) {
      const range = activeSelection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(table)
    } else {
      editor.appendChild(table)
    }

    placeCaretAfter(table)
    selectTable(table)
    save(getContent())
  }, [getContent, placeCaretAfter, save, selectTable])

  const insertEmailBox = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const table = createEmailBox(DEFAULT_BOX_BG, DEFAULT_BOX_PADDING, DEFAULT_BOX_WIDTH)
    const cell = getBoxPaddingElement(table)

    editor.focus()
    const selection = window.getSelection()
    if (lastRangeRef.current && selection) {
      selection.removeAllRanges()
      selection.addRange(lastRangeRef.current)
    }

    const activeSelection = window.getSelection()
    if (
      activeSelection &&
      activeSelection.rangeCount > 0 &&
      editor.contains(activeSelection.anchorNode)
    ) {
      const range = activeSelection.getRangeAt(0)
      if (!range.collapsed) {
        cell.appendChild(range.extractContents())
      } else {
        cell.innerHTML = '<p style="margin:0;color:#52525b;font-size:14px;line-height:22px;">New empty card</p>'
      }
      range.insertNode(table)
    } else {
      cell.innerHTML = '<p style="margin:0;color:#52525b;font-size:14px;line-height:22px;">New empty card</p>'
      editor.appendChild(table)
    }

    placeCaretAfter(table)
    selectEmailBox(table)
    save(getContent())
  }, [getContent, placeCaretAfter, save, selectEmailBox])

  const updateSelectedBoxBg = useCallback((color: string) => {
    setSelectedBoxBg(color)
    const box = selectedBoxRef.current
    if (!box || !editorRef.current?.contains(box)) return

    box.style.removeProperty("background")
    box.style.backgroundColor = color
    if (box.tagName === "TABLE" || box.tagName === "TD") {
      box.setAttribute("bgcolor", color)
    }
    scheduleEditorSave()
  }, [scheduleEditorSave])

  const updateSelectedBoxPadding = useCallback((value: string) => {
    setSelectedBoxPadding(value)

    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return

    const normalized = String(Math.max(0, Math.min(120, parsed)))
    const box = selectedBoxRef.current
    if (!box || !editorRef.current?.contains(box)) return

    if (normalized !== value) {
      setSelectedBoxPadding(normalized)
    }
    getBoxPaddingElement(box).style.padding = `${normalized}px`
    scheduleEditorSave()
  }, [scheduleEditorSave])

  const updateSelectedBoxWidth = useCallback((value: string) => {
    setSelectedBoxWidth(value)

    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return

    const normalized = String(Math.max(1, parsed))
    const box = selectedBoxRef.current
    if (!box || !editorRef.current?.contains(box)) return

    if (normalized !== value) {
      setSelectedBoxWidth(normalized)
    }
    applyBoxWidth(box, normalized)
    scheduleEditorSave()
  }, [scheduleEditorSave])

  const updateSelectedBoxRadius = useCallback((value: string) => {
    setSelectedBoxRadius(value)

    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return

    const normalized = String(Math.max(0, parsed))
    const box = selectedBoxRef.current
    if (!box || !editorRef.current?.contains(box)) return

    if (normalized !== value) {
      setSelectedBoxRadius(normalized)
    }
    box.style.borderRadius = `${normalized}px`
    box.style.overflow = normalized === "0" ? "" : "hidden"
    scheduleEditorSave()
  }, [scheduleEditorSave])

  const updateSelectedBoxBorderWidth = useCallback((value: string) => {
    setSelectedBoxBorderWidth(value)

    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return

    const normalized = String(Math.max(0, parsed))
    const box = selectedBoxRef.current
    if (!box || !editorRef.current?.contains(box)) return

    if (normalized !== value) {
      setSelectedBoxBorderWidth(normalized)
    }
    applyBoxBorder(box, normalized, selectedBoxBorderColor)
    scheduleEditorSave()
  }, [scheduleEditorSave, selectedBoxBorderColor])

  const updateSelectedBoxBorderColor = useCallback((color: string) => {
    setSelectedBoxBorderColor(color)
    const box = selectedBoxRef.current
    if (!box || !editorRef.current?.contains(box)) return

    applyBoxBorder(box, selectedBoxBorderWidth, color)
    scheduleEditorSave()
  }, [scheduleEditorSave, selectedBoxBorderWidth])

  const updateSelectedBoxAlign = useCallback((align: EmailAlign) => {
    setSelectedBoxAlign(align)
    const box = selectedBoxRef.current
    if (!box || !editorRef.current?.contains(box)) return

    applyObjectAlign(box, align)
    scheduleEditorSave()
  }, [scheduleEditorSave])

  const updateSelectedLineWidth = useCallback((value: string) => {
    setSelectedLineWidth(value)
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return

    const normalized = String(Math.max(0, parsed))
    const line = selectedLineRef.current
    if (!line || !editorRef.current?.contains(line)) return

    if (normalized !== value) setSelectedLineWidth(normalized)
    applyLineStyle(line, normalized, selectedLineColor)
    scheduleEditorSave()
  }, [scheduleEditorSave, selectedLineColor])

  const updateSelectedLineColor = useCallback((color: string) => {
    setSelectedLineColor(color)
    const line = selectedLineRef.current
    if (!line || !editorRef.current?.contains(line)) return

    applyLineStyle(line, selectedLineWidth, color)
    scheduleEditorSave()
  }, [scheduleEditorSave, selectedLineWidth])

  const removeSelectedLine = useCallback(() => {
    const line = selectedLineRef.current
    if (!line || !editorRef.current?.contains(line)) return

    line.remove()
    clearSelectedLine()
    save(getContent())
  }, [clearSelectedLine, getContent, save])

  const updateSelectedTableBorderWidth = useCallback((value: string) => {
    setSelectedTableBorderWidth(value)
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return

    const normalized = String(Math.max(0, parsed))
    const table = selectedTableRef.current
    if (!table || !editorRef.current?.contains(table)) return

    if (normalized !== value) setSelectedTableBorderWidth(normalized)
    applyTableBorder(table, normalized, selectedTableBorderColor)
    scheduleEditorSave()
  }, [scheduleEditorSave, selectedTableBorderColor])

  const updateSelectedTableBorderColor = useCallback((color: string) => {
    setSelectedTableBorderColor(color)
    const table = selectedTableRef.current
    if (!table || !editorRef.current?.contains(table)) return

    applyTableBorder(table, selectedTableBorderWidth, color)
    scheduleEditorSave()
  }, [scheduleEditorSave, selectedTableBorderWidth])

  const updateSelectedTableHeaderBg = useCallback((color: string) => {
    setSelectedTableHeaderBg(color)
    const table = selectedTableRef.current
    if (!table || !editorRef.current?.contains(table)) return

    applyTableHeaderStyle(table, color, selectedTableHeaderTextColor)
    scheduleEditorSave()
  }, [scheduleEditorSave, selectedTableHeaderTextColor])

  const updateSelectedTableHeaderTextColor = useCallback((color: string) => {
    setSelectedTableHeaderTextColor(color)
    const table = selectedTableRef.current
    if (!table || !editorRef.current?.contains(table)) return

    applyTableHeaderStyle(table, selectedTableHeaderBg, color)
    scheduleEditorSave()
  }, [scheduleEditorSave, selectedTableHeaderBg])

  const updateSelectedTableColumnWidth = useCallback((value: string) => {
    setSelectedTableColumnWidth(value)
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return

    const normalized = String(Math.max(1, parsed))
    const table = selectedTableRef.current
    if (!table || !editorRef.current?.contains(table)) return

    if (normalized !== value) setSelectedTableColumnWidth(normalized)
    applyTableColumnWidth(table, selectedTableColumnIndex, normalized)
    scheduleEditorSave()
  }, [scheduleEditorSave, selectedTableColumnIndex])

  const updateSelectedTableAlign = useCallback((align: EmailAlign) => {
    setSelectedTableAlign(align)
    const table = selectedTableRef.current
    if (!table || !editorRef.current?.contains(table)) return

    applyObjectAlign(table, align)
    scheduleEditorSave()
  }, [scheduleEditorSave])

  const addSelectedTableRow = useCallback(() => {
    const table = selectedTableRef.current
    if (!table || !editorRef.current?.contains(table)) return

    const cell = addTableRowAfterSelection(table, selectedTableCellRef.current)
    selectTable(table, cell)
    save(getContent())
  }, [getContent, save, selectTable])

  const removeSelectedTableRow = useCallback(() => {
    const table = selectedTableRef.current
    if (!table || !editorRef.current?.contains(table)) return

    const cell = removeTableRowAtSelection(table, selectedTableCellRef.current)
    selectTable(table, cell)
    save(getContent())
  }, [getContent, save, selectTable])

  const addSelectedTableColumn = useCallback(() => {
    const table = selectedTableRef.current
    if (!table || !editorRef.current?.contains(table)) return

    const cell = addTableColumnAfterSelection(table, selectedTableCellRef.current)
    selectTable(table, cell)
    save(getContent())
  }, [getContent, save, selectTable])

  const removeSelectedTableColumn = useCallback(() => {
    const table = selectedTableRef.current
    if (!table || !editorRef.current?.contains(table)) return

    const cell = removeTableColumnAtSelection(table, selectedTableCellRef.current)
    selectTable(table, cell)
    save(getContent())
  }, [getContent, save, selectTable])

  const removeSelectedTable = useCallback(() => {
    const table = selectedTableRef.current
    if (!table || !editorRef.current?.contains(table)) return

    table.remove()
    clearSelectedTable()
    save(getContent())
  }, [clearSelectedTable, getContent, save])

  const removeSelectedBox = useCallback(() => {
    const box = selectedBoxRef.current
    if (!box || !editorRef.current?.contains(box)) return

    if (box.tagName === "TD") {
      const table = box.closest("table") as HTMLTableElement | null
      const isSingleCellTable = table?.rows.length === 1 && table.rows[0]?.cells.length === 1
      if (table?.getAttribute(EMAIL_BOX_ATTR) === "true" || isSingleCellTable) {
        table.remove()
      } else {
        box.replaceChildren()
      }
    } else {
      box.remove()
    }

    ensureEditorHasEditableEmptyBlock(editorRef.current, true)
    clearSelectedEmailBox()
    save(getContent())
  }, [clearSelectedEmailBox, getContent, save])

  const updateButtonBackgroundPreview = useCallback(
    (mode: ButtonBgMode, solid: string, from: string, to: string) => {
      setButtonPreviewStyle((prev) => ({
        ...prev,
        background: buildButtonBackground(mode, solid, from, to),
      }))
    },
    [],
  )

  const updateButtonBgMode = useCallback((mode: ButtonBgMode) => {
    setButtonBgMode(mode)
    setButtonBgEdited(true)
    updateButtonBackgroundPreview(mode, buttonBgColor, buttonGradientFrom, buttonGradientTo)
  }, [buttonBgColor, buttonGradientFrom, buttonGradientTo, updateButtonBackgroundPreview])

  const updateButtonBgColor = useCallback((value: string) => {
    setButtonBgColor(value)
    setButtonBgEdited(true)
    updateButtonBackgroundPreview(buttonBgMode, value, buttonGradientFrom, buttonGradientTo)
  }, [buttonBgMode, buttonGradientFrom, buttonGradientTo, updateButtonBackgroundPreview])

  const updateButtonGradientFrom = useCallback((value: string) => {
    setButtonGradientFrom(value)
    setButtonBgEdited(true)
    updateButtonBackgroundPreview(buttonBgMode, buttonBgColor, value, buttonGradientTo)
  }, [buttonBgColor, buttonBgMode, buttonGradientTo, updateButtonBackgroundPreview])

  const updateButtonGradientTo = useCallback((value: string) => {
    setButtonGradientTo(value)
    setButtonBgEdited(true)
    updateButtonBackgroundPreview(buttonBgMode, buttonBgColor, buttonGradientFrom, value)
  }, [buttonBgColor, buttonBgMode, buttonGradientFrom, updateButtonBackgroundPreview])

  const updateButtonTextColor = useCallback((value: string) => {
    setButtonTextColor(value)
    setButtonPreviewStyle((prev) => ({ ...prev, color: value }))
  }, [])

  /** Insert a new button or apply edits to the editing button. */
  const applyButton = useCallback(() => {
    const url = buttonUrl.trim()
    const text = buttonText.trim() || "Click here"
    if (!url) return

    const buttonBackground = buildButtonBackground(
      buttonBgMode,
      buttonBgColor,
      buttonGradientFrom,
      buttonGradientTo,
    )
    const styleStr = buildButtonStyle(
      buttonBgColor,
      buttonTextColor,
      buttonBgMode,
      buttonGradientFrom,
      buttonGradientTo,
    )

    const existing = editingButtonRef.current
    if (existing) {
      existing.setAttribute("href", url)
      existing.setAttribute("target", "_blank")
      existing.setAttribute("rel", "noopener noreferrer")
      existing.setAttribute(CTA_BUTTON_ATTR, "true")
      existing.style.color = buttonTextColor
      existing.textContent = text

      if (buttonBgEdited) {
        existing.style.background = buttonBackground
        existing.style.removeProperty("background-color")

        const visualBg = editingButtonBgRef.current
        if (visualBg && visualBg !== existing && editorRef.current?.contains(visualBg)) {
          visualBg.style.background = buttonBackground
          visualBg.style.removeProperty("background-color")
          visualBg.removeAttribute("bgcolor")
        }
      }
    } else {
      const a = document.createElement("a")
      a.setAttribute("href", url)
      a.setAttribute("target", "_blank")
      a.setAttribute("rel", "noopener noreferrer")
      a.setAttribute(CTA_BUTTON_ATTR, "true")
      a.setAttribute("style", styleStr)
      a.textContent = text

      editorRef.current?.focus()

      // Restore the cursor position captured when the dialog was opened.
      const sel = window.getSelection()
      if (lastRangeRef.current && sel) {
        sel.removeAllRanges()
        sel.addRange(lastRangeRef.current)
      }

      if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        range.insertNode(a)
      } else {
        editorRef.current?.appendChild(a)
      }
      // Drop the caret immediately after the newly inserted button.
      placeCaretAfter(a)
    }

    // For edit mode, place the caret after the (possibly modified) button so
    // the user can continue working adjacent to it.
    if (existing) {
      placeCaretAfter(existing)
    }

    editingButtonRef.current = null
    editingButtonBgRef.current = null
    setButtonBgEdited(false)
    setIsEditingButton(false)
    setButtonDialogOpen(false)
    save(getContent())
  }, [
    buttonUrl,
    buttonText,
    buttonBgMode,
    buttonBgColor,
    buttonGradientFrom,
    buttonGradientTo,
    buttonTextColor,
    buttonBgEdited,
    save,
    getContent,
    placeCaretAfter,
  ])

  /** Remove the button currently being edited. */
  const removeButton = useCallback(() => {
    const existing = editingButtonRef.current
    if (existing) {
      existing.remove()
    }
    editingButtonRef.current = null
    editingButtonBgRef.current = null
    setButtonBgEdited(false)
    setIsEditingButton(false)
    setButtonDialogOpen(false)
    save(getContent())
  }, [save, getContent])

  // Re-save content when settings change (e.g. width, bg color, center).
  // Skip when source-only markup is active — it manages its own internal layout.
  useEffect(() => {
    if (!mountedRef.current) return
    if (needsSourceOnly) return

    const editor = editorRef.current
    if (editor && documentShell) {
      const updatedBody = applyLegacyShellAlign(applyLegacyShellBg(editor.innerHTML, settings.bgColor), settings.align)
      if (updatedBody !== editor.innerHTML) {
        editor.innerHTML = updatedBody
      }
    }

    if (settingsSaveTimerRef.current) {
      window.clearTimeout(settingsSaveTimerRef.current)
    }

    settingsSaveTimerRef.current = window.setTimeout(() => {
      settingsSaveTimerRef.current = null
      save(getContent())
    }, 180)

    return () => {
      if (settingsSaveTimerRef.current) {
        window.clearTimeout(settingsSaveTimerRef.current)
        settingsSaveTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  // -- Settings changes --
  const updateSettings = useCallback((patch: Partial<EmailSettings>) => {
    setSettings((prev) => normalizeEmailSettings({ ...prev, ...patch }))
  }, [])

  const updateEmailAlign = useCallback((align: EmailAlign) => {
    updateSettings({ align, centered: align === "center" })
  }, [updateSettings])

  const flushPendingSettingsSave = useCallback(() => {
    if (!settingsSaveTimerRef.current) return
    window.clearTimeout(settingsSaveTimerRef.current)
    settingsSaveTimerRef.current = null
    save(getContent())
  }, [getContent, save])

  // -- Source mode toggle --
  const toggleSourceMode = useCallback(() => {
    if (sourceMode) {
      const trimmed = repairTbodyMergePlacement(sourceValue.trim())
      // Malformed tbody+{{ still forces staying in source mode
      if (hasMalformedTbodyMergeTag(trimmed)) return

      // If source contains a full HTML doc, extract the body for visual
      // editing and keep the shell.
      const parsed = parseDocumentShell(trimmed)
      if (parsed) {
        setDocumentShell(parsed.shell)
        if (editorRef.current) {
          editorRef.current.innerHTML = parsed.bodyContent
          protectOrphanTbodyMergeText(editorRef.current)
        }
        onChange(wrapWithSettings(trimmed, settings))
      } else {
        setDocumentShell(null)
        save(trimmed)
      }
      setSourceMode(false)
    } else {
      // Show the full (reassembled) HTML document in source mode if we have a shell.
      const visualBody = getContent()
      const sourceFull = documentShell
        ? applyLegacyShellAlign(applyLegacyShellBg(reconstructWithShell(visualBody, documentShell), settings.bgColor), settings.align)
        : visualBody
      setSourceValue(sourceFull)
      setSourceMode(true)
    }
  }, [sourceMode, sourceValue, getContent, save, documentShell, onChange, settings])

  // -- Color --
  const handleColorChange = useCallback((color: string) => {
    execCommand("foreColor", color)
    handleBlur()
  }, [execCommand, handleBlur])

  // -- Font selector --
  const selectFont = useCallback((font: FontOption) => {
    if (font.isGoogle) {
      loadGoogleFont(font.name)
    }
    setSelectedFontFamily(font.family)
    setFontDropdownOpen(false)
    execCommand("fontName", font.family)
    handleBlur()
  }, [execCommand, handleBlur])

  // Close font dropdown on outside click
  useEffect(() => {
    if (!fontDropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node)) {
        setFontDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [fontDropdownOpen])

  // Pre-load first 10 Google fonts on mount
  useEffect(() => {
    GOOGLE_FONTS.slice(0, 10).forEach((f) => loadGoogleFont(f.name))
  }, [])

  // -- Toolbar button --
  function ToolbarBtn({
    icon: Icon,
    label,
    onClick,
    active,
    disabled,
  }: {
    icon: React.ElementType
    label: string
    onClick: () => void
    active?: boolean
    disabled?: boolean
  }) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("group relative h-7 w-7 overflow-visible", active && "bg-muted text-foreground")}
        onClick={onClick}
        aria-label={label}
        disabled={disabled}
      >
        <Icon className="h-3.5 w-3.5" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {label}
        </span>
      </Button>
    )
  }

  return (
    <div ref={rootRef} className={cn("border rounded-md overflow-hidden", className)}>
      <style>{`
        .rich-editor-content h1 {
          display: block;
          margin: 0 0 16px;
          font-size: 32px;
          line-height: 40px;
          font-weight: 800;
        }
        .rich-editor-content h2 {
          display: block;
          margin: 0 0 14px;
          font-size: 24px;
          line-height: 32px;
          font-weight: 750;
        }
        .rich-editor-content h3 {
          display: block;
          margin: 0 0 12px;
          font-size: 19px;
          line-height: 28px;
          font-weight: 700;
        }
        .rich-editor-content p {
          margin: 0 0 12px;
        }
        .rich-editor-content [${EDITOR_SELECTED_BOX_ATTR}="true"],
        .rich-editor-content [${EDITOR_SELECTED_TABLE_ATTR}="true"],
        .rich-editor-content [${EDITOR_SELECTED_LINE_ATTR}="true"] {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 4px;
        }
        .rich-editor-content [${EDITOR_SELECTED_CELL_ATTR}="true"] {
          box-shadow: inset 0 0 0 2px hsl(var(--primary));
        }
      `}</style>
      {/* ── Email Settings Bar ── */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 px-3 py-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">Email</span>

          {/* Background color */}
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">BG</Label>
            <input
              type="color"
              value={settings.bgColor}
              className="h-6 w-6 cursor-pointer rounded border bg-transparent p-0"
              title="Email Background Color"
              onChange={(e) => updateSettings({ bgColor: e.target.value })}
              onBlur={flushPendingSettingsSave}
              onMouseUp={flushPendingSettingsSave}
            />
          </div>

          {/* Email alignment */}
          <div className="flex items-center gap-0.5 rounded-md border bg-background/50 p-0.5" title="Email alignment">
            <Button
              type="button"
              variant={settings.align === "left" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6"
              onClick={() => updateEmailAlign("left")}
              aria-label="Align email left"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={settings.align === "center" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6"
              onClick={() => updateEmailAlign("center")}
              aria-label="Align email center"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={settings.align === "right" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6"
              onClick={() => updateEmailAlign("right")}
              aria-label="Align email right"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {selectedBoxActive && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background/70 px-2 py-1">
              <span className="text-xs font-medium text-muted-foreground">Box</span>
              <div className="flex items-center gap-0.5" title="Selected box alignment">
                <Button
                  type="button"
                  variant={selectedBoxAlign === "left" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => updateSelectedBoxAlign("left")}
                  aria-label="Align selected box left"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant={selectedBoxAlign === "center" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => updateSelectedBoxAlign("center")}
                  aria-label="Align selected box center"
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant={selectedBoxAlign === "right" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => updateSelectedBoxAlign("right")}
                  aria-label="Align selected box right"
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <input
                type="color"
                value={selectedBoxBg}
                className="h-6 w-6 cursor-pointer rounded border bg-transparent p-0"
                title="Selected Box Background"
                onChange={(e) => updateSelectedBoxBg(e.target.value)}
              />
              <Label htmlFor="selected-box-width" className="text-xs text-muted-foreground">
                W
              </Label>
              <Input
                id="selected-box-width"
                type="number"
                min={1}
                value={selectedBoxWidth}
                onChange={(e) => updateSelectedBoxWidth(e.target.value)}
                className="h-6 w-20 px-2 text-xs"
                title="Form width in pixels"
              />
              <Label htmlFor="selected-box-padding" className="text-xs text-muted-foreground">
                Pad
              </Label>
              <Input
                id="selected-box-padding"
                type="number"
                min={0}
                value={selectedBoxPadding}
                onChange={(e) => updateSelectedBoxPadding(e.target.value)}
                className="h-6 w-16 px-2 text-xs"
                title="Form padding in pixels"
              />
              <Label htmlFor="selected-box-radius" className="text-xs text-muted-foreground">
                R
              </Label>
              <Input
                id="selected-box-radius"
                type="number"
                min={0}
                value={selectedBoxRadius}
                onChange={(e) => updateSelectedBoxRadius(e.target.value)}
                className="h-6 w-16 px-2 text-xs"
                title="Form border radius in pixels"
              />
              <Label htmlFor="selected-box-border-width" className="text-xs text-muted-foreground">
                Border
              </Label>
              <Input
                id="selected-box-border-width"
                type="number"
                min={0}
                value={selectedBoxBorderWidth}
                onChange={(e) => updateSelectedBoxBorderWidth(e.target.value)}
                className="h-6 w-14 px-2 text-xs"
                title="Form border width in pixels"
              />
              <input
                type="color"
                value={selectedBoxBorderColor}
                className="h-6 w-6 cursor-pointer rounded border bg-transparent p-0"
                title="Selected Box Border Color"
                onChange={(e) => updateSelectedBoxBorderColor(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                title="Remove selected box"
                onClick={removeSelectedBox}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {selectedTableActive && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background/70 px-2 py-1">
              <span className="text-xs font-medium text-muted-foreground">Table</span>
              <div className="flex items-center gap-0.5" title="Selected table alignment">
                <Button
                  type="button"
                  variant={selectedTableAlign === "left" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => updateSelectedTableAlign("left")}
                  aria-label="Align selected table left"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant={selectedTableAlign === "center" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => updateSelectedTableAlign("center")}
                  aria-label="Align selected table center"
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant={selectedTableAlign === "right" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => updateSelectedTableAlign("right")}
                  aria-label="Align selected table right"
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Label htmlFor="selected-table-border-width" className="text-xs text-muted-foreground">
                Border
              </Label>
              <Input
                id="selected-table-border-width"
                type="number"
                min={0}
                value={selectedTableBorderWidth}
                onChange={(e) => updateSelectedTableBorderWidth(e.target.value)}
                className="h-6 w-14 px-2 text-xs"
                title="Table border width in pixels"
              />
              <input
                type="color"
                value={selectedTableBorderColor}
                className="h-6 w-6 cursor-pointer rounded border bg-transparent p-0"
                title="Table Border Color"
                onChange={(e) => updateSelectedTableBorderColor(e.target.value)}
              />
              <Label className="text-xs text-muted-foreground">Head</Label>
              <input
                type="color"
                value={selectedTableHeaderBg}
                className="h-6 w-6 cursor-pointer rounded border bg-transparent p-0"
                title="Header Background Color"
                onChange={(e) => updateSelectedTableHeaderBg(e.target.value)}
              />
              <input
                type="color"
                value={selectedTableHeaderTextColor}
                className="h-6 w-6 cursor-pointer rounded border bg-transparent p-0"
                title="Header Text Color"
                onChange={(e) => updateSelectedTableHeaderTextColor(e.target.value)}
              />
              <Label htmlFor="selected-table-column-width" className="text-xs text-muted-foreground">
                Col {selectedTableColumnIndex + 1}
              </Label>
              <Input
                id="selected-table-column-width"
                type="number"
                min={1}
                value={selectedTableColumnWidth}
                onChange={(e) => updateSelectedTableColumnWidth(e.target.value)}
                className="h-6 w-16 px-2 text-xs"
                title="Selected column width in pixels"
              />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 px-2 text-xs"
                title="Add row below the selected row"
                onClick={addSelectedTableRow}
              >
                + Row
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 px-2 text-xs"
                title="Remove selected row"
                onClick={removeSelectedTableRow}
              >
                - Row
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 px-2 text-xs"
                title="Add column after the selected column"
                onClick={addSelectedTableColumn}
              >
                + Col
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 px-2 text-xs"
                title="Remove selected column"
                onClick={removeSelectedTableColumn}
              >
                - Col
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                title="Remove selected table"
                onClick={removeSelectedTable}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {selectedLineActive && (
            <div className="flex items-center gap-2 rounded-md border bg-background/70 px-2 py-1">
              <span className="text-xs font-medium text-muted-foreground">Line</span>
              <Label htmlFor="selected-line-width" className="text-xs text-muted-foreground">
                Thick
              </Label>
              <Input
                id="selected-line-width"
                type="number"
                min={0}
                value={selectedLineWidth}
                onChange={(e) => updateSelectedLineWidth(e.target.value)}
                className="h-6 w-14 px-2 text-xs"
                title="Line thickness in pixels"
              />
              <input
                type="color"
                value={selectedLineColor}
                className="h-6 w-6 cursor-pointer rounded border bg-transparent p-0"
                title="Line Color"
                onChange={(e) => updateSelectedLineColor(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                title="Remove selected line"
                onClick={removeSelectedLine}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {toolbarEnd ? (
          <div className="ml-auto shrink-0">{toolbarEnd}</div>
        ) : null}
      </div>

      {needsSourceOnly && (
        <div className="border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground leading-snug">
          <span className="font-medium text-foreground/80">HTML only</span>
          {' — '}
          This template contains markup that can&apos;t be edited visually. Fix the{' '}
          <span className="font-mono text-foreground/80">{'<tbody>{{...}}'}</span> pattern (wrap the
          merge tag in a <span className="font-mono text-foreground/80">{'<tr><td>'}</span>) to enable Visual editing.
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1">
        {!sourceMode && (
          <>
            <ToolbarBtn icon={Undo2} label="Undo (Ctrl+Z)" onClick={undoHistory} disabled={!canUndo} />
            <ToolbarBtn icon={Redo2} label="Redo (Ctrl+Y)" onClick={redoHistory} disabled={!canRedo} />

            <div className="mx-1 h-4 w-px bg-border" />

            <ToolbarBtn icon={Heading1} label="Heading 1" onClick={() => { execCommand("formatBlock", "<h1>"); handleBlur() }} />
            <ToolbarBtn icon={Heading2} label="Heading 2" onClick={() => { execCommand("formatBlock", "<h2>"); handleBlur() }} />
            <ToolbarBtn icon={Heading3} label="Heading 3" onClick={() => { execCommand("formatBlock", "<h3>"); handleBlur() }} />
            <ToolbarBtn icon={Type} label="Paragraph" onClick={() => { execCommand("formatBlock", "<p>"); handleBlur() }} />

            <div className="mx-1 h-4 w-px bg-border" />

            <Select onValueChange={(v) => { execCommand("fontSize", v); handleBlur() }}>
              <SelectTrigger className="h-7 w-[80px] text-xs">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-xs">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Font family selector */}
            <div ref={fontDropdownRef} className="relative">
              <button
                type="button"
                className="h-7 text-xs bg-background border rounded px-1.5 flex items-center gap-1 hover:bg-muted/50"
                onClick={() => setFontDropdownOpen((o) => !o)}
                title="Font Family"
              >
                <span
                  className="truncate max-w-[70px]"
                  style={{ fontFamily: selectedFontFamily }}
                >
                  {findFontByFamily(selectedFontFamily)?.name ?? "Default"}
                </span>
              </button>
              {fontDropdownOpen && (
                <div className="absolute top-full left-0 z-50 mt-0.5 w-[180px] max-h-[280px] overflow-y-auto rounded-md border bg-popover shadow-md py-1">
                  {FONT_GROUPS.map((group, gi) => (
                    <Fragment key={group.label}>
                      {gi > 0 && <div className="my-1 border-t" />}
                      <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        {group.label}
                      </div>
                      {group.fonts.map((font) => (
                        <button
                          key={font.family}
                          type="button"
                          className={cn(
                            "w-full text-left px-2 py-1 text-xs hover:bg-muted/50 cursor-pointer",
                            selectedFontFamily === font.family && "bg-muted"
                          )}
                          style={{ fontFamily: font.family }}
                          onClick={() => selectFont(font)}
                        >
                          {font.name}
                        </button>
                      ))}
                    </Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Text color */}
            <input
              type="color"
              defaultValue="#000000"
              className="h-7 w-7 cursor-pointer rounded border bg-transparent p-0.5"
              title="Text Color"
              onChange={(e) => handleColorChange(e.target.value)}
            />

            <div className="mx-1 h-4 w-px bg-border" />

            <ToolbarBtn icon={Bold} label="Bold (Ctrl+B)" onClick={() => { execCommand("bold"); handleBlur() }} />
            <ToolbarBtn icon={Italic} label="Italic (Ctrl+I)" onClick={() => { execCommand("italic"); handleBlur() }} />
            <ToolbarBtn icon={Underline} label="Underline (Ctrl+U)" onClick={() => { execCommand("underline"); handleBlur() }} />

            <div className="mx-1 h-4 w-px bg-border" />

            <ToolbarBtn icon={AlignLeft} label="Align Left" onClick={() => { execCommand("justifyLeft"); handleBlur() }} />
            <ToolbarBtn icon={AlignCenter} label="Align Center" onClick={() => { execCommand("justifyCenter"); handleBlur() }} />
            <ToolbarBtn icon={AlignRight} label="Align Right" onClick={() => { execCommand("justifyRight"); handleBlur() }} />

            <div className="mx-1 h-4 w-px bg-border" />

            <ToolbarBtn icon={List} label="Bullet List" onClick={() => { execCommand("insertUnorderedList"); handleBlur() }} />
            <ToolbarBtn icon={ListOrdered} label="Numbered List" onClick={() => { execCommand("insertOrderedList"); handleBlur() }} />
            <ToolbarBtn icon={Minus} label="Insert Divider Line" onClick={insertDividerLine} active={selectedLineActive} />
            <ToolbarBtn icon={Table} label="Insert Table" onClick={insertTable} active={selectedTableActive} />
            <ToolbarBtn icon={Link} label="Insert Link" onClick={openLinkDialog} />
            <ToolbarBtn
              icon={MousePointerClick}
              label="Insert Button"
              onClick={openInsertButtonDialog}
            />
            <ToolbarBtn
              icon={SquarePlus}
              label="Insert Empty Card"
              onClick={insertEmailBox}
              active={selectedBoxActive}
            />
            <ToolbarBtn
              icon={ImageIcon}
              label="Insert Image"
              onClick={() => imageInputRef.current?.click()}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 500 * 1024) {
                  console.warn('Image is too large (max 500KB). Skipping insertion.')
                  e.target.value = ''
                  return
                }
                const reader = new FileReader()
                reader.onload = () => {
                  editorRef.current?.focus()
                  document.execCommand('insertImage', false, reader.result as string)
                  handleBlur()
                }
                reader.readAsDataURL(file)
                e.target.value = ''
              }}
            />
          </>
        )}

        <div className="flex-1" />

        {/* Source mode toggle */}
        <Button
          type="button"
          variant={sourceMode ? "secondary" : "ghost"}
          size="xs"
          className="h-7 text-xs gap-1"
          onClick={toggleSourceMode}
          disabled={sourceMode && hasMalformedTbodyMergeTag(sourceValue)}
          title={
            sourceMode && hasMalformedTbodyMergeTag(sourceValue)
              ? "Fix the malformed table markup before switching to Visual."
              : undefined
          }
        >
          {sourceMode ? (
            hasMalformedTbodyMergeTag(sourceValue) ? (
              <><CodeXml className="h-3.5 w-3.5" /> HTML</>
            ) : (
              <><Code className="h-3.5 w-3.5" /> Visual</>
            )
          ) : (
            <><CodeXml className="h-3.5 w-3.5" /> HTML</>
          )}
        </Button>
      </div>

      {/* ── Editor Area ── */}
      {sourceMode ? (
        <textarea
          className="w-full flex-1 min-h-0 font-mono text-xs p-3 focus:outline-none resize-none bg-gray-50"
          style={{ color: '#000000' }}
          value={sourceValue}
          onChange={(e) => {
            setSourceValue(e.target.value)
            saveSource(e.target.value)
          }}
        />
      ) : (
        <div className={cn("flex-1 min-h-0 overflow-y-auto", isWideEmailLayout ? "p-0" : "p-4")} style={{ backgroundColor: canvasBgColor }}>
          <div
            style={{
              ...wrapperStyle({ ...settings, bgColor: canvasBgColor }),
              color: '#000000',
              padding: isWideEmailLayout ? "0" : "24px",
              fontFamily: "sans-serif",
              transition: "max-width 0.2s, background-color 0.2s",
            }}
          >
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="focus:outline-none rich-editor-content"
              style={{ minHeight, backgroundColor: isWideEmailLayout ? canvasBgColor : undefined }}
              data-placeholder={placeholder}
              onInput={handleInput}
              onBlur={handleBlur}
              onKeyDown={handleEditorKeyDown}
              onFocus={() => ensureEditorHasEditableEmptyBlock(editorRef.current, true)}
              onMouseDown={handleEditorMouseDown}
              onClick={handleEditorClick}
            />
          </div>
        </div>
      )}

      {/* ── Link Dialog ── */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>
              Add a hyperlink. If text was selected, it will be used as the link text.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyLink()
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-text">Link Text</Label>
              <Input
                id="link-text"
                placeholder="Click here"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyLink()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyLink} disabled={!linkUrl.trim()}>
              Insert Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Button (CTA) Dialog ── */}
      <Dialog
        open={buttonDialogOpen}
        onOpenChange={(open) => {
          setButtonDialogOpen(open)
          if (!open) {
            // When closing, drop the caret right after the button (if it still
            // exists in the DOM) so the user can keep typing adjacent to it,
            // press Backspace to delete characters, or arrow-key around it
            // instead of getting trapped inside the anchor.
            const editing = editingButtonRef.current
            if (editing && editorRef.current?.contains(editing)) {
              placeCaretAfter(editing)
            }
            editingButtonRef.current = null
            editingButtonBgRef.current = null
            setButtonBgEdited(false)
            setIsEditingButton(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditingButton ? "Edit Button" : "Insert Button"}
            </DialogTitle>
            <DialogDescription>
              {isEditingButton
                ? "Update the button text, link target, or colors. You can also remove the button."
                : "Add a call-to-action button. The button text is what guests will see; the URL is where they go when they click."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cta-button-text">Button Text</Label>
              <Input
                id="cta-button-text"
                placeholder="Click here"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyButton()
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cta-button-url">URL</Label>
              <Input
                id="cta-button-url"
                placeholder="https://example.com"
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyButton()
                }}
              />
              <p className="text-xs text-muted-foreground">
                Variables are supported, e.g. <span className="font-mono">{"{{property.website_url}}"}</span>.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Background</Label>
                <div className="inline-flex rounded-md border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => updateButtonBgMode("solid")}
                    className={cn(
                      "h-7 rounded px-3 text-xs font-medium transition-colors",
                      buttonBgMode === "solid"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    Solid
                  </button>
                  <button
                    type="button"
                    onClick={() => updateButtonBgMode("gradient")}
                    className={cn(
                      "h-7 rounded px-3 text-xs font-medium transition-colors",
                      buttonBgMode === "gradient"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    Gradient
                  </button>
                </div>
              </div>

              {buttonBgMode === "solid" ? (
                <div className="flex items-center gap-2">
                  <input
                    id="cta-button-bg"
                    type="color"
                    value={buttonBgColor}
                    onChange={(e) => updateButtonBgColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                  />
                  <Input
                    value={buttonBgColor}
                    onChange={(e) => updateButtonBgColor(e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cta-button-gradient-from" className="text-xs text-muted-foreground">
                      Start
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="cta-button-gradient-from"
                        type="color"
                        value={buttonGradientFrom}
                        onChange={(e) => updateButtonGradientFrom(e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                      />
                      <Input
                        value={buttonGradientFrom}
                        onChange={(e) => updateButtonGradientFrom(e.target.value)}
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cta-button-gradient-to" className="text-xs text-muted-foreground">
                      End
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="cta-button-gradient-to"
                        type="color"
                        value={buttonGradientTo}
                        onChange={(e) => updateButtonGradientTo(e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                      />
                      <Input
                        value={buttonGradientTo}
                        onChange={(e) => updateButtonGradientTo(e.target.value)}
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cta-button-fg">Text Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="cta-button-fg"
                  type="color"
                  value={buttonTextColor}
                  onChange={(e) => updateButtonTextColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <Input
                  value={buttonTextColor}
                  onChange={(e) => updateButtonTextColor(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            {/* Live preview */}
            <div className="rounded-md border bg-muted/30 px-3 py-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Preview
              </div>
              <div className="text-center">
                <span
                  style={buttonPreviewStyle}
                >
                  {buttonText.trim() || "Click here"}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {isEditingButton && (
              <Button
                variant="destructive"
                onClick={removeButton}
                className="mr-auto"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Remove
              </Button>
            )}
            <Button variant="outline" onClick={() => setButtonDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyButton} disabled={!buttonUrl.trim()}>
              {isEditingButton ? "Save Changes" : "Insert Button"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

// ============================================================================
// VariableSelect (unchanged)
// ============================================================================

export function VariableSelect({
  onInsert,
}: {
  onInsert: (path: string) => void
}) {
  return (
    <Select onValueChange={onInsert}>
      <SelectTrigger className="h-7 w-[200px] text-xs">
        <Braces className="h-3.5 w-3.5 mr-1" />
        <SelectValue placeholder="Variable" />
      </SelectTrigger>
      <SelectContent>
        {VARIABLE_GROUPS.map((group) => (
          <SelectGroup key={group.prefix}>
            <SelectLabel className="text-xs font-medium">{group.label}</SelectLabel>
            {group.variables.map((v) => (
              <SelectItem key={v.path} value={v.path} className="text-xs font-mono">
                {'{{' + v.path + '}}'}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
