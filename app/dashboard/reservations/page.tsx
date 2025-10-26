"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Filter, MoreVertical, Plus, Search } from "lucide-react"

// Types
type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';

interface Reservation {
  id: string;
  confirmationNumber: string;
  guestName: string;
  site: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  amount: number;
  status: ReservationStatus;
}

// Mock data
const reservations: Reservation[] = [
  {
    id: "1",
    confirmationNumber: "CAMP-2024-001",
    guestName: "John Smith",
    site: "Site 15",
    checkIn: "2024-01-15",
    checkOut: "2024-01-18",
    nights: 3,
    guests: 4,
    amount: 450,
    status: "confirmed",
  },
  {
    id: "2",
    confirmationNumber: "CAMP-2024-002",
    guestName: "Sarah Johnson",
    site: "Site 8",
    checkIn: "2024-01-16",
    checkOut: "2024-01-20",
    nights: 4,
    guests: 2,
    amount: 600,
    status: "checked_in",
  },
  {
    id: "3",
    confirmationNumber: "CAMP-2024-003",
    guestName: "Mike Davis",
    site: "Cabin 3",
    checkIn: "2024-01-14",
    checkOut: "2024-01-17",
    nights: 3,
    guests: 6,
    amount: 750,
    status: "checked_out",
  },
  {
    id: "4",
    confirmationNumber: "CAMP-2024-004",
    guestName: "Emily Brown",
    site: "Site 22",
    checkIn: "2024-01-20",
    checkOut: "2024-01-23",
    nights: 3,
    guests: 3,
    amount: 420,
    status: "pending",
  },
]

const statusColors: Record<ReservationStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  checked_in: "bg-green-500/10 text-green-500 border-green-500/20",
  checked_out: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
}

export default function ReservationsPage() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Reservations</h1>
          <p className="text-muted-foreground">Manage all your property bookings</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Reservation
        </Button>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Reservations</CardTitle>
                <CardDescription>View and manage your property reservations</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search reservations..."
                    className="pl-8 w-[250px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TabsContent value="all" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Confirmation</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Nights</TableHead>
                    <TableHead>Guests</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell className="font-medium">{reservation.confirmationNumber}</TableCell>
                      <TableCell>{reservation.guestName}</TableCell>
                      <TableCell>{reservation.site}</TableCell>
                      <TableCell>{new Date(reservation.checkIn).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(reservation.checkOut).toLocaleDateString()}</TableCell>
                      <TableCell>{reservation.nights}</TableCell>
                      <TableCell>{reservation.guests}</TableCell>
                      <TableCell>${reservation.amount}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[reservation.status]}>
                          {reservation.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Edit Reservation</DropdownMenuItem>
                            <DropdownMenuItem>Send Confirmation</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">Cancel Reservation</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Arriving Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Departing Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42/60</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
