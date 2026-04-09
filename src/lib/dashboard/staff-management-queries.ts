import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type UiRole = 'owner' | 'admin' | 'manager' | 'staff'
type DbRole = 'owner' | 'admin' | 'manager' | 'staff'

const roleMap: Record<UiRole, DbRole> = {
  owner: 'owner',
  admin: 'admin',
  manager: 'manager',
  staff: 'staff',
}

export class StaffManagementQueries {
  constructor(private readonly supabase: SupabaseClient) {}

  static async create(): Promise<StaffManagementQueries> {
    const supabase = await createClient()
    return new StaffManagementQueries(supabase as unknown as SupabaseClient)
  }

  async verifyPropertyAccess(input: {
    propertyId: string
    userId: string
  }): Promise<{ hasAccess: boolean; isAdmin: boolean }> {
    const { data: property } = await this.supabase
      .from('properties')
      .select('company_id')
      .eq('id', input.propertyId)
      .single()

    if (!property) {
      return { hasAccess: false, isAdmin: false }
    }

    const { data: company } = await this.supabase
      .from('companies')
      .select('owner_id')
      .eq('id', property.company_id)
      .single()

    if (company?.owner_id === input.userId) {
      return { hasAccess: true, isAdmin: true }
    }

    const { data: staffRecord } = await this.supabase
      .from('property_staff')
      .select('role')
      .eq('property_id', input.propertyId)
      .eq('user_id', input.userId)
      .single()

    if (staffRecord) {
      const isAdmin =
        staffRecord.role === 'owner' ||
        staffRecord.role === 'admin' ||
        staffRecord.role === 'property_admin' ||
        staffRecord.role === 'manager'
      return { hasAccess: true, isAdmin }
    }

    return { hasAccess: false, isAdmin: false }
  }

  async getPropertyRoleCategories(input: {
    propertyId: string
  }): Promise<{ categoriesByRole: Record<UiRole, { id: string; name: string }[]> }> {
    const { data, error: selectError } = await this.supabase
      .from('property_role_categories')
      .select('id, role, name')
      .eq('property_id', input.propertyId)
      .in('role', ['owner', 'admin', 'manager', 'staff'])
      .order('name', { ascending: true })

    if (selectError) {
      console.error('[StaffManagementQueries] Failed to fetch role categories', {
        propertyId: input.propertyId,
        error: selectError,
      })
      throw selectError
    }

    const grouped: Record<UiRole, { id: string; name: string }[]> = {
      owner: [],
      admin: [],
      manager: [],
      staff: [],
    }

    for (const row of data ?? []) {
      const role = row.role as UiRole
      if (role !== 'owner' && role !== 'admin' && role !== 'manager' && role !== 'staff') continue
      grouped[role].push({ id: row.id, name: row.name })
    }

    return { categoriesByRole: grouped }
  }

  async savePropertyRolesCategories(input: {
    propertyId: string
    categoriesByRole: Record<UiRole, { name: string }[]>
  }): Promise<{ savedCount: number }> {
    const desired = (Object.keys(input.categoriesByRole) as UiRole[]).flatMap(
      (uiRole) => {
        const role = roleMap[uiRole]
        return input.categoriesByRole[uiRole].map((c) => ({
          property_id: input.propertyId,
          role,
          name: c.name.trim(),
          access: {},
        }))
      },
    )

    const roles: DbRole[] = ['owner', 'admin', 'manager', 'staff']

    const { data: existing, error: existingError } = await this.supabase
      .from('property_role_categories')
      .select('id, role, name')
      .eq('property_id', input.propertyId)
      .in('role', roles)

    if (existingError) {
      console.error('[StaffManagementQueries] Failed to load existing categories', {
        propertyId: input.propertyId,
        error: existingError,
      })
      throw existingError
    }

    const desiredKey = new Set(desired.map((r) => `${r.role}::${r.name}`))
    const toDeleteIds = (existing ?? [])
      .filter((r) => !desiredKey.has(`${r.role}::${r.name}`))
      .map((r) => r.id)

    if (toDeleteIds.length > 0) {
      const { error: deleteError } = await this.supabase
        .from('property_role_categories')
        .delete()
        .eq('property_id', input.propertyId)
        .in('id', toDeleteIds)

      if (deleteError) {
        console.error('[StaffManagementQueries] Failed to delete categories', {
          propertyId: input.propertyId,
          toDeleteIds,
          error: deleteError,
        })
        throw deleteError
      }
    }

    const { error: upsertError } = await this.supabase
      .from('property_role_categories')
      .upsert(desired, { onConflict: 'property_id,role,name' })

    if (upsertError) {
      console.error('[StaffManagementQueries] Failed to upsert categories', {
        propertyId: input.propertyId,
        desiredCount: desired.length,
        error: upsertError,
      })
      throw upsertError
    }

    return { savedCount: desired.length }
  }

  async inviteStaff(input: {
    propertyId: string
    userId: string
    role: UiRole
    roleCategoryId: string
    status: 'pending' | 'active' | 'inactive'
  }): Promise<{ invitedCount: number }> {
    const { data: existingStaff } = await this.supabase
      .from('property_staff')
      .select('id')
      .eq('property_id', input.propertyId)
      .eq('user_id', input.userId)
      .single()

    if (existingStaff) {
      console.error('[StaffManagementQueries] Staff already exists', {
        propertyId: input.propertyId,
        userId: input.userId,
      })
      throw new Error('Staff already exists')
    }

    const { error: insertError } = await this.supabase
      .from('property_staff')
      .insert({
        property_id: input.propertyId,
        user_id: input.userId,
        role: roleMap[input.role],
        role_category_id: input.roleCategoryId,
        status: input.status,
        permissions: [],
      })

    if (insertError) {
      console.error('[StaffManagementQueries] Failed to insert staff', {
        propertyId: input.propertyId,
        userId: input.userId,
        error: insertError,
      })
      throw insertError
    }

    return { invitedCount: 1 }
  }
}