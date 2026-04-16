"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { MotionDiv } from "@/components/ui/motion-wrapper"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff } from "lucide-react"
import { Icons } from "@/components/icons"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (searchParams.get("reset") === "success") {
      setSuccess("Your password has been updated. You can now sign in.")
      router.replace("/login", { scroll: false })
      return
    }

    if (searchParams.get("reason") === "staff_deactivated") {
      setError("Your account is deactivated. Please contact your administrator.")
      router.replace("/login", { scroll: false })
    }
  }, [searchParams, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()

      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("[LoginPage] signInWithPassword failed", {
          message: error.message,
          email,
        })
        setError(error.message)
      } else {
        const logAuthToken =
          process.env.NODE_ENV === "development" ||
          process.env.NEXT_PUBLIC_LOG_AUTH_TOKEN === "true"
        if (logAuthToken) {
          const accessToken = signInData.session?.access_token
          if (accessToken) {
            console.log("[LoginPage] access_token after sign-in", accessToken)
          } else {
            console.warn("[LoginPage] Sign-in succeeded but session has no access_token yet")
          }

          if (typeof document !== "undefined") {
            const rawCookies = document.cookie
            if (rawCookies.length > 0) {
              console.log(
                "[LoginPage] document.cookie after sign-in (non-HttpOnly only)",
                rawCookies,
              )
            } else {
              console.log(
                "[LoginPage] document.cookie is empty after sign-in — auth cookies are often HttpOnly; copy the full Cookie header from DevTools → Network (a request to this origin) or Application → Cookies for Postman.",
              )
            }
          }
        }

        const user = signInData.user ?? (await supabase.auth.getUser()).data.user

        if (user) {
          console.log("[LoginPage] User loaded after sign-in", {
            userId: user.id,
            email: user.email,
            userType: user.user_metadata?.user_type,
            hasSessionUser: Boolean(signInData.user),
          })
          const emailVerified =
            Boolean(user.email_confirmed_at) || Boolean(user.app_metadata?.custom_email_verified)

          console.log("[LoginPage] Email verification state", {
            userId: user.id,
            emailVerified,
            emailConfirmedAt: user.email_confirmed_at,
            customEmailVerified: user.app_metadata?.custom_email_verified,
          })

          if (!emailVerified) {
            console.warn("[LoginPage] Redirecting to verify-email because email is not verified", {
              userId: user.id,
              email: user.email,
            })
            await supabase.auth.signOut()
            const params = new URLSearchParams({ redirect: "/company-details" })
            if (user.email) params.set("email", user.email)
            router.push(`/verify-email?${params.toString()}`)
            router.refresh()
            return
          }

          const userType = user.user_metadata?.user_type
          console.log("[LoginPage] user_type branch check", {
            userId: user.id,
            userType,
          })

          const { data: staffAssignmentAny } = await supabase
            .from('property_staff')
            .select('property_id, status')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()

          console.log("[LoginPage] Staff assignment lookup result", {
            userId: user.id,
            staffPropertyId: staffAssignmentAny?.property_id ?? null,
            staffStatus: staffAssignmentAny?.status ?? null,
          })

          if (staffAssignmentAny?.status === 'inactive') {
            await supabase.auth.signOut()
            setError("Your account is deactivated. Please contact your administrator.")
            return
          }

          const accessToken = signInData.session?.access_token
          if (accessToken) {
            try {
              await fetch("/api/v1/activity/record-login", {
                method: "POST",
                headers: { Authorization: `Bearer ${accessToken}` },
              })
            } catch {
              /* audit is best-effort; do not block sign-in */
            }
          }

          if (
            staffAssignmentAny?.property_id &&
            (staffAssignmentAny.status === 'active' || staffAssignmentAny.status === 'pending')
          ) {
            console.log("[LoginPage] Redirecting staff user to property dashboard", {
              userId: user.id,
              destination: `/dashboard/${staffAssignmentAny.property_id}`,
              staffStatus: staffAssignmentAny.status,
            })
            router.push(`/dashboard/${staffAssignmentAny.property_id}`)
            router.refresh()
            return
          }

          if (userType === 'explorer') {
            router.push("/resources")
            router.refresh()
            return
          }

          const { data: companies } = await supabase
            .from('companies')
            .select('id, subscription_status')
            .eq('owner_id', user.id)
            .limit(1)
          const company = companies?.[0] ?? null

          console.log("[LoginPage] Company lookup result", {
            userId: user.id,
            userType,
            companyId: company?.id ?? null,
            subscriptionStatus: company?.subscription_status ?? null,
          })

          if (!company) {
            console.warn("[LoginPage] Redirecting to /company-details because no company was found", {
              userId: user.id,
              userType,
            })
            router.push("/company-details")
            router.refresh()
            return
          }

          if (company.subscription_status !== 'active') {
            router.push("/choose-plan")
            router.refresh()
            return
          }

          if (typeof window !== "undefined") {
            window.localStorage.removeItem("signup_company_details")
          }

          const { data: properties } = await supabase
            .from('properties')
            .select('id, onboarding_completed')
            .eq('company_id', company.id)
            .limit(1)
          const property = properties?.[0] ?? null

          if (!property || !property.onboarding_completed) {
            router.push("/onboarding")
            router.refresh()
            return
          }

          router.push("/dashboard")
          router.refresh()
        }
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

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
          <h1 className="text-3xl font-heading font-bold text-balance">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Sign in to your outdoor hospitality dashboard</p>
        </div>

        <Card className="glassmorphic-card border-border/50">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {success && (
                <Alert className="border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
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
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full neumorphic-button-primary" disabled={loading}>
                {loading ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline font-medium">
                Create one now
              </Link>
            </div>
          </CardFooter>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </MotionDiv>
    </div>
  )
}
