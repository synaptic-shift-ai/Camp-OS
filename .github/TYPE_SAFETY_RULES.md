# Type Safety Rules

## Critical Rules to Prevent Type Drift

### Rule 1: Single Source of Truth for UI Types
**NEVER use raw DB types (`Site`, `Reservation`) directly in UI components.**

✅ **CORRECT:**
```typescript
// In components
import type { AvailableSite } from '@/lib/booking/types'
const [site, setSite] = useState<AvailableSite | null>(null)
```

❌ **WRONG:**
```typescript
// NEVER do this in components
import type { Site } from '@/lib/booking/types'
const [site, setSite] = useState<Site | null>(null)
```

**Why:** Raw DB types have `snake_case` fields and database-specific structures. UI types are transformed to `camelCase` and UI-friendly formats.

---

### Rule 2: API Functions Must Return UI-Friendly Types
**All API functions called from components MUST transform DB types to UI types.**

✅ **CORRECT:**
```typescript
export async function getSiteById(id: string): Promise<BookingResult<AvailableSite>> {
  const { data: site } = await supabase.from('sites').select('*').single()

  // Transform DB type to UI type
  return {
    success: true,
    data: {
      id: site.id,
      name: site.site_name || `Site ${site.site_number}`,
      base_price_per_night: site.base_price, // Transform field name
      image_url: site.images?.[0], // Transform array to single URL
    }
  }
}
```

❌ **WRONG:**
```typescript
export async function getSiteById(id: string): Promise<BookingResult<Site>> {
  const { data: site } = await supabase.from('sites').select('*').single()
  return { success: true, data: site as Site } // Raw DB type!
}
```

---

### Rule 3: Exhaustive Type Checking for Unions
**When using union types, ALWAYS use exhaustive checking patterns.**

✅ **CORRECT:**
```typescript
// Use const assertion for exhaustive Records
const siteTypeIcons = {
  rv: <Home />,
  tent: <Tent />,
  cabin: <TreePine />,
  glamping: <Sparkles />,
  yurt: <Circle />,
  other: <MapPin />,
} as const satisfies Record<SiteType, React.ReactNode>

// TypeScript will error if any SiteType is missing!
```

❌ **WRONG:**
```typescript
// Regular object - no exhaustive checking
const siteTypeIcons: Record<SiteType, React.ReactNode> = {
  rv: <Home />,
  tent: <Tent />,
  cabin: <TreePine />,
  // Missing yurt and other - TypeScript won't catch until build!
}
```

---

### Rule 4: Pre-Commit Type Validation
**MUST pass type checking before committing.**

```bash
# This runs automatically on git commit
npx tsc --noEmit
```

If type check fails, commit is blocked. Fix all errors before committing.

---

### Rule 5: Centralized Type Definitions
**Keep all booking-related types in ONE file: `lib/booking/types.ts`**

✅ **CORRECT:**
```typescript
// In lib/booking/types.ts
export type SiteType = 'tent' | 'rv' | 'cabin' | 'glamping' | 'yurt' | 'other'
export interface AvailableSite { ... }

// In components
import type { SiteType, AvailableSite } from '@/lib/booking/types'
```

❌ **WRONG:**
```typescript
// NEVER duplicate type definitions
type SiteType = 'tent' | 'rv' | 'cabin' // Local duplicate!
```

---

## Type Hierarchy

```
Database Types (DB Schema)
    ↓ (Transformation Layer)
UI Types (Frontend-friendly)
    ↓ (Components)
React Components
```

**DB Types:** `Site`, `Reservation` (raw Supabase tables)
**UI Types:** `AvailableSite`, `CheckoutData` (transformed for frontend)

**Transformation happens in:** `lib/booking/*.ts` API functions

---

## Checklist Before Committing

- [ ] `npx tsc --noEmit` passes ✅
- [ ] No `any` types introduced
- [ ] UI components use UI types (AvailableSite), not DB types (Site)
- [ ] API functions transform DB → UI types
- [ ] Union type mappings are exhaustive (use `satisfies Record<...>`)
- [ ] No duplicate type definitions across files

---

## Common Violations and Fixes

### Violation: Component using raw DB type
```typescript
// ❌ WRONG
const [site, setSite] = useState<Site | null>(null)
const result = await getSiteById(id)
setSite(result.data) // Type mismatch!
```

**Fix:** Change API to return UI type
```typescript
// ✅ CORRECT
const [site, setSite] = useState<AvailableSite | null>(null)
const result = await getSiteById(id) // Returns BookingResult<AvailableSite>
if (result.success) setSite(result.data)
```

### Violation: Incomplete union mapping
```typescript
// ❌ WRONG
const icons: Record<SiteType, Icon> = {
  tent: TentIcon,
  rv: RvIcon,
  // Missing other types!
}
```

**Fix:** Use exhaustive checking
```typescript
// ✅ CORRECT
const icons = {
  tent: TentIcon,
  rv: RvIcon,
  cabin: CabinIcon,
  glamping: GlampingIcon,
  yurt: YurtIcon,
  other: OtherIcon,
} as const satisfies Record<SiteType, Icon>
```

---

## Enforcement

1. **Pre-commit hook** blocks commits with type errors
2. **CI/CD** runs `npm run type-check` before build
3. **Code review** requires type safety checklist

Last updated: 2025-10-26
