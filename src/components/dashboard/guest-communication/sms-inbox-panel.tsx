"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DoorOpen, Loader2, Phone, Plus, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type Conversation = {
  id: string
  name: string
  phone: string
  snippet: string
  relativeTime: string
  unreadCount?: number
  reservationId: string
}

type ChatMessage = {
  id: string
  direction: "in" | "out"
  body: string
  time: string
}

const SMS_GREEN =
  "bg-[hsl(0,84.2%,60.2%)] text-[hsl(0,0%,98%)] dark:bg-[hsl(0,72%,51%)] dark:text-[hsl(0,0%,98%)]"

const CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "Priya Shah",
    phone: "+1 (415) 555-0192",
    snippet: "Thanks — we’ll be arriving closer to 4pm.",
    relativeTime: "9m",
    unreadCount: 2,
    reservationId: "#R-48275",
  },
  {
    id: "2",
    name: "Tom Beck",
    phone: "+1 (503) 555-0144",
    snippet: "Is late checkout still available Sunday?",
    relativeTime: "1h",
    reservationId: "#R-48102",
  },
  {
    id: "3",
    name: "Unknown",
    phone: "+1 (206) 555-0188",
    snippet: "STOP",
    relativeTime: "3h",
    unreadCount: 1,
    reservationId: "#R-47990",
  },
  {
    id: "4",
    name: "Marcus Lin",
    phone: "+1 (628) 555-0160",
    snippet: "Confirmed. See you Friday.",
    relativeTime: "1d",
    reservationId: "#R-47844",
  },
]

const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  "1": [
    { id: "m1", direction: "out", body: "Hi Priya — your site is ready for check-in after 2pm.", time: "8:02 AM" },
    { id: "m2", direction: "in", body: "Thanks — we’ll be arriving closer to 4pm.", time: "8:14 AM" },
  ],
  "2": [
    { id: "m1", direction: "in", body: "Is late checkout still available Sunday?", time: "7:12 AM" },
  ],
  "3": [{ id: "m1", direction: "in", body: "STOP", time: "5:40 AM" }],
  "4": [
    { id: "m1", direction: "out", body: "Your balance is settled. Safe travels!", time: "4:15 PM" },
    { id: "m2", direction: "in", body: "Confirmed. See you Friday.", time: "4:18 PM" },
  ],
}

function nextMessageId(messages: ChatMessage[]) {
  const n = messages.length + 1
  return `local-${n}`
}

type Guest = {
  id: string
  fullName: string
  email?: string
  phone?: string
}

type SmsInboxPanelProps = {
  propertyId: string
}

