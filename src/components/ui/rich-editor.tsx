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
  SquarePlus,
  MousePointerClick,
  Trash2,
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

type EmailSettings = {
  width: string
  bgColor: string
  centered: boolean
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

const DEFAULT_SETTINGS: EmailSettings = {
  width: "600",
  bgColor: "#ffffff",
  centered: true,
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
    return JSON.parse(decoded) as EmailSettings
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
    return { ...DEFAULT_SETTINGS, ...saved, ...inferred }
  }
  return saved ?? (inferred ? { ...DEFAULT_SETTINGS, ...inferred } : DEFAULT_SETTINGS)
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

/** Strip settings comment from HTML */
function stripSettings(html: string): string {
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
  return html.replace(/(<tbody\b[^>]*>)([\s\S]*?)(<\/tbody>)/gi, (_match, open: string, inner: string, close: string) => {
    const protectedInner = inner.replace(
      /(^|<\/tr\s*>\s*)\s*(\{\{[^}]+\}\})(\s*)(?=<tr\b|$)/gi,
      (_innerMatch, prefix: string, tag: string, suffix: string) =>
        `${prefix}${buildTbodyMergePlaceholder(tag)}${suffix}`,
    )
    return `${open}${protectedInner}${close}`
  })
}

function restoreTbodyMergePlaceholders(html: string): string {
  return html.replace(
    new RegExp(`<tr\\b(?=[^>]*${TBODY_MERGE_ATTR}=["']true["'])[^>]*>[\\s\\S]*?(\\{\\{[^}]+\\}\\})[\\s\\S]*?<\\/tr>`, "gi"),
    "$1",
  )
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
function hasMalformedTbodyMergeTag(html: string): boolean {
  return /<tbody[^>]*>\s*\{\{[^}]+\}\}/i.test(protectTbodyMergeTags(html).trimStart())
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
const DEFAULT_BOX_BG = "#ffffff"
const DEFAULT_BOX_PADDING = "32"
const DEFAULT_BOX_WIDTH = "460"
const DEFAULT_BOX_RADIUS = "0"
const DEFAULT_BOX_BORDER_WIDTH = "0"
const DEFAULT_BOX_BORDER_COLOR = "#e4e4e7"

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
  const hasPadding = /padding\s*:/i.test(style)
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

  // Some email builders put the section styling directly on a TD. Only pick it
  // when it has its own visual treatment, not ordinary layout/table value cells.
  if (tag === "TD") {
    return hasBackground && (hasPadding || hasBorderStyle)
  }

  return false
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

function cleanEditorHtml(editor: HTMLElement): string {
  const clone = editor.cloneNode(true) as HTMLElement
  clone.querySelectorAll(`[${EDITOR_SELECTED_BOX_ATTR}]`).forEach((el) => {
    el.removeAttribute(EDITOR_SELECTED_BOX_ATTR)
  })
  return restoreTbodyMergePlaceholders(clone.innerHTML)
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

/** Build wrapper div style from settings */
function wrapperStyle(settings: EmailSettings): React.CSSProperties {
  return {
    backgroundColor: settings.bgColor,
    marginLeft: settings.centered ? "auto" : undefined,
    marginRight: settings.centered ? "auto" : undefined,
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
  const editorRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)
  const lastRangeRef = useRef<Range | null>(null)
  const settingsSaveTimerRef = useRef<number | null>(null)
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
  const initialContent = stripSettings(value)
  const savedSettings = extractSettings(value)
  const [settings, setSettings] = useState<EmailSettings>(() =>
    resolveSettingsFromHtml(initialContent, savedSettings),
  )
  // Full HTML documents and protected tbody merge tags open in visual mode.
  const [sourceMode, setSourceMode] = useState(() =>
    hasMalformedTbodyMergeTag(stripSettings(value)),
  )
  const [sourceValue, setSourceValue] = useState("")
  // When the incoming value is a full HTML document, we edit only its <body>
  // contents in visual mode and keep the surrounding <html>/<head>/<body>
  // wrapper here so we can reassemble it on save.
  const [documentShell, setDocumentShell] = useState<string | null>(() => {
    const parsed = parseDocumentShell(stripSettings(value))
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
  const contentOnly = stripSettings(value)
  const needsSourceOnly = hasMalformedTbodyMergeTag(contentOnly)
  const isWideEmailLayout = isFullEmailDocument(contentOnly)
  const canvasBgColor = settings.bgColor

  // Seed source textarea from initial value (visual body syncs in the effect below).
  useEffect(() => {
    setSourceValue(stripSettings(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes
  useEffect(() => {
    const newContent = stripSettings(value)
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
    const visualContent = protectTbodyMergeTags(parsed?.bodyContent ?? newContent)

    if (editorRef.current) {
      if (!mountedRef.current) mountedRef.current = true
      if (document.activeElement === editorRef.current) return
      if (cleanEditorHtml(editorRef.current) !== visualContent) {
        editorRef.current.innerHTML = visualContent
        selectedBoxRef.current?.removeAttribute(EDITOR_SELECTED_BOX_ATTR)
        selectedBoxRef.current = null
        setSelectedBoxActive(false)
      }
    }
    const metadataSettings = extractSettings(value)
    setSettings(resolveSettingsFromHtml(newContent, metadataSettings))
  }, [value, sourceMode])

  /** Get raw content from editor */
  const getContent = useCallback(() => {
    const editor = editorRef.current
    return editor ? cleanEditorHtml(editor) : ""
  }, [])

  /** Save body-only content from the visual editor (reassembles with shell). */
  const save = useCallback((html: string) => {
    let clean = html.replace(/^\s+|\s+$/g, "")
    if (documentShell) {
      // Visual-mode edit of a full HTML document: wrap body content back into
      // the preserved shell before persisting, then sync the template canvas
      // background stored in body/table attributes and inline styles.
      const reassembled = applyLegacyShellBg(
        reconstructWithShell(clean, documentShell),
        settings.bgColor,
      )
      const parsed = parseDocumentShell(reassembled)
      setDocumentShell(parsed?.shell ?? documentShell)
      onChange(wrapWithSettings(reassembled, settings))
      return
    }
    if (isFullEmailDocument(clean)) {
      clean = applyLegacyShellBg(clean, settings.bgColor)
    }
    onChange(wrapWithSettings(clean, settings))
  }, [onChange, settings, documentShell])

  /**
   * Save raw source-mode HTML. We don't reassemble with the existing shell —
   * the user is editing the full document directly — but we do refresh the
   * tracked shell so that toggling back into visual mode extracts the latest
   * body content cleanly.
   */
  const saveSource = useCallback((html: string) => {
    let clean = html.replace(/^\s+|\s+$/g, "")
    const parsed = parseDocumentShell(clean)
    setDocumentShell(parsed?.shell ?? null)
    if (isFullEmailDocument(clean)) {
      clean = applyLegacyShellBg(clean, settings.bgColor)
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

  const clearSelectedEmailBox = useCallback(() => {
    selectedBoxRef.current?.removeAttribute(EDITOR_SELECTED_BOX_ATTR)
    selectedBoxRef.current = null
    setSelectedBoxActive(false)
  }, [])

  const selectEmailBox = useCallback((box: HTMLElement | null) => {
    selectedBoxRef.current?.removeAttribute(EDITOR_SELECTED_BOX_ATTR)

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
  }, [])

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
    if (findEnclosingButton(e.target, editorRef.current)) return

    const box = findEnclosingEmailBox(e.target, editorRef.current)
    selectEmailBox(box)

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
  }, [placeCaretAfter, placeCaretBefore, selectEmailBox])

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
        cell.innerHTML = '<p style="margin:0;color:#52525b;font-size:14px;line-height:22px;">New content box</p>'
      }
      range.insertNode(table)
    } else {
      cell.innerHTML = '<p style="margin:0;color:#52525b;font-size:14px;line-height:22px;">New content box</p>'
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

  const removeSelectedBox = useCallback(() => {
    const box = selectedBoxRef.current
    if (!box || !editorRef.current?.contains(box)) return

    const contentRoot = getBoxPaddingElement(box)
    const fragment = document.createDocumentFragment()
    while (contentRoot.firstChild) {
      fragment.appendChild(contentRoot.firstChild)
    }
    box.parentNode?.insertBefore(fragment, box)
    box.remove()
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
      const updatedBody = applyLegacyShellBg(editor.innerHTML, settings.bgColor)
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
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const flushPendingSettingsSave = useCallback(() => {
    if (!settingsSaveTimerRef.current) return
    window.clearTimeout(settingsSaveTimerRef.current)
    settingsSaveTimerRef.current = null
    save(getContent())
  }, [getContent, save])

  // -- Source mode toggle --
  const toggleSourceMode = useCallback(() => {
    if (sourceMode) {
      const trimmed = sourceValue.trim()
      // Malformed tbody+{{ still forces staying in source mode
      if (hasMalformedTbodyMergeTag(trimmed)) return

      // If source contains a full HTML doc, extract the body for visual
      // editing and keep the shell.
      const parsed = parseDocumentShell(trimmed)
      if (parsed) {
        setDocumentShell(parsed.shell)
        if (editorRef.current) {
          editorRef.current.innerHTML = parsed.bodyContent
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
        ? applyLegacyShellBg(reconstructWithShell(visualBody, documentShell), settings.bgColor)
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
  }: {
    icon: React.ElementType
    label: string
    onClick: () => void
    active?: boolean
  }) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("group relative h-7 w-7 overflow-visible", active && "bg-muted text-foreground")}
        onClick={onClick}
        aria-label={label}
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
    <div className={cn("border rounded-md overflow-hidden", className)}>
      <style>{`.rich-editor-content [${EDITOR_SELECTED_BOX_ATTR}="true"] { outline: 2px solid hsl(var(--primary)); outline-offset: 4px; }`}</style>
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

          {/* Center toggle */}
          <Button
            type="button"
            variant={settings.centered ? "secondary" : "ghost"}
            size="xs"
            className="h-7 gap-1 text-xs"
            onClick={() => updateSettings({ centered: !settings.centered })}
            title="Center email in viewport"
          >
            <AlignCenter className="h-3.5 w-3.5" />
            Center
          </Button>

          {selectedBoxActive && (
            <div className="flex items-center gap-2 rounded-md border bg-background/70 px-2 py-1">
              <span className="text-xs font-medium text-muted-foreground">Box</span>
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
            <ToolbarBtn icon={Minus} label="Horizontal Rule" onClick={() => { execCommand("insertHorizontalRule"); handleBlur() }} />
            <ToolbarBtn icon={Link} label="Insert Link" onClick={openLinkDialog} />
            <ToolbarBtn
              icon={MousePointerClick}
              label="Insert Button"
              onClick={openInsertButtonDialog}
            />
            <ToolbarBtn
              icon={SquarePlus}
              label="Insert Form"
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
