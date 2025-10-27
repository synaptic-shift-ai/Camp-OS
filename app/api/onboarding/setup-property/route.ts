import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    const requiredFields = ["name", "address", "city", "state", "zipCode", "phone", "email"]
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 })
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    // Validate state is 2 characters
    if (body.state.length !== 2) {
      return NextResponse.json({ error: "State must be 2 characters" }, { status: 400 })
    }

    // Validate zip code is at least 5 characters
    if (body.zipCode.length < 5) {
      return NextResponse.json({ error: "Zip code must be at least 5 characters" }, { status: 400 })
    }

    // Validate phone is at least 10 characters
    if (body.phone.length < 10) {
      return NextResponse.json({ error: "Phone number must be at least 10 characters" }, { status: 400 })
    }

    // In a real application, you would save this to a database
    // For now, we'll just simulate a successful save
    console.log("[v0] Property information saved:", body)

    // Simulate a delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    return NextResponse.json(
      {
        success: true,
        message: "Property information saved successfully",
        data: {
          id: `prop-${Date.now()}`,
          ...body,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] Error saving property information:", error)
    return NextResponse.json({ error: "Failed to save property information" }, { status: 500 })
  }
}