export function SmsInboxPanel({ propertyId }: SmsInboxPanelProps) {
  const [selectedId, setSelectedId] = useState(CONVERSATIONS[0]?.id ?? "")
  const [messagesByConv, setMessagesByConv] = useState<Record<string, ChatMessage[]>>(() => ({
    ...INITIAL_MESSAGES,
  }))
  const [draft, setDraft] = useState("")

  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false)
  const [guests, setGuests] = useState<Guest[]>([])
  const [guestsLoading, setGuestsLoading] = useState(false)
  const [guestQuery, setGuestQuery] = useState("")
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [composeBody, setComposeBody] = useState("")
  const [sending, setSending] = useState(false)
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false)
  const guestSearchRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Fetch guests when dialog opens
  useEffect(() => {
    if (!composeOpen) return
    let cancelled = false
    setGuestsLoading(true)
    fetch(`/api/v1/properties/${propertyId}/guests?limit=50`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        const data = json.data ?? json.guests ?? json ?? []
        setGuests(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setGuests([])
      })
      .finally(() => {
        if (!cancelled) setGuestsLoading(false)
      })
    return () => { cancelled = true }
  }, [composeOpen, propertyId])

  // Close dropdown on outside click
  useEffect(() => {
    if (!guestDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (guestSearchRef.current && !guestSearchRef.current.contains(e.target as Node)) {
        setGuestDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [guestDropdownOpen])

  const filteredGuests = useMemo(() => {
    if (!guestQuery.trim()) return guests.slice(0, 20)
    const q = guestQuery.toLowerCase()
    return guests.filter(
      (g) =>
        (g.fullName ?? "").toLowerCase().includes(q) ||
        (g.email ?? "").toLowerCase().includes(q) ||
        (g.phone ?? "").toLowerCase().includes(q),
    )
  }, [guests, guestQuery])

  const resetCompose = useCallback(() => {
    setGuestQuery("")
    setSelectedGuest(null)
    setComposeBody("")
    setSending(false)
    setGuestDropdownOpen(false)
  }, [])

  const handleComposeSend = useCallback(async () => {
    if (!selectedGuest || !composeBody.trim()) return
    setSending(true)
    try {
      const params = new URLSearchParams({ propertyId })
      const res = await fetch(`/api/v1/guests/${selectedGuest.id}/messages?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "sms", body: composeBody.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast({
          title: "Error",
          description: json.error?.message ?? "Could not send message.",
          variant: "destructive",
        })
        return
      }
      toast({ title: "Message sent", description: `SMS sent to ${selectedGuest.fullName}.` })
      resetCompose()
      setComposeOpen(false)
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }, [selectedGuest, composeBody, propertyId, toast, resetCompose])

  const smsSegments = Math.ceil((composeBody.length || 1) / 160) || 1
  const charsInSegment = composeBody.length <= 160 ? composeBody.length : composeBody.length % 160 || 160

  const active = useMemo(
    () => CONVERSATIONS.find((c) => c.id === selectedId) ?? CONVERSATIONS[0],
    [selectedId],
  )

  const messages = messagesByConv[active?.id ?? ""] ?? []

  const handleSend = useCallback(() => {
    const text = draft.trim()
    if (!text || !active) return
    const time = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    setMessagesByConv((prev) => ({
      ...prev,
      [active.id]: [
        ...(prev[active.id] ?? []),
        { id: nextMessageId(prev[active.id] ?? []), direction: "out" as const, body: text, time },
      ],
    }))
    setDraft("")
  }, [active, draft])

  if (!active) return null

  return (
    <div
      id="guest-comm-panel-sms"
      role="tabpanel"
      aria-labelledby="guest-comm-tab-sms"
      className="rounded-xl border border-stone-200/90 p-5 text-stone-900 dark:border-zinc-800 dark:text-zinc-100"
    >
      <div className="grid min-h-[min(520px,calc(100vh-16rem))] grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,300px)_1fr]">
        {/* Conversation list */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="border-b border-stone-100 p-3 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5 rounded-lg border-stone-200 bg-white text-stone-800 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => {
                resetCompose()
                setComposeOpen(true)
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              New Message
            </Button>
          </div>
          <ul className="divide-y divide-stone-100 overflow-y-auto dark:divide-zinc-800">
            {CONVERSATIONS.map((c) => {
              const selected = c.id === active.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors",
                      selected
                        ? "bg-stone-100 dark:bg-zinc-800"
                        : "bg-white hover:bg-stone-50/80 dark:bg-transparent dark:hover:bg-zinc-800/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-stone-900 dark:text-zinc-50">{c.name}</span>
                      <span className="shrink-0 text-xs text-stone-400 dark:text-zinc-500">
                        {c.relativeTime}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">{c.phone}</p>
                    <p className="line-clamp-2 text-sm text-stone-600 dark:text-zinc-300">{c.snippet}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="inline-flex items-center gap-1 text-xs text-stone-400 dark:text-zinc-500">
                        <DoorOpen className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                        {c.reservationId}
                      </span>
                      {typeof c.unreadCount === "number" && c.unreadCount > 0 && !selected ? (
                        <span
                          className={cn(
                            "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white",
                            SMS_GREEN,
                          )}
                          aria-label={`${c.unreadCount} unread`}
                        >
                          {c.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Thread */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-4 py-3 dark:border-zinc-800">
            <div className="space-y-1">
              <p className="font-semibold text-stone-900 dark:text-zinc-50">{active.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-400">
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {active.phone}
                <span className="text-stone-300 dark:text-zinc-600" aria-hidden>
                  ·
                </span>
                <span className="inline-flex items-center gap-1">
                  <DoorOpen className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  {active.reservationId}
                </span>
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-md border-stone-200 bg-white text-stone-800 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
              View reservation
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50/60 px-4 py-4 dark:bg-zinc-950/50">
            {messages.map((m) =>
              m.direction === "out" ? (
                <div key={m.id} className="flex flex-col items-end gap-1">
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                      SMS_GREEN,
                    )}
                  >
                    {m.body}
                  </div>
                  <span className="pr-1 text-[11px] text-stone-400 dark:text-zinc-500">{m.time}</span>
                </div>
              ) : (
                <div key={m.id} className="flex flex-col items-start gap-1">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-stone-200 bg-white px-3.5 py-2 text-sm leading-relaxed text-stone-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                    {m.body}
                  </div>
                  <span className="pl-1 text-[11px] text-stone-400 dark:text-zinc-500">{m.time}</span>
                </div>
              ),
            )}
          </div>

          <div className="border-t border-stone-100 p-3 dark:border-zinc-800">
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Type a reply..."
                className="h-11 flex-1 rounded-lg border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
              <Button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim()}
                className={cn("h-11 shrink-0 rounded-lg px-4 font-medium text-white shadow-sm", SMS_GREEN, "hover:opacity-90")}
              >
                <Send className="h-4 w-4" aria-hidden />
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Compose dialog */}
      <Dialog open={composeOpen} onOpenChange={(open) => {
        if (!open) resetCompose()
        setComposeOpen(open)
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading">New SMS Message</DialogTitle>
            <DialogDescription>Search for a guest and compose your message.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Guest search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                To <span className="text-red-500">*</span>
              </label>
              {selectedGuest ? (
                <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
                  <div>
                    <p className="text-sm font-semibold text-stone-900 dark:text-zinc-100">{selectedGuest.fullName}</p>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">{selectedGuest.phone ?? selectedGuest.email ?? ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedGuest(null); setGuestQuery(""); setGuestDropdownOpen(true) }}
                    className="text-xs text-stone-400 hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div ref={guestSearchRef} className="relative">
                  <Input
                    value={guestQuery}
                    onChange={(e) => { setGuestQuery(e.target.value); setGuestDropdownOpen(true) }}
                    onFocus={() => setGuestDropdownOpen(true)}
                    placeholder="Search guests by name, email, or phone…"
                    className="border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  {guestDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                      {guestsLoading ? (
                        <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-stone-500 dark:text-zinc-400">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Loading guests…
                        </div>
                      ) : filteredGuests.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-stone-500 dark:text-zinc-400">
                          No guests found
                        </div>
                      ) : (
                        filteredGuests.slice(0, 20).map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => { setSelectedGuest(g); setGuestDropdownOpen(false); setGuestQuery("") }}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-stone-50 dark:hover:bg-zinc-800"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-stone-900 dark:text-zinc-100">{g.fullName}</p>
                              <p className="truncate text-xs text-stone-500 dark:text-zinc-400">
                                {[g.phone, g.email].filter(Boolean).join(" · ") || "No contact info"}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Message body */}
            <div className="space-y-2">
              <label htmlFor="compose-sms-body" className="text-sm font-medium">
                Message <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="compose-sms-body"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Type your SMS message…"
                rows={5}
                className="border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              />
              <p className="text-right text-xs text-stone-400 dark:text-zinc-500">
                {composeBody.length} / 160 · segment {smsSegments}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { resetCompose(); setComposeOpen(false) }}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleComposeSend}
              disabled={!selectedGuest || !composeBody.trim() || sending}
              className={cn("gap-1 text-white hover:opacity-90", SMS_GREEN)}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
