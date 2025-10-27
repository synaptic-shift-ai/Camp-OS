import { NextResponse } from "next/server"

export async function GET() {
  try {
    // In production, fetch this data from your database
    // For now, return mock data
    const completionData = {
      propertyName: "Pine Valley Campground",
      city: "Boulder",
      state: "CO",
      totalSites: 17,
      siteBreakdown: "10 RV, 5 Tent, 2 Cabins",
      stripeConnected: true,
      bookingPageUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}`,
    }

    return NextResponse.json(completionData)
  } catch (error) {
    console.error("Error fetching completion status:", error)
    return NextResponse.json({ error: "Failed to fetch completion status" }, { status: 500 })
  }
}
