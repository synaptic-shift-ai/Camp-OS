# v0 Integration Workflow

This document outlines the standardized process for designing UI/UX features with v0.dev and integrating them into the CampOS codebase.

## Overview

v0.dev is used to rapidly design and prototype UI components with our exact tech stack (Next.js 16, React 19, Shadcn/UI). This workflow ensures consistent integration and maintains code quality.

## Prerequisites

- Access to v0.dev (https://v0.dev)
- Feature requirements documented
- Understanding of CampOS design system (glassmorphic design, theme system)
- Familiarity with our tech stack (see CLAUDE.md)

## Workflow Steps

### 1. Create v0 Prompt

**Location**: `V0_PROMPTS.md`

**Template**:
```markdown
## [Feature Name] - [Date]

### Context
Brief description of the feature and where it fits in the application.

### Tech Stack Requirements
- Next.js 16 (App Router, Turbopack)
- React 19 with Server/Client Components
- TypeScript (strict mode)
- Shadcn/UI components
- TailwindCSS with glassmorphic design
- [Any specific libraries: Stripe, react-hook-form, Zod, etc.]

### Design Requirements
- Glassmorphic design with backdrop-blur effects
- Consistent with CampOS theme (primary: red-500)
- Dark/light mode support via ThemeProvider
- Mobile-first responsive design
- Accessibility (ARIA labels, keyboard navigation)

### Feature Specifications
[Detailed requirements for each page/component]

### Integration Requirements
- Routes: [Specify route structure, e.g., /dashboard/*, /settings/*]
- Context: [Any shared state needed]
- Types: [Required TypeScript interfaces]
- API calls: [Expected API endpoints to stub]

### Example Existing Patterns
Reference similar components/pages in the codebase to maintain consistency.
```

**Example from Booking Flow**:
See lines 1-556 in `V0_PROMPTS.md` for the complete 5-page booking flow prompt.

### 2. Generate in v0.dev

1. Go to https://v0.dev
2. Paste your prompt from V0_PROMPTS.md
3. Review generated components
4. Iterate on design/functionality as needed
5. Click "Download Code" when satisfied

### 3. Download and Extract

**Convention**: Download to `temp/v0-[feature-name]/`

Example structure:
```
temp/v0-booking/
├── app/
│   ├── page.tsx
│   ├── checkout/page.tsx
│   ├── payment/page.tsx
│   └── confirmation/page.tsx
├── components/
│   ├── campground-search.tsx
│   ├── checkout-client.tsx
│   ├── payment-client.tsx
│   └── confirmation-client.tsx
└── lib/
    └── booking/
        └── checkout-context.tsx
```

### 4. Integration Checklist

#### 4.1 Plan the Integration

Create a todo list for multi-component features:

```typescript
// Use TodoWrite to track integration steps
[
  { content: "Extract component files", status: "pending", activeForm: "Extracting component files" },
  { content: "Create route structure", status: "pending", activeForm: "Creating route structure" },
  { content: "Fix route references", status: "pending", activeForm: "Fixing route references" },
  { content: "Update imports", status: "pending", activeForm: "Updating imports" },
  { content: "Test compilation", status: "pending", activeForm: "Testing compilation" },
  { content: "Document dependencies", status: "pending", activeForm: "Documenting dependencies" }
]
```

#### 4.2 Copy Files

**Components**: `temp/v0-[feature]/components/*.tsx` → `components/`
**Context/Libs**: `temp/v0-[feature]/lib/**/*.tsx` → `lib/`
**Routes**: Create in appropriate `app/` directory

**Commands**:
```bash
# Copy components
cp temp/v0-feature/components/*.tsx components/

# Copy context/lib files
cp -r temp/v0-feature/lib/* lib/

# Routes are created manually to ensure correct structure
```

#### 4.3 Fix Route References

v0 generates routes at root level. Update to match our app structure.

**Find and replace patterns**:
```bash
# Example: Booking flow uses /book/* prefix
sed -i 's|href="/"|href="/book"|g' components/[component].tsx
sed -i 's|router.push("/")|router.push("/book")|g' components/[component].tsx
```

**Common route fixes**:
- Navigation links: `href="/"` → `href="/[section]"`
- Router pushes: `router.push("/")` → `router.push("/[section]")`
- Dynamic routes: `href="/sites/${id}"` → `href="/[section]/${id}"`

**Verification**:
```bash
# Check all route references
grep -n 'href=\|router.push' components/[component].tsx
```

#### 4.4 Update Imports

v0 uses its own file structure. Update imports to match our organization:

```typescript
// v0 default import paths
import { Button } from "@/components/ui/button"  // ✅ Keep as-is (Shadcn/UI)
import { useCheckout } from "@/lib/booking/checkout-context"  // ✅ Keep as-is

// May need updates if we organize differently
```

#### 4.5 Create Routes

Follow Next.js App Router conventions:

```typescript
// app/[section]/page.tsx - Simple route
export default function PageName() {
  return <ClientComponent />
}

// app/[section]/page.tsx - With Suspense for client components
import { Suspense } from "react"
import { ClientComponent } from "@/components/client-component"

export default function PageName() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClientComponent />
    </Suspense>
  )
}

// app/[section]/[id]/page.tsx - Dynamic route
export default function DynamicPage({ params }: { params: { id: string } }) {
  return <ClientComponent id={params.id} />
}
```

#### 4.6 Test Compilation

Monitor the dev server output:

```bash
# Check for compilation errors
# Look for:
# - Missing dependencies
# - Type errors
# - Import errors
# - Missing exports
```

**Common issues**:
1. **Missing packages**: Note in integration summary (see 4.8)
2. **Missing API exports**: Functions referenced but not implemented yet
3. **Type mismatches**: Usually due to stub types needing real implementations

#### 4.7 Verify Functionality

```bash
# Visit each integrated route
http://localhost:3000/[section]
http://localhost:3000/[section]/[sub-route]

# Test:
# - Navigation between pages
# - Form submissions (even if backend not implemented)
# - Theme switching
# - Mobile responsive design
```

#### 4.8 Document Integration

Create integration summary in chat:

```markdown
## [Feature Name] Integration Complete

### Files Created/Updated:
1. **Copied** `component-name.tsx` → `components/component-name.tsx`
2. **Created** `app/[section]/page.tsx` route
3. **Created** `lib/[feature]/context.tsx` for shared state

### Route References Fixed:
- Line X: Description of fix
- Line Y: Description of fix

### Known Issues to Address:
1. **Missing dependencies**:
   - Package: `package-name`
   - Env variable: `VARIABLE_NAME`
   - API route: `/api/endpoint`

2. **Missing API exports**:
   - `functionName` in `lib/path/to/file.ts`

### Next Steps:
- Implement backend logic
- Add tests
- Create API endpoints
```

### 5. Backend Integration

After UI integration, implement the backend:

1. **Types**: Ensure all TypeScript interfaces match database schema
2. **API functions**: Implement stubs referenced in components
3. **Context logic**: Add real data fetching to context providers
4. **Validation**: Add Zod schemas for form validation
5. **Tests**: Write tests for new logic (see CLAUDE.md testing best practices)

## Best Practices

### Design Consistency

Always specify in v0 prompts:
- **Theme colors**: Primary (red-500), success (green-500), etc.
- **Design pattern**: Glassmorphic with `glass` and `glass-strong` classes
- **Typography**: System font stack, consistent heading sizes
- **Spacing**: Use Tailwind spacing scale (4px base unit)
- **Icons**: Lucide React icons

### Component Organization

- **Client components**: Mark with `"use client"` directive
- **Server components**: Default for routes
- **Shared state**: Use React Context, place in `lib/[feature]/`
- **UI components**: Reuse Shadcn/UI components from `components/ui/`

### Route Structure

Follow these conventions:
- **Public pages**: `/` (home), `/about`, `/pricing`
- **Guest booking**: `/book/*`
- **Operator dashboard**: `/dashboard/*`
- **Settings**: `/settings/*`
- **Admin**: `/admin/*`

### Type Safety

- Import types with `import type { ... }`
- Use branded types for IDs (see CLAUDE.md C-5)
- Define interfaces in `lib/[feature]/types.ts`
- Export types from central location

### Error Handling

v0 components may lack robust error handling. Add:
- Loading states with Suspense
- Error boundaries for client components
- Toast notifications for user feedback
- Graceful fallbacks for missing data

## Common Issues and Solutions

### Issue: Missing Stripe/Payment Dependencies

**Solution**:
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

Add to `.env.local`:
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Issue: Missing API Exports

v0 references functions that don't exist yet.

**Solution**:
1. Create stub functions in appropriate `lib/` file
2. Add to integration task list
3. Implement as part of backend integration phase

Example stub:
```typescript
// lib/booking/api.ts
export async function getSiteById(id: string): Promise<Site | null> {
  // TODO: Implement database query
  console.warn('[stub] getSiteById called with:', id)
  return null
}
```

### Issue: Type Mismatches

v0 may infer types differently than our schema.

**Solution**:
1. Check `lib/[feature]/types.ts` for correct types
2. Update component imports to use our types
3. Fix any property name differences

### Issue: Context Provider Not Found

**Solution**:
Wrap the app or section with the provider:

```typescript
// app/book/layout.tsx
import { CheckoutProvider } from "@/lib/booking/checkout-context"

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <CheckoutProvider>{children}</CheckoutProvider>
}
```

## Example: Booking Flow Integration

See conversation history for complete example of integrating 5-page booking flow:

1. **Search Page** - Site filtering and search
2. **Site Details** - Individual site view with reservation start
3. **Guest Info** - Form with validation using react-hook-form + Zod
4. **Payment** - Stripe integration with PaymentElement
5. **Confirmation** - Success page with calendar export

All pages integrated in ~2 hours following this workflow.

## Workflow Efficiency Tips

### Parallel Execution

While Claude integrates one page, generate the next in v0.dev:
1. Generate page N in v0
2. Download to temp folder
3. Notify Claude
4. Start generating page N+1 while Claude integrates page N

### Batch Operations

For multi-page features:
1. Generate all pages first
2. Create integration plan (todo list)
3. Integrate sequentially
4. Test entire flow at the end

### Quick Fixes

Common sed patterns for batch route fixes:
```bash
# Fix all home links
sed -i 's|href="/"|href="/book"|g' components/*.tsx

# Fix all router pushes
sed -i 's|router.push("/")|router.push("/book")|g' components/*.tsx

# Fix dynamic routes
sed -i 's|href={`/sites/|href={`/book/|g' components/*.tsx
```

## Version History

- **2025-10-26**: Initial workflow documented after successful booking flow integration

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Project guidelines and best practices
- [testing-guidelines.md](./testing-guidelines.md) - Testing standards
- [V0_PROMPTS.md](../V0_PROMPTS.md) - Collection of v0 prompts

---

**Maintained by**: Claude Code in collaboration with development team
**Last Updated**: 2025-10-26
