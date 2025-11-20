import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const propertyId = formData.get("propertyId") as string
    const imageType = formData.get("imageType") as string // "hero" or "gallery"

    if (!file || !propertyId) {
      return NextResponse.json(
        { error: "Missing required fields: file, propertyId" },
        { status: 400 }
      )
    }

    // Verify property ownership
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    if (property.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop()
    const fileName = `${propertyId}/${imageType}-${Date.now()}.${fileExt}`

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("property-images")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("Upload error:", uploadError)
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("property-images")
      .getPublicUrl(uploadData.path)

    return NextResponse.json({
      url: publicUrl,
      path: uploadData.path,
    })
  } catch (error) {
    console.error("Error in property-image upload:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
