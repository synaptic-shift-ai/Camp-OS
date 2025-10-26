"use client"

import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Filter, MoreVertical, Plus, Search, Tent, Home, TreePine, Sparkles, Circle, MapPin } from "lucide-react"
import type { SiteType } from "@/lib/booking/types"
type SiteStatus = 'available' | 'occupied' | 'maintenance' | 'unavailable';

interface Site {
  id: string;
  number: string;
  name: string;
  type: SiteType;
  maxOccupancy: number;
  basePrice: number;
  hookups: string[];
  status: SiteStatus;
}

const sites: Site[] = [
  {
    id: "1",
    number: "15",
    name: "Riverside Site 15",
    type: "rv",
    maxOccupancy: 6,
    basePrice: 75,
    hookups: ["water", "electric", "sewer"],
    status: "available",
  },
  {
    id: "2",
    number: "8",
    name: "Forest View Site 8",
    type: "tent",
    maxOccupancy: 4,
    basePrice: 45,
    hookups: ["water"],
    status: "occupied",
  },
  {
    id: "3",
    number: "3",
    name: "Luxury Cabin 3",
    type: "cabin",
    maxOccupancy: 8,
    basePrice: 150,
    hookups: ["water", "electric", "sewer"],
    status: "available",
  },
  {
    id: "4",
    number: "22",
    name: "Premium RV Site 22",
    type: "rv",
    maxOccupancy: 6,
    basePrice: 85,
    hookups: ["water", "electric", "sewer"],
    status: "maintenance",
  },
]

const siteTypeIcons: Record<SiteType, LucideIcon> = {
  rv: Home,
  tent: Tent,
  cabin: TreePine,
  glamping: Sparkles,
  yurt: Circle,
  other: MapPin,
}

const statusColors: Record<SiteStatus, string> = {
  available: "bg-green-500/10 text-green-500 border-green-500/20",
  occupied: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  maintenance: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  unavailable: "bg-red-500/10 text-red-500 border-red-500/20",
}

export default function SitesPage() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Sites</h1>
          <p className="text-muted-foreground">Manage your property sites and units</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Site
        </Button>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Sites</TabsTrigger>
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="occupied">Occupied</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sites..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => {
              const Icon = siteTypeIcons[site.type]
              return (
                <Card key={site.id} className="relative overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Site {site.number}</CardTitle>
                          <CardDescription className="text-sm">{site.name}</CardDescription>
                        </div>
                      </div>
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
                          <DropdownMenuItem>Edit Site</DropdownMenuItem>
                          <DropdownMenuItem>View Calendar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">Delete Site</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={statusColors[site.status]}>
                        {site.status}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {site.type}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max Occupancy</span>
                        <span className="font-medium">{site.maxOccupancy} guests</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Price</span>
                        <span className="font-medium">${site.basePrice}/night</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hookups</span>
                        <span className="font-medium capitalize">{site.hookups.join(", ")}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Site Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">60</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">18</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Occupied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">42</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">0</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
