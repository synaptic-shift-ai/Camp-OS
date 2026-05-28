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

type SetupContext = {
  email: string
  firstName: string
  lastName: string
  roleLabel: string
  categoryNames: string[]
}

function StaffSetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const uid = searchParams.get("uid")

  const [context, setContext] = useState<SetupContext | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [linkValid, setLinkValid] = useState<boolean | null>(null)
  const [linkError, setLinkError] = useState<"expired" | "invalid_link" | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (!token || !uid) {
      setLinkValid(false)
      setLinkError("invalid_link")
      setValidating(false)
      return
    }
    const check = async () => {
      try {
        const res = await fetch(
          `/api/auth/staff-setup?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}`,
        )
        const data = await res.json()
        if (data.valid === true) {
          setLinkValid(true)
          setContext({
            email: typeof data.email === "string" ? data.email : "",
            firstName: typeof data.firstName === "string" ? data.firstName : "",
            lastName: typeof data.lastName === "string" ? data.lastName : "",
            roleLabel: typeof data.roleLabel === "string" ? data.roleLabel : "—",
            categoryNames: Array.isArray(data.categoryNames)
              ? data.categoryNames.filter((x: unknown) => typeof x === "string")
              : [],
          })
        } else {
          setLinkValid(false)
          setLinkError(
            data.error === "expired" ? "expired" : "invalid_link",
          )
        }
      } catch {
        setLinkValid(false)
        setLinkError("invalid_link")
      } finally {
        setValidating(false)
      }
    }
    void check()
  }, [token, uid])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!password) {
      setError("Password is required")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (!token || !uid) return

    setLoading(true)
    try {
      const res = await fetch("/api/auth/staff-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, uid, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to set password. Please try again.")
        setLoading(false)
        return
      }
      router.push("/login?staff_setup=success")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Phase 1 — Validating
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4">
        <div className="flex flex-col items-center gap-4">
          <Icons.spinner className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifying setup link…</p>
        </div>
      </div>
    )
  }

  // Phase 2 — Invalid / expired
  if (linkValid === false) {
    const errorTitle =
      linkError === "expired"
        ? "Setup link expired"
        : "Invalid setup link"
    const errorMessage =
      linkError === "expired"
        ? "This setup link has expired. Ask your administrator to resend it."
        : linkError === "invalid_link"
          ? "This setup link is invalid."
          : "This setup link is no longer valid."

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
                {errorTitle}
              </CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
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

  // Phase 3 — Valid form
  const roleLabel = context?.roleLabel ?? "—"
  const categoryNames = context?.categoryNames ?? []
  const emailDisplay = context?.email ?? ""
  const firstNameDisplay = context?.firstName ?? ""
  const lastNameDisplay = context?.lastName ?? ""

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
            Set your password
          </h1>
          <p className="text-muted-foreground mt-2">
            Your account has been created by an administrator. Set your password to get started.
          </p>
        </div>

        <Card className="glassmorphic-card border-border/50">
          <CardHeader className="pb-1 sm:pb-2">
            <CardTitle>Your profile</CardTitle>
            <CardDescription>
              Your details were set by your administrator
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
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstNameDisplay}
                    disabled
                    className="bg-muted/50 text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastNameDisplay}
                    disabled
                    className="bg-muted/50 text-muted-foreground"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    Categories
                  </span>
                  <div className="flex min-h-[38px] flex-wrap items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-2">
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
              </div>

              <div className="border-t border-border pt-4 space-y-4">
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
                  "Set Password"
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

export default function StaffSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Icons.spinner className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <StaffSetupContent />
    </Suspense>
  )
}
