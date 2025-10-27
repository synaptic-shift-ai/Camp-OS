import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: "Site name is required" }, { status: 400 })
    }

    if (!body.type) {
      return NextResponse.json({ error: "Site type is required" }, { status: 400 })
    }

    if (!body.maxOccupancy || body.maxOccupancy < 1 || body.maxOccupancy > 50) {
      return NextResponse.json({ error: "Max occupancy must be between 1 and 50" }, { status: 400 })
    }

    if (!body.nightly_rate || body.nightly_rate < 0) {
      return NextResponse.json({ error: "Nightly rate is required and must be positive" }, { status: 400 })
    }

    // Validate site type
    const validTypes = ["tent", "rv", "cabin", "glamping", "yurt", "other"]
    if (!validTypes.includes(body.type)) {
      return NextResponse.json({ error: "Invalid site type" }, { status: 400 })
    }

    // In a real application, you would save this to a database
    // For now, we'll just simulate a successful save
    console.log("[v0] Site added:", body)

    // Simulate a delay
    await new Promise((resolve) => setTimeout(resolve, 300))

    return NextResponse.json(
      {
        success: true,
        message: "Site added successfully",
        siteId: `site-${Date.now()}`,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] Error adding site:", error)
    return NextResponse.json({ error: "Failed to add site" }, { status: 500 })
  }
}
