"use client"

import { useCallback, useMemo, useState } from "react"
import { DoorOpen, Phone, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

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
  "bg-[hsl(142.1,76.2%,32%)] text-[hsl(0,0%,98%)] dark:bg-[hsl(142.1,55%,38%)] dark:text-[hsl(0,0%,98%)]"

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

export function SmsInboxPanel() {
  const [selectedId, setSelectedId] = useState(CONVERSATIONS[0]?.id ?? "")
  const [messagesByConv, setMessagesByConv] = useState<Record<string, ChatMessage[]>>(() => ({
    ...INITIAL_MESSAGES,
  }))
  const [draft, setDraft] = useState("")

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
      className="rounded-xl border border-stone-200/90 bg-[#f7f5f0] p-5 text-stone-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <div className="grid min-h-[min(520px,calc(100vh-16rem))] grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,300px)_1fr]">
        {/* Conversation list */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80">
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
    </div>
  )
}
