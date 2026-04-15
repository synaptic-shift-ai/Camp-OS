"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePermissions } from "@/hooks/use-permissions"
import { ProfileDetailsForm } from "@/components/dashboard/account/profile-details.form"
import { CompanyDetailsForm } from "@/components/dashboard/account/company-details-form"
import { ChangePasswordForm } from "@/components/dashboard/account/change-password-form"

type AccountSettingsTabsProps = {
  companyId: string
}

export function AccountSettingsTabs({ companyId }: AccountSettingsTabsProps) {
  const { can, isLoading } = usePermissions()
  const canViewCompany = !isLoading && can("global.view_company")

  return (
    <Tabs defaultValue="profile" className="space-y-4">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        {canViewCompany ? <TabsTrigger value="company">Company Details</TabsTrigger> : null}
        <TabsTrigger value="password">Change Password</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileDetailsForm />
      </TabsContent>

      {canViewCompany ? (
        <TabsContent value="company">
          <CompanyDetailsForm companyId={companyId} />
        </TabsContent>
      ) : null}

      <TabsContent value="password">
        <ChangePasswordForm />
      </TabsContent>
    </Tabs>
  )
}
