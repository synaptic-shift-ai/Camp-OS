# Marketing Page Exact Styles Reference

## Extracted from actual CampOS marketing page code

### Page Background & Layout

**From `app/(marketing)/page.tsx`:**
```tsx
<main className="flex flex-col items-center relative">
  {/* Mouse glow effect */}
  <MouseGlow
    color="rgba(220, 38, 38, 0.12)"
    size={600}
    blur={150}
    opacity={0.6}
    followSpeed={0.05}
    pulseEffect={true}
    pulseSpeed={4}
    pulseScale={1.05}
  />
</main>
```

**From `components/sections/hero-section.tsx`:**
```tsx
<section id="home" className="relative w-full py-12 md:py-24 lg:py-32 xl:py-48 overflow-hidden">
  <AnimatedBackground
    variant="gradient"
    color="rgba(220, 38, 38, 0.08)"
    secondaryColor="rgba(75, 85, 99, 0.08)"
  />

  <div className="container px-6 md:px-8">
    {/* Content */}
  </div>
</section>
```

### Typography Styles

**Main Heading (from hero):**
```tsx
<h1 className="text-4xl font-heading font-bold tracking-tighter sm:text-5xl xl:text-7xl/none">
  <span className="gradient-text">Modern Management</span>
  <br />
  <span className="text-foreground">for Outdoor Hospitality</span>
</h1>
```

**Subheading:**
```tsx
<p className="max-w-[600px] text-gray-500 md:text-xl dark:text-gray-400 opacity-70">
  All-in-one property management software...
</p>
```

### Card Styles

**From `components/sections/pricing-section.tsx`:**
```tsx
<Card className={`h-full flex flex-col glassmorphic-card ${plan.popular ? "border-glow-red" : ""}`}>
  {plan.popular && (
    <div className="absolute top-0 right-0 -mt-2 -mr-2 px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-full">
      Popular
    </div>
  )}
  <CardHeader>
    <CardTitle className="tracking-tight">{plan.name}</CardTitle>
    <CardDescription className="opacity-70">{plan.description}</CardDescription>
    <div className="mt-4">
      <span className="text-4xl font-bold">{plan.price}</span>
      <span className="text-muted-foreground ml-2 opacity-70">{plan.duration}</span>
    </div>
  </CardHeader>
</Card>
```

**Popular Plan Border:**
```tsx
<AnimatedGradientBorder
  colors={["#dc2626", "#4b5563", "#dc2626", "#4b5563"]}
  borderWidth={1}
  duration={8}
>
  <Button className="w-full bg-background border-0 text-foreground hover:text-white">
    {plan.cta}
  </Button>
</AnimatedGradientBorder>
```

### Button Styles

**Primary CTA (from hero):**
```tsx
<GradientButton
  glowAmount={5}
  className="px-6 py-2.5 text-base"
  gradientFrom="from-red-500"
  gradientTo="to-red-700"
  asChild
>
  <Link href="/signup" className="flex items-center">
    Get Started
    <motion.span
      className="ml-2 inline-block"
      animate={{ x: [0, 4, 0] }}
      transition={{ repeat: Number.POSITIVE_INFINITY, repeatDelay: 2, duration: 1 }}
    >
      <ArrowRight className="h-4 w-4" />
    </motion.span>
  </Link>
</GradientButton>
```

**Secondary Button:**
```tsx
<MagneticButton className="neumorphic-button">
  <Link href="#features" className="px-6 py-2.5 block">
    Watch Demo
  </Link>
</MagneticButton>
```

**Standard Button:**
```tsx
<motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
  <Button className="w-full neumorphic-button">{plan.cta}</Button>
</motion.div>
```

### Animation Variants

**From hero section:**
```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
}
```

### Feature Icons/Checkmarks

**From pricing cards:**
```tsx
<li className="flex items-center">
  <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
  <span className="text-sm text-muted-foreground">{feature}</span>
</li>
```

### Section Spacing

**From hero:**
```tsx
className="relative w-full py-12 md:py-24 lg:py-32 xl:py-48 overflow-hidden"
```

**From pricing:**
```tsx
<section id="pricing" className="w-full py-12 md:py-24 lg:py-32">
```

### Grid Layouts

**Pricing grid (4 columns):**
```tsx
<div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 py-12 md:grid-cols-2 lg:grid-cols-4">
```

### SpotlightCard Usage (from hero)

```tsx
<SpotlightCard className="relative h-[450px] w-full overflow-hidden rounded-xl border glassmorphic-card p-1 border-glow-red">
  <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-transparent to-gray-900/20 z-10"></div>
  <div className="relative z-20 h-full w-full rounded-xl bg-gradient-to-br from-red-950/50 to-gray-950/50 p-6 flex items-center justify-center">
    {/* Content */}
  </div>
</SpotlightCard>
```

### Inner Card Hover Effects

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, delay: 0.6 }}
  className="col-span-2 h-24 rounded-xl bg-red-800/20 border border-red-800/30 flex items-center justify-center glassmorphic-inner-card"
  whileHover={{ scale: 1.03, boxShadow: "0 0 15px rgba(220, 38, 38, 0.3)" }}
>
  <span className="font-heading text-xl text-white tracking-tight">Reservation System</span>
</motion.div>
```

---

## Key Differences: Marketing vs App Pages

### Marketing Pages (Use This Style):
- Background: `AnimatedBackground` component with red/gray gradient
- MouseGlow effect on main page
- Bold gradient text for headlines
- Dramatic spacing (py-12 md:py-24 lg:py-32 xl:py-48)
- SpotlightCard for feature showcases
- GradientButton with glow effects

### App Pages (DON'T Use This):
- Background: `bg-gradient-to-br from-background via-background to-muted/20`
- No MouseGlow
- Standard text colors
- Standard spacing
- Regular Card component
- Standard Button component

---

## Components Required for Marketing Style

1. `<AnimatedBackground />` - For section backgrounds
2. `<MouseGlow />` - For page-level cursor effect
3. `<GradientButton />` - For primary CTAs
4. `<MagneticButton />` - For secondary CTAs
5. `<AnimatedGradientBorder />` - For popular items
6. `<SpotlightCard />` - For feature showcases
7. `<ScrollReveal />` - For scroll animations

All these are in the `/components` directory.
