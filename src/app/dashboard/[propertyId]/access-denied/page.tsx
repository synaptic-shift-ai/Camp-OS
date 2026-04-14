import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveDashboardAccess } from '@/lib/rbac/dashboard-guards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'
import Link from 'next/link'

type PageProps = {
  params: Promise<{ propertyId: string }>
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
}

export default async function AccessDeniedPage({ params }: PageProps) {
  const { propertyId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const access = await resolveDashboardAccess(supabase, propertyId, user.id)
  const roleLabel = access?.role ? (ROLE_LABELS[access.role] ?? access.role) : 'Unknown'

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center gap-3">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <CardTitle className="text-2xl">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            You don't have permission to access this page.
            Contact your property administrator if you believe this is an error.
          </p>
          <div className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium">
            Your role: {roleLabel}
          </div>
          <div>
            <Button asChild>
              <Link href={`/dashboard/${propertyId}`}>Go to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
