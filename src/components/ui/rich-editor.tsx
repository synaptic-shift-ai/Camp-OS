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
  Maximize2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  isFullEmailDocument,
  requiresEmailTemplateSourceEditing,
} from "@/lib/email/template-renderer"

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

const WIDTH_OPTIONS = [
  { value: "500", label: "500px" },
  { value: "600", label: "600px" },
  { value: "700", label: "700px" },
  { value: "full", label: "Full width" },
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

  // Prefer shell/canvas backgrounds used by full email templates.
  const bgMatch =
    source.match(/background-color\s*:\s*([^;"'>]+)/i) ??
    source.match(/bgcolor\s*=\s*["']([^"']+)["']/i)
  const bgColor = bgMatch?.[1]?.trim()

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

/** Build wrapper div style from settings */
function wrapperStyle(settings: EmailSettings): React.CSSProperties {
  const style: React.CSSProperties = {
    backgroundColor: settings.bgColor,
  }
  if (settings.width !== "full") {
    style.maxWidth = `${settings.width}px`
  }
  if (settings.centered) {
    style.marginLeft = "auto"
    style.marginRight = "auto"
  }
  return style
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

  // Expose imperative insertVariable method
  useImperativeHandle(ref, () => ({
    insertVariable: (text: string) => {
      const editorEl = editorRef.current
      if (!editorEl) return

      editorEl.focus()

      // Try to restore saved range
      if (lastRangeRef.current) {
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(lastRangeRef.current)
      }

      // Insert text at cursor
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

      // Trigger onChange
      const html = editorEl.innerHTML
      onChange?.(html)
    },
  }))

  // Parse existing settings from value
  const savedSettings = extractSettings(value)
  const inferredSettings = inferSettingsFromHtml(stripSettings(value))
  const [settings, setSettings] = useState<EmailSettings>(
    savedSettings ?? (inferredSettings ? { ...DEFAULT_SETTINGS, ...inferredSettings } : DEFAULT_SETTINGS)
  )
  const [sourceMode, setSourceMode] = useState(() =>
    requiresEmailTemplateSourceEditing(stripSettings(value)),
  )
  const [sourceValue, setSourceValue] = useState("")

  // Link dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Font selector
  const [selectedFontFamily, setSelectedFontFamily] = useState("sans-serif")
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false)
  const fontDropdownRef = useRef<HTMLDivElement>(null)

  // Pure content (without settings comment)
  const contentOnly = stripSettings(value)
  const needsSourceOnly = requiresEmailTemplateSourceEditing(contentOnly)
  const isWideEmailLayout = isFullEmailDocument(contentOnly)

  // Seed source textarea from initial value (visual body syncs in the effect below).
  useEffect(() => {
    setSourceValue(stripSettings(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes
  useEffect(() => {
    const newContent = stripSettings(value)
    const locked = requiresEmailTemplateSourceEditing(newContent)

    if (locked && !sourceMode) {
      setSourceValue(newContent)
      setSourceMode(true)
      return
    }

    if (sourceMode) {
      setSourceValue(newContent)
      return
    }

    if (editorRef.current) {
      if (!mountedRef.current) mountedRef.current = true
      if (document.activeElement === editorRef.current) return
      if (editorRef.current.innerHTML !== newContent) {
        editorRef.current.innerHTML = newContent
      }
    }
    const metadataSettings = extractSettings(value)
    const inferred = inferSettingsFromHtml(newContent)
    const newSettings =
      metadataSettings ??
      (inferred ? { ...DEFAULT_SETTINGS, ...inferred } : DEFAULT_SETTINGS)
    setSettings(newSettings)
  }, [value, sourceMode])

  /** Get raw content from editor */
  const getContent = useCallback(() => {
    return editorRef.current?.innerHTML ?? ""
  }, [])

  /** Save content + settings to parent */
  const save = useCallback((html: string) => {
    let clean = html.replace(/^\s+|\s+$/g, "")
    if (isFullEmailDocument(clean)) {
      clean = applyLegacyShellBg(clean, settings.bgColor)
    }
    onChange(wrapWithSettings(clean, settings))
  }, [onChange, settings])

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

  // Re-save content when settings change (e.g. width, bg color, center).
  // Skip when source-only markup is active — it manages its own internal layout.
  useEffect(() => {
    if (!mountedRef.current) return
    if (needsSourceOnly) return
    save(getContent())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  // -- Settings changes --
  const updateSettings = useCallback((patch: Partial<EmailSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  // -- Source mode toggle --
  const toggleSourceMode = useCallback(() => {
    if (sourceMode) {
      const trimmed = sourceValue.trim()
      if (requiresEmailTemplateSourceEditing(trimmed)) return
      save(trimmed)
      setSourceMode(false)
    } else {
      setSourceValue(getContent())
      setSourceMode(true)
    }
  }, [sourceMode, sourceValue, getContent, save])

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
        className={cn("h-7 w-7", active && "bg-muted text-foreground")}
        onClick={onClick}
        title={label}
      >
        <Icon className="h-3.5 w-3.5" />
      </Button>
    )
  }

  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      {/* ── Email Settings Bar ── */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 px-3 py-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">Email</span>

          {/* Width */}
          <Select
            value={settings.width}
            onValueChange={(v) => updateSettings({ width: v })}
          >
            <SelectTrigger className="h-7 w-[90px] text-xs">
              <Maximize2 className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WIDTH_OPTIONS.map((w) => (
                <SelectItem key={w.value} value={w.value} className="text-xs">
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Background color */}
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">BG</Label>
            <input
              type="color"
              value={settings.bgColor}
              className="h-6 w-6 cursor-pointer rounded border bg-transparent p-0"
              title="Email Background Color"
              onChange={(e) => updateSettings({ bgColor: e.target.value })}
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
        </div>

        {toolbarEnd ? (
          <div className="ml-auto shrink-0">{toolbarEnd}</div>
        ) : null}
      </div>

      {needsSourceOnly && (
        <div className="border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground leading-snug">
          <span className="font-medium text-foreground/80">HTML only</span>
          {' — '}
          To use <span className="font-medium text-foreground/80">Visual</span> editing, clear this HTML. Save, then open{' '}
          <span className="font-medium text-foreground/80">Visual</span> and check{' '}
          <span className="font-medium text-foreground/80">Preview</span>.
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
          disabled={sourceMode && requiresEmailTemplateSourceEditing(sourceValue)}
          title={
            sourceMode && requiresEmailTemplateSourceEditing(sourceValue)
              ? "Clear this HTML, save, then Visual."
              : undefined
          }
        >
          {sourceMode ? (
            requiresEmailTemplateSourceEditing(sourceValue) ? (
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
            save(e.target.value)
          }}
        />
      ) : (
        <div className={cn("flex-1 min-h-0 overflow-y-auto", isWideEmailLayout ? "p-0" : "p-4")} style={{ backgroundColor: settings.bgColor }}>
          <div
            style={{
              ...wrapperStyle(settings),
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
              className="focus:outline-none"
              style={{ minHeight: "100px" }}
              data-placeholder={placeholder}
              onInput={handleInput}
              onBlur={handleBlur}
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
