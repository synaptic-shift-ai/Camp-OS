"use client"

import { useRef, useCallback, useEffect, useState } from "react"
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

// ============================================================================
// Types
// ============================================================================

type RichEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
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
  try {
    const decoded = atob(match[1])
    return JSON.parse(decoded) as EmailSettings
  } catch {
    return null
  }
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

export function RichEditor({
  value,
  onChange,
  placeholder = "Write your email content here...",
  className,
  minHeight = "250px",
}: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)

  // Parse existing settings from value
  const savedSettings = extractSettings(value)
  const [settings, setSettings] = useState<EmailSettings>(savedSettings ?? DEFAULT_SETTINGS)
  const [sourceMode, setSourceMode] = useState(false)
  const [sourceValue, setSourceValue] = useState("")

  // Link dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")

  // Pure content (without settings comment)
  const contentOnly = stripSettings(value)

  // Initialize editor on mount
  useEffect(() => {
    if (editorRef.current && !mountedRef.current) {
      mountedRef.current = true
      if (contentOnly) {
        editorRef.current.innerHTML = contentOnly
      }
    }
    setSourceValue(contentOnly)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes
  useEffect(() => {
    if (sourceMode) {
      setSourceValue(stripSettings(value))
      return
    }
    if (!mountedRef.current) return
    if (document.activeElement === editorRef.current) return
    const newContent = stripSettings(value)
    if (editorRef.current && editorRef.current.innerHTML !== newContent) {
      editorRef.current.innerHTML = newContent
    }
    const newSettings = extractSettings(value) ?? DEFAULT_SETTINGS
    setSettings(newSettings)
  }, [value, sourceMode])

  /** Get raw content from editor */
  const getContent = useCallback(() => {
    return editorRef.current?.innerHTML ?? ""
  }, [])

  /** Save content + settings to parent */
  const save = useCallback((html: string) => {
    const clean = html.replace(/^\s+|\s+$/g, "")
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

  // Re-save content when settings change (e.g. width, bg color, center)
  useEffect(() => {
    if (!mountedRef.current) return
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
      if (editorRef.current) {
        editorRef.current.innerHTML = sourceValue
        save(sourceValue)
      }
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
          className="h-7 text-xs gap-1"
          onClick={() => updateSettings({ centered: !settings.centered })}
          title="Center email in viewport"
        >
          <AlignCenter className="h-3.5 w-3.5" />
          Center
        </Button>
      </div>

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
        >
          {sourceMode ? (
            <><Code className="h-3.5 w-3.5" /> Visual</>
          ) : (
            <><CodeXml className="h-3.5 w-3.5" /> HTML</>
          )}
        </Button>
      </div>

      {/* ── Editor Area ── */}
      {sourceMode ? (
        <textarea
          className="w-full font-mono text-xs p-3 focus:outline-none resize-y bg-gray-50"
          style={{ minHeight }}
          value={sourceValue}
          onChange={(e) => {
            setSourceValue(e.target.value)
            save(e.target.value)
          }}
        />
      ) : (
        <div className="bg-gray-100 p-4 overflow-y-auto">
          <div
            style={{
              ...wrapperStyle(settings),
              minHeight: `calc(${minHeight} - 2rem)`,
              padding: "24px",
              fontFamily: "sans-serif",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              borderRadius: "4px",
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
}

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
