import type React from "react"
import type { Metadata } from "next"
import { Inter, Montserrat } from "next/font/google"

import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/theme-provider"
import { CheckoutProvider } from "@/lib/booking/checkout-context"
import { Toaster } from "@/components/ui/toaster"

import "@/app/globals.css"

// Use only Google Fonts to avoid any local font references
const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
})

const fontHeading = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["600", "700"],
})

export const metadata: Metadata = {
  title: "CampOS | Outdoor Hospitality Management Platform",
  description:
    "Modern property management software for campgrounds, RV parks, and glamping sites. Streamline reservations, operations, and guest experiences.",
  keywords: [
    "campground management",
    "RV park software",
    "glamping management",
    "outdoor hospitality",
    "property management system",
  ],
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased font-light",
          fontSans.variable,
          fontHeading.variable,
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <CheckoutProvider>
            {children}
            <Toaster />
          </CheckoutProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
