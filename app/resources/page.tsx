import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BookOpen,
  PlayCircle,
  BarChart,
  FileText,
  Rocket,
  CheckCircle2,
  ArrowRight
} from "lucide-react"

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-xl">C</span>
            </div>
            <span className="font-heading text-xl font-bold">CampOS</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                Start Free Trial
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <CheckCircle2 className="h-4 w-4" />
            Explorer Access Granted
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">
            Welcome to CampOS Resources
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Explore our platform with full access to demos, documentation, and educational materials.
            No credit card required.
          </p>
        </div>
      </section>

      {/* Resources Grid */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Demo Sandbox */}
          <Card className="glassmorphic-card border-border/50 hover:border-primary/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Interactive Demo</CardTitle>
              <CardDescription>
                Try out our platform with a fully functional demo campground
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/demo">
                <Button className="w-full" variant="outline">
                  Launch Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Documentation */}
          <Card className="glassmorphic-card border-border/50 hover:border-primary/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6 text-blue-500" />
              </div>
              <CardTitle>Documentation</CardTitle>
              <CardDescription>
                Comprehensive guides and API references
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/docs">
                <Button className="w-full" variant="outline">
                  Read Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Video Tutorials */}
          <Card className="glassmorphic-card border-border/50 hover:border-primary/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                <PlayCircle className="h-6 w-6 text-purple-500" />
              </div>
              <CardTitle>Video Tutorials</CardTitle>
              <CardDescription>
                Step-by-step video guides for getting started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/tutorials">
                <Button className="w-full" variant="outline">
                  Watch Videos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Case Studies */}
          <Card className="glassmorphic-card border-border/50 hover:border-primary/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-green-500" />
              </div>
              <CardTitle>Case Studies</CardTitle>
              <CardDescription>
                See how other campgrounds succeed with CampOS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/case-studies">
                <Button className="w-full" variant="outline">
                  Read Stories
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* ROI Calculator */}
          <Card className="glassmorphic-card border-border/50 hover:border-primary/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-4">
                <BarChart className="h-6 w-6 text-orange-500" />
              </div>
              <CardTitle>ROI Calculator</CardTitle>
              <CardDescription>
                Calculate potential savings and revenue increase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/roi-calculator">
                <Button className="w-full" variant="outline">
                  Calculate ROI
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Feature Comparison */}
          <Card className="glassmorphic-card border-border/50 hover:border-primary/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-pink-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-pink-500" />
              </div>
              <CardTitle>Feature Comparison</CardTitle>
              <CardDescription>
                Compare plans and find what's right for you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/pricing">
                <Button className="w-full" variant="outline">
                  View Plans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-heading font-bold mb-4">
              Ready to Transform Your Campground?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of outdoor hospitality properties using CampOS to streamline operations,
              increase revenue, and delight their guests.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                  Start Your Subscription
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline">
                  View Pricing
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              14-day free trial • No credit card required • Cancel anytime
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 CampOS. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Privacy
              </Link>
              <Link href="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
