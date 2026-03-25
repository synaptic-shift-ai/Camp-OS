import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Clock, CreditCard } from "lucide-react"
import { getPayments, getDashboardStats } from "@/lib/dashboard/queries"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { redirect } from "next/navigation"
import { PaymentsTable } from "@/components/dashboard/payments/payments-table"
import { PaymentsPageHeader } from "@/components/dashboard/payments/payments-page-header"

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

async function PaymentStats({ propertyId }: { propertyId: string }) {
  const stats = await getDashboardStats(propertyId)

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      <Card className="col-span-2 md:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatMoney(stats.totalRevenue)}</div>
          <p className="text-xs text-muted-foreground">All time</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatMoney(stats.pendingPayments)}</div>
          <p className="text-xs text-muted-foreground">Awaiting payment</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatMoney(stats.completedPayments)}</div>
          <p className="text-xs text-muted-foreground">Successfully processed</p>
        </CardContent>
      </Card>
    </div>
  )
}

type PageProps = {
  params: Promise<{ propertyId: string }>
  searchParams: Promise<{ page?: string; pageSize?: string }>
}

export default async function PaymentsPage({ params, searchParams }: PageProps) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect("/auth/login")

  const { page: pageParam, pageSize: pageSizeParam } = await searchParams
  const currentPage =
    Number.isNaN(Number(pageParam)) || !pageParam ? 1 : Math.max(1, Number(pageParam))
  const parsedPageSize =
    Number.isNaN(Number(pageSizeParam)) || !pageSizeParam
      ? undefined
      : Number(pageSizeParam)
  const pageSize = parsedPageSize && parsedPageSize > 0 ? parsedPageSize : 10

  const { data: payments, total } = await getPayments(propertyId, {}, currentPage, pageSize)

  return (
    <div className="space-y-4 sm:space-y-6">
      <PaymentsPageHeader
        propertyId={propertyId}
        payments={payments}
        currentPage={currentPage}
        total={total}
      />

      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className={i === 0 ? "col-span-2 md:col-span-1" : ""}>
                <CardHeader>
                  <CardTitle className="text-sm">Loading...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <PaymentStats propertyId={propertyId} />
      </Suspense>

      <PaymentsTable
        propertyId={propertyId}
        payments={payments}
        currentPage={currentPage}
        pageSize={pageSize}
        total={total}
      />
    </div>
  )
}
