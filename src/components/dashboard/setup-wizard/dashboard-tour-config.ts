import {
  LayoutDashboard,
  Calendar,
  Tent,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Building2,
  Plus,
  type LucideIcon,
} from "lucide-react"

export interface TourStep {
  id: string
  title: string
  description: string
  icon: LucideIcon
  features: string[]
  path?: string
  action?: string
}

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    id: "overview",
    title: "Dashboard Overview",
    description:
      "Your command center for managing your campground. See key metrics like revenue, bookings, occupancy rate, and guest count at a glance.",
    icon: LayoutDashboard,
    features: [
      "Real-time KPIs showing business health",
      "Recent reservations and activity feed",
      "Upcoming check-ins for today and tomorrow",
      "Quick access to all major features",
    ],
    path: "/dashboard",
  },
  {
    id: "reservations",
    title: "Reservations",
    description:
      "Manage all your property bookings from phone reservations to online bookings. Track status, send confirmations, and handle cancellations.",
    icon: Calendar,
    features: [
      "View all reservations with filtering and search",
      "Create manual bookings for walk-ins and phone calls",
      "Send confirmation emails to guests",
      "Handle cancellations with Stripe refunds",
    ],
    path: "/dashboard/reservations",
    action: "Create Manual Booking",
  },
  {
    id: "sites",
    title: "Sites Management",
    description:
      "Manage your camping sites with full control over pricing, amenities, and availability. Each site can have unique configurations.",
    icon: Tent,
    features: [
      "Visual grid of all sites with status indicators",
      "Edit pricing, amenities, and site details",
      "View site-specific availability calendars",
      "Filter by status: available, occupied, or maintenance",
    ],
    path: "/dashboard/sites",
    action: "Add New Site",
  },
  {
    id: "guests",
    title: "Guest Database",
    description:
      "Build and maintain relationships with your guests. Track booking history, preferences, and contact information.",
    icon: Users,
    features: [
      "Searchable guest directory by name, email, or phone",
      "View complete booking history per guest",
      "Track total stays and revenue per guest",
      "Quick access to contact information",
    ],
    path: "/dashboard/guests",
  },
  {
    id: "payments",
    title: "Payment Tracking",
    description:
      "Monitor all transactions and revenue. See pending payments, completed transactions, and refund history.",
    icon: CreditCard,
    features: [
      "Total revenue and payment summary stats",
      "Transaction history with payment methods",
      "Filter by status: pending, completed, failed, refunded",
      "View receipts for each transaction",
    ],
    path: "/dashboard/payments",
  },
  {
    id: "analytics",
    title: "Analytics & Insights",
    description:
      "Deep dive into your business performance with detailed metrics and trends. Identify top-performing sites and booking sources.",
    icon: BarChart3,
    features: [
      "Revenue trends and month-over-month growth",
      "Occupancy rates and booking patterns",
      "Top performing sites by revenue",
      "Booking source breakdown (direct, OTAs, etc.)",
    ],
    path: "/dashboard/analytics",
  },
  {
    id: "settings",
    title: "Settings & Configuration",
    description:
      "Configure your property details, booking policies, payment methods, and notification preferences.",
    icon: Settings,
    features: [
      "Property information and contact details",
      "Check-in/out times and timezone settings",
      "Payment method configuration",
      "Email notification preferences",
    ],
    path: "/dashboard/settings",
  },
  {
    id: "property-switcher",
    title: "Property Switcher",
    description:
      "Have multiple properties? Switch between them instantly. The dashboard automatically updates to show the selected property's data.",
    icon: Building2,
    features: [
      "View all your properties in one place",
      "Green checkmark shows completed onboarding",
      "Site count displayed for each property",
      "Quick switching without page reload",
    ],
  },
]

export const QUICK_TIPS = [
  {
    title: "Create Your First Booking",
    description:
      "Go to Reservations → New Reservation to create manual bookings for phone or walk-in guests.",
    icon: Plus,
  },
  {
    title: "Check Today's Check-ins",
    description:
      "The dashboard shows upcoming check-ins so you know who's arriving today.",
    icon: Calendar,
  },
  {
    title: "Update Site Status",
    description:
      "Mark sites as 'Maintenance' if they need repairs, or 'Unavailable' to temporarily block bookings.",
    icon: Tent,
  },
]
