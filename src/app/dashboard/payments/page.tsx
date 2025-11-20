import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DollarSign, Clock, CreditCard } from "lucide-react"
import { getPayments, getDashboardStats } from "@/lib/dashboard/queries"
import type { PaymentStatus } from "@/contracts/booking"
import { createClient } from "@/lib/supabase/server"

const statusColors: Record<PaymentStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
  refunded: "bg-gray-500/10 text-gray-500 border-gray-500/20",
}

/**
 * Format money from integer cents to dollar display
 */
function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Format payment method for display
 */
function formatPaymentMethod(method: string): string {
  return method.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

/**
 * Get the current user's property ID
 * MVP: Assumes user has access to one property
 */
async function getCurrentPropertyId(): Promise<string | null> {
  const supabase = await createClient()

  // Get the currently authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get the first property owned by this user
  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  return property?.id || null
}

async function PaymentStats() {
  const propertyId = await getCurrentPropertyId()

  if (!propertyId) {
    return null
  }

  const stats = await getDashboardStats(propertyId)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
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

async function PaymentsTable() {
  const propertyId = await getCurrentPropertyId()

  if (!propertyId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No property found. Please contact support.</p>
      </div>
    )
  }

  // Fetch all payments for this property
  const { data: payments } = await getPayments(propertyId, {}, 1, 100)

  if (payments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No payments yet. Payments will appear here after bookings.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Guest</TableHead>
          <TableHead>Reservation</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{formatDate(payment.createdAt)}</TableCell>
            <TableCell className="font-medium">{payment.guestName}</TableCell>
            <TableCell>{payment.confirmationNumber}</TableCell>
            <TableCell>{formatMoney(payment.amount)}</TableCell>
            <TableCell>{formatPaymentMethod(payment.paymentMethod)}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={statusColors[payment.paymentStatus]}
              >
                {payment.paymentStatus}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default async function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">Track and manage all transactions</p>
      </div>

      {/* Payment Stats */}
      <Suspense fallback={
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-sm">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      }>
        <PaymentStats />
      </Suspense>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>View all payment transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading payments...</p>
            </div>
          }>
            <PaymentsTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
