"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Tent, Loader2, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const signupSchema = z
  .object({
    companyName: z.string().min(2, "Company name must be at least 2 characters"),
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

type SignupFormData = z.infer<typeof signupSchema>

export function SignupClient() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      // Sign up with Supabase Auth - immediate session without email confirmation
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            user_type: 'buyer',
            full_name: data.fullName,
            company_name: data.companyName,
          },
          // Still send verification email for security, but don't block funnel
          emailRedirectTo: `${window.location.origin}/auth/callback?verified=true`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setIsLoading(false)
        return
      }

      // With email confirmation disabled, we always get an immediate session
      if (authData.session) {
        console.log('[Signup] Session created:', {
          userId: authData.user?.id,
          emailVerified: authData.user?.email_confirmed_at ? true : false
        })

        // Redirect to company details to continue funnel
        router.push("/company-details")
      } else {
        // This shouldn't happen with confirmation disabled, but handle it
        setError("Failed to create session. Please try again.")
      }
    } catch (err) {
      console.error("Signup error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Tent className="w-8 h-8 text-white" />
            <span className="text-2xl font-bold text-white">CampOS</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Get Started with CampOS</h1>
          <p className="text-gray-400">Join thousands of outdoor hospitality properties</p>
        </div>

        <div className="bg-zinc-900 rounded-lg p-8 border border-zinc-800">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">Create Account</h2>
            <p className="text-sm text-gray-400">Get started with CampOS in minutes</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="companyName" className="text-white mb-2 block">
                Company Name
              </Label>
              <Input
                id="companyName"
                placeholder="Outdoor Adventures Inc."
                {...register("companyName")}
                className="bg-black border-zinc-700 text-white placeholder:text-gray-500 focus:border-red-500"
              />
              {errors.companyName && <p className="text-sm text-red-400 mt-1">{errors.companyName.message}</p>}
            </div>

            <div>
              <Label htmlFor="fullName" className="text-white mb-2 block">
                Full Name
              </Label>
              <Input
                id="fullName"
                placeholder="John Smith"
                {...register("fullName")}
                className="bg-black border-zinc-700 text-white placeholder:text-gray-500 focus:border-red-500"
              />
              {errors.fullName && <p className="text-sm text-red-400 mt-1">{errors.fullName.message}</p>}
            </div>

            <div>
              <Label htmlFor="email" className="text-white mb-2 block">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
                className="bg-black border-zinc-700 text-white placeholder:text-gray-500 focus:border-red-500"
              />
              {errors.email && <p className="text-sm text-red-400 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="password" className="text-white mb-2 block">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("password")}
                  className="bg-black border-zinc-700 text-white placeholder:text-gray-500 focus:border-red-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-red-400 mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-white mb-2 block">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("confirmPassword")}
                  className="bg-black border-zinc-700 text-white placeholder:text-gray-500 focus:border-red-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-sm text-red-400 mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>

            <p className="text-sm text-center text-gray-400">
              Already have an account?{" "}
              <Link href="/login" className="text-red-500 hover:text-red-400 transition-colors">
                Sign in
              </Link>
            </p>
          </form>
        </div>

        <p className="text-xs text-center text-gray-500 mt-6">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="text-red-500 hover:text-red-400 transition-colors">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-red-500 hover:text-red-400 transition-colors">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}
