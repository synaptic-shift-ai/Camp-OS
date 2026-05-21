"use client"

import { useState } from "react"
import { Mail, MessageSquare, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type SendMessageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  guestId: string
  guestName: string
  propertyId: string
  onSent?: () => void
}

export function SendMessageDialog({
  open,
  onOpenChange,
  guestId,
  guestName,
  propertyId,
  onSent,
}: SendMessageDialogProps) {
  const { toast } = useToast()
  const [channel, setChannel] = useState<"email" | "sms">("email")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)

  const canSend = body.trim().length > 0 && (channel === "sms" || subject.trim().length > 0)

  const resetAndClose = (openVal: boolean) => {
    if (!openVal) {
      setChannel("email")
      setSubject("")
      setBody("")
      setSending(false)
    }
    onOpenChange(openVal)
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const params = new URLSearchParams({ propertyId })
      const res = await fetch(`/api/v1/guests/${guestId}/messages?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, subject, body }),
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
      toast({ title: "Message sent", description: `Message sent to ${guestName}.` })
      onSent?.()
      resetAndClose(false)
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading">Send Message</DialogTitle>
          <DialogDescription>
            Send a direct message to {guestName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Channel selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Channel</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setChannel("email")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-colors",
                  channel === "email"
                    ? "border-blue-400 bg-blue-50 dark:border-blue-600/60 dark:bg-blue-950/30"
                    : "border-stone-200 bg-white hover:border-stone-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600",
                )}
              >
                <Mail className="h-4 w-4" aria-hidden />
                <span className="text-sm font-semibold">Email</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel("sms")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-colors",
                  channel === "sms"
                    ? "border-purple-400 bg-purple-50 dark:border-purple-600/60 dark:bg-purple-950/30"
                    : "border-stone-200 bg-white hover:border-stone-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600",
                )}
              >
                <MessageSquare className="h-4 w-4" aria-hidden />
                <span className="text-sm font-semibold">SMS</span>
              </button>
            </div>
          </div>

          {/* Subject (email only) */}
          {channel === "email" && (
            <div className="space-y-2">
              <label htmlFor="send-msg-subject" className="text-sm font-medium">
                Subject <span className="text-red-500">*</span>
              </label>
              <Input
                id="send-msg-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Message subject…"
                className="border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          )}

          {/* Body */}
          <div className="space-y-2">
            <label htmlFor="send-msg-body" className="text-sm font-medium">
              Message <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="send-msg-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={5}
              className="border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => resetAndClose(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={!canSend || sending}
            className="gap-1 bg-[hsl(0,84.2%,60.2%)] text-white hover:opacity-90 dark:bg-[hsl(0,72%,51%)]"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
