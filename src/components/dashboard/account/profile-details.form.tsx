"use client"

import { useMemo, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

function readMetaString(meta: Record<string, unknown>, key: string): string {
  const v = meta[key]
  return typeof v === "string" ? v.trim() : ""
}

/**
 * Supabase / OAuth often store a single "full_name" or "name" instead of first_name + last_name.
 * Match dashboard layout resolution so the form is pre-filled consistently.
 */
function parseNameFieldsFromMetadata(meta: Record<string, unknown>): {
  firstName: string
  lastName: string
} {
  const first = readMetaString(meta, "first_name")
  const last = readMetaString(meta, "last_name")
  if (first || last) {
    return { firstName: first, lastName: last }
  }

  const combined =
    readMetaString(meta, "full_name") ||
    readMetaString(meta, "name") ||
    readMetaString(meta, "display_name")

  if (!combined) {
    return { firstName: "", lastName: "" }
  }

  const parts = combined.split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { firstName: "", lastName: "" }
  }
  if (parts.length === 1) {
    return { firstName: parts[0] ?? "", lastName: "" }
  }
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  }
}

export function ProfileDetailsForm() {
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])

  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error || !data.user) {
          if (!cancelled) {
            setEmail("")
            setFirstName("")
            setLastName("")
          }
          return
        }

        const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
        const { firstName: loadedFirst, lastName: loadedLast } = parseNameFieldsFromMetadata(meta)
        if (!cancelled) {
          setEmail(data.user.email ?? "")
          setFirstName(loadedFirst)
          setLastName(loadedLast)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [supabase])

  const handleSave = async () => {
    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()

    if (!trimmedFirst || !trimmedLast) {
      toast({
        title: "Name required",
        description: "Please enter both first and last name.",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      const fullName = [trimmedFirst, trimmedLast].filter(Boolean).join(" ")
      const { data, error } = await supabase.auth.updateUser({
        data: {
          first_name: trimmedFirst,
          last_name: trimmedLast,
          full_name: fullName,
        },
      })

      if (error) {
        throw error
      }

      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>
      const { firstName: nextFirst, lastName: nextLast } = parseNameFieldsFromMetadata(meta)
      setFirstName(nextFirst)
      setLastName(nextLast)

      toast({
        title: "Profile updated",
        description: "Your name has been saved.",
        variant: "success",
      })
    } catch (err) {
      toast({
        title: "Could not update profile",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Your name appears in the dashboard and in staff lists. Names from your login provider
          (including a single full name) are shown here when separate first and last names are not
          stored. Email is read-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            type="email"
            value={email}
            readOnly
            disabled
            className="bg-muted"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-first-name">First name</Label>
            <Input
              id="profile-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              disabled={loading || saving}
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-last-name">Last name</Label>
            <Input
              id="profile-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              disabled={loading || saving}
              autoComplete="family-name"
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading || saving}>
          {saving ? "Saving..." : loading ? "Loading..." : "Save profile"}
        </Button>
      </CardContent>
    </Card>
  )
}
