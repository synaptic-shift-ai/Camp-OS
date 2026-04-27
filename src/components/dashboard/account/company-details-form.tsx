"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/use-permissions"
import { createClient } from "@/lib/supabase/client"

type CompanyDetailsFormProps = {
  companyId: string
}

const COMPANY_LOGO_BUCKET = "Company-logo"
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024
const COMPANY_DETAILS_UPDATED_EVENT = "company-details-updated"

export function CompanyDetailsForm({ companyId }: CompanyDetailsFormProps) {
  const { toast } = useToast()
  const { can, isLoading: permissionsLoading } = usePermissions()
  const canEditCompany = !permissionsLoading && can("global.edit_company")
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [companyName, setCompanyName] = useState("")
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [companyLoading, setCompanyLoading] = useState(true)
  const [savingCompany, setSavingCompany] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl)
      }
    }
  }, [logoPreviewUrl])

  useEffect(() => {
    let isCancelled = false

    async function loadCompany() {
      try {
        setCompanyLoading(true)
        const response = await fetch(`/api/v1/companies/${companyId}`)
        const result = await response.json()

        if (!isCancelled && response.ok && result?.success) {
          setCompanyName(result.data?.name ?? "")
          setCompanyLogoUrl(result.data?.companyLogoUrl ?? null)
          setLogoPreviewUrl(null)
          setSelectedLogoFile(null)
          return
        }

        if (!isCancelled) {
          toast({
            title: "Failed to load company details",
            description: "Please refresh and try again.",
            variant: "destructive",
          })
        }
      } catch {
        if (!isCancelled) {
          toast({
            title: "Failed to load company details",
            description: "Please refresh and try again.",
            variant: "destructive",
          })
        }
      } finally {
        if (!isCancelled) {
          setCompanyLoading(false)
        }
      }
    }

    void loadCompany()

    return () => {
      isCancelled = true
    }
  }, [companyId, toast])

  useEffect(() => {
    let isCancelled = false
    const supabase = createClient()

    async function loadOwnerEmail() {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) {
          throw error
        }

        if (!isCancelled) {
          setOwnerEmail(data.user?.email ?? null)
        }
      } catch {
        if (!isCancelled) {
          setOwnerEmail(null)
        }
      }
    }

    void loadOwnerEmail()

    return () => {
      isCancelled = true
    }
  }, [])

  const handleLogoFileSelect = (file: File | null) => {
    if (!canEditCompany) {
      return
    }
    if (!file) {
      setSelectedLogoFile(null)
      setLogoPreviewUrl(null)
      return
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Unsupported file type",
        description: "Please upload an image file.",
        variant: "destructive",
      })
      return
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toast({
        title: "Image is too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      })
      return
    }

    setSelectedLogoFile(file)
    setLogoPreviewUrl(URL.createObjectURL(file))
  }

  const handleChangeLogoClick = () => {
    logoInputRef.current?.click()
  }

  const handleRemoveLogo = () => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl)
    }

    setSelectedLogoFile(null)
    setLogoPreviewUrl(null)
    setCompanyLogoUrl(null)

    if (logoInputRef.current) {
      logoInputRef.current.value = ""
    }
  }

  const uploadCompanyLogo = async (file: File): Promise<string> => {
    const supabase = createClient()
    const extension = file.name.split(".").pop()?.toLowerCase() || "png"
    const objectPath = `companies/${companyId}/logo-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from(COMPANY_LOGO_BUCKET)
      .upload(objectPath, file, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      throw new Error(uploadError.message || "Failed to upload company logo")
    }

    const { data } = supabase.storage
      .from(COMPANY_LOGO_BUCKET)
      .getPublicUrl(objectPath)

    return data.publicUrl
  }

  const handleSaveCompany = async () => {
    if (!canEditCompany) {
      return
    }
    if (!companyName.trim()) {
      toast({
        title: "Company name is required",
        variant: "destructive",
      })
      return
    }

    try {
      setSavingCompany(true)
      let nextCompanyLogoUrl = companyLogoUrl

      if (selectedLogoFile) {
        setUploadingLogo(true)
        nextCompanyLogoUrl = await uploadCompanyLogo(selectedLogoFile)
      }

      const response = await fetch(`/api/v1/companies/${companyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: companyName.trim(),
          companyLogoUrl: nextCompanyLogoUrl,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.error?.message || "Failed to update company name")
      }

      toast({
        title: "Company details updated",
        description: "Your company details have been saved.",
        variant: "success",
      })
      window.dispatchEvent(
        new CustomEvent(COMPANY_DETAILS_UPDATED_EVENT, {
          detail: {
            companyId,
            name: companyName.trim(),
            companyLogoUrl: nextCompanyLogoUrl,
          },
        })
      )
      setCompanyLogoUrl(nextCompanyLogoUrl)
      setSelectedLogoFile(null)
      setLogoPreviewUrl(null)
    } catch (error) {
      toast({
        title: "Could not save company details",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploadingLogo(false)
      setSavingCompany(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
          <CardDescription>
            {canEditCompany
              ? "Update your company account information."
              : "View your company account information."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {companyLoading ? (
            <Alert>
              <AlertDescription>Loading company details...</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Campgrounds Unlimited"
                  disabled={savingCompany || !canEditCompany}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-email">Owner Email</Label>
                <Input
                  id="owner-email"
                  type="email"
                  value={ownerEmail ?? ""}
                  placeholder="owner@company.com"
                  disabled
                  readOnly
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Logo</CardTitle>
          <CardDescription>
            {canEditCompany
              ? "Upload a logo image and save it to your company profile."
              : "Company logo shown below."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {companyLoading ? (
            <Alert>
              <AlertDescription>Loading company details...</AlertDescription>
            </Alert>
          ) : (
            <>
              <input
                ref={logoInputRef}
                id="company-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={savingCompany || uploadingLogo || !canEditCompany}
                onChange={(event) => handleLogoFileSelect(event.target.files?.[0] ?? null)}
                className="hidden"
              />

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Company logo</p>
                <div className="w-full max-w-xs rounded-lg border-2 border-dashed border-border p-2">
                  {logoPreviewUrl || companyLogoUrl ? (
                    <div className="relative h-56 overflow-hidden rounded-md">
                      <Image
                        src={logoPreviewUrl ?? companyLogoUrl ?? ""}
                        alt="Company logo preview"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex gap-1">
                        <button
                          type="button"
                          onClick={handleChangeLogoClick}
                          disabled={savingCompany || uploadingLogo || !canEditCompany}
                          className="flex-1 rounded bg-black/60 px-2 py-1 text-xs text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          disabled={savingCompany || uploadingLogo || !canEditCompany}
                          className="rounded bg-destructive/80 px-2 py-1 text-xs text-white transition hover:bg-destructive disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleChangeLogoClick}
                      disabled={savingCompany || uploadingLogo || !canEditCompany}
                      className="flex h-56 w-full items-center justify-center rounded-md bg-muted/30 text-sm text-muted-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Click to upload company logo
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
          <Button
            onClick={handleSaveCompany}
            disabled={companyLoading || savingCompany || uploadingLogo || !canEditCompany}
          >
            {savingCompany || uploadingLogo ? "Saving..." : "Save Company Details"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
