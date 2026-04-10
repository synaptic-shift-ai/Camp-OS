"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { MotionDiv } from "@/components/ui/motion-wrapper"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Icons } from "@/components/icons"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff } from "lucide-react"

type InviteContext = {
  email: string
  firstName: string
  lastName: string
  contactPhone: string
  roleLabel: string
  categoryNames: string[]
}

function StaffInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const uid = searchParams.get("uid")
  const linkError = searchParams.get("error")

  const [context, setContext] = useState<InviteContext | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [linkValid, setLinkValid] = useState<boolean | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (linkError === "expired") {
      setLinkValid(false)
      setValidating(false)
      return
    }
    if (!token || !uid) {
      setLinkValid(false)
      setValidating(false)
      return
    }
    const check = async () => {
      try {
        const res = await fetch(
          `/api/auth/staff-invite-register?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}`,
        )
        const data = await res.json()
        if (data.valid === true) {
          setLinkValid(true)
          setContext({
            email: typeof data.email === "string" ? data.email : "",
            firstName: typeof data.firstName === "string" ? data.firstName : "",
            lastName: typeof data.lastName === "string" ? data.lastName : "",
            contactPhone:
              typeof data.contactPhone === "string" ? data.contactPhone : "",
            roleLabel: typeof data.roleLabel === "string" ? data.roleLabel : "—",
            categoryNames: Array.isArray(data.categoryNames)
              ? data.categoryNames.filter((x: unknown) => typeof x === "string")
              : [],
          })
          setFirstName(typeof data.firstName === "string" ? data.firstName : "")
          setLastName(typeof data.lastName === "string" ? data.lastName : "")
          setContactPhone(
            typeof data.contactPhone === "string" ? data.contactPhone : "",
          )
        } else {
          setLinkValid(false)
        }
      } catch {
        setLinkValid(false)
      } finally {
        setValidating(false)
      }
    }
    void check()
  }, [token, uid, linkError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (!token || !uid) return
    setLoading(true)
    try {
      const res = await fetch("/api/auth/staff-invite-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          uid,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          contactPhone: contactPhone.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to complete registration. Please try again.")
        setLoading(false)
        return
      }
      router.push("/login?staff_invite=success")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4">
        <div className="flex flex-col items-center gap-4">
          <Icons.spinner className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking invitation…</p>
        </div>
      </div>
    )
  }

  if (linkValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4">
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center space-x-2 mb-6">
              <Icons.logo className="h-8 w-8" />
              <span className="font-heading text-2xl">CampOS</span>
            </Link>
          </div>
          <Card className="glassmorphic-card border-border/50 text-center">
            <CardHeader>
              <CardTitle className="text-amber-600 dark:text-amber-500">
                Link invalid or expired
              </CardTitle>
              <CardDescription>
                This staff invitation link is no longer valid. Ask your property
                admin to send a new invite.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center">
              <Button asChild className="neumorphic-button-primary">
                <Link href="/login">Go to Login</Link>
              </Button>
            </CardFooter>
          </Card>
        </MotionDiv>
      </div>
    )
  }

  const roleLabel = context?.roleLabel ?? "—"
  const categoryNames = context?.categoryNames ?? []
  const emailDisplay = context?.email ?? ""

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4 py-10">
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <Icons.logo className="h-8 w-8" />
            <span className="font-heading text-2xl">CampOS</span>
          </Link>
          <h1 className="text-3xl font-heading font-bold text-balance">
            Complete your registration
          </h1>
          <p className="text-muted-foreground mt-2">
            Confirm your details and create a password for your staff account
          </p>
        </div>

        <Card className="glassmorphic-card border-border/50">
          <CardHeader className="pb-1 sm:pb-2">
            <CardTitle>Your profile</CardTitle>
            <CardDescription>
              Role and categories match your invitation and cannot be changed here
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={emailDisplay}
                  disabled
                  className="bg-muted/50 text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact number</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. +1 555 123 4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="border-b border-border pb-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={loading}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      disabled={loading}
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleDisplay">Role</Label>
                <Input
                  id="roleDisplay"
                  value={roleLabel}
                  disabled
                  readOnly
                  className="bg-muted/50 text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Role categories
                </span>
                <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-2">
                  {categoryNames.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                      All categories
                    </span>
                  ) : (
                    categoryNames.map((name) => (
                      <Badge
                        key={name}
                        variant="secondary"
                        className="pointer-events-none opacity-90"
                      >
                        {name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full neumorphic-button-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
            <div className="mt-2 text-center text-sm text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline font-medium">
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </MotionDiv>
    </div>
  )
}

export default function StaffInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Icons.spinner className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <StaffInviteContent />
    </Suspense>
  )
}
