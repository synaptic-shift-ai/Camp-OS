"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileDetailsForm } from "@/components/dashboard/account/profile-details.form"
import { CompanyDetailsForm } from "@/components/dashboard/account/company-details-form"
import { ChangePasswordForm } from "@/components/dashboard/account/change-password-form"

type AccountSettingsTabsProps = {
  companyId: string
}

export function AccountSettingsTabs({ companyId }: AccountSettingsTabsProps) {
  return (
    <Tabs defaultValue="profile" className="space-y-4">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="company">Company Details</TabsTrigger>
        <TabsTrigger value="password">Change Password</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileDetailsForm />
      </TabsContent>

      <TabsContent value="company">
        <CompanyDetailsForm companyId={companyId} />
      </TabsContent>

      <TabsContent value="password">
        <ChangePasswordForm />
      </TabsContent>
    </Tabs>
  )
}
