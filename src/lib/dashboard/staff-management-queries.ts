import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isElevatedPropertyStaffRole } from '@/lib/dashboard/property-staff-roles'

export type UiRole = 'owner' | 'admin' | 'manager' | 'staff'
type DbRole = 'owner' | 'admin' | 'manager' | 'staff'

const roleMap: Record<UiRole, DbRole> = {
  owner: 'owner',
  admin: 'admin',
  manager: 'manager',
  staff: 'staff',
}

export type StaffManagementTableRow = {
  id: string
  name: string
  email: string
  role: 'Owner' | 'Admin' | 'Manager' | 'Staff'
  categories: string[] | 'All Categories'
  status: 'Active' | 'Pending' | 'Inactive'
  lastLogin: string
}

function formatStaffTableRoleLabel(dbRole: string): StaffManagementTableRow['role'] {
  const r = dbRole.toLowerCase()
  if (r === 'owner') return 'Owner'
  if (r === 'admin' || r === 'property_admin') return 'Admin'
  if (r === 'manager') return 'Manager'
  return 'Staff'
}

function formatStaffTableStatus(raw: string): StaffManagementTableRow['status'] {
  const s = raw.toLowerCase()
  if (s === 'pending') return 'Pending'
  if (s === 'inactive') return 'Inactive'
  return 'Active'
}

function formatStaffTableLastLogin(iso: string | undefined): string {
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return 'Never'
  }
}

function formatStaffInviteRoleLabel(dbRole: string): string {
  const r = dbRole.toLowerCase()
  if (r === 'owner') return 'Owner'
  if (r === 'admin' || r === 'property_admin') return 'Admin'
  if (r === 'manager') return 'Manager'
  if (r === 'staff') return 'Staff'
  return dbRole ? dbRole.charAt(0).toUpperCase() + dbRole.slice(1) : '—'
}

export { isElevatedPropertyStaffRole } from '@/lib/dashboard/property-staff-roles'

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
      const isAdmin = isElevatedPropertyStaffRole(staffRecord.role)
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

  async listPropertyStaff(propertyId: string): Promise<{
    id: string
    user_id: string | null
    role: string
    status: string
    role_category_id: string[] | null
  }[]> {
    const { data, error: selectError } = await this.supabase
      .from('property_staff')
      .select('id, user_id, role, status, role_category_id')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true })

    if (selectError) {
      console.error('[StaffManagementQueries] Failed to list property staff', {
        propertyId,
        error: selectError,
      })
      throw selectError
    }

    return data ?? []
  }

  async getStaffInviteStaffContextByUserId(userId: string): Promise<{
    roleLabel: string
    categoryNames: string[]
  }> {
    const { data: staffRows, error: staffError } = await this.supabase
      .from('property_staff')
      .select('role, role_category_id, property_id, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (staffError) {
      console.error('[StaffManagementQueries] Failed to load staff for invite', {
        userId,
        error: staffError,
      })
      throw staffError
    }

    const staffRow =
      staffRows?.find((r) => r.status === 'pending') ?? staffRows?.[0] ?? null

    if (!staffRow?.property_id) {
      return { roleLabel: '—', categoryNames: [] }
    }

    const roleLabel = formatStaffInviteRoleLabel(staffRow.role ?? '')
    const ids: string[] = staffRow.role_category_id ?? []
    if (ids.length === 0) {
      return { roleLabel, categoryNames: [] }
    }

    const { data: cats, error: catErr } = await this.supabase
      .from('property_role_categories')
      .select('id, name')
      .eq('property_id', staffRow.property_id)
      .in('id', ids)

    if (catErr) {
      console.error(
        '[StaffManagementQueries] Failed to load categories for staff invite',
        {
          propertyId: staffRow.property_id,
          userId,
          error: catErr,
        },
      )
      throw catErr
    }

    const byId = new Map(
      (cats ?? []).map((c: { id: string; name: string }) => [c.id, c.name]),
    )
    const categoryNames = ids
      .map((id: string) => byId.get(id))
      .filter((n: string | undefined): n is string => Boolean(n))

    return { roleLabel, categoryNames }
  }

  async activatePendingStaffForUser(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('property_staff')
      .update({ status: 'active' })
      .eq('user_id', userId)
      .eq('status', 'pending')

    if (error) {
      console.error('[StaffManagementQueries] Failed to activate pending staff for user', {
        userId,
        error,
      })
      throw error
    }
  }

  async listStaffForManagementTable(
    propertyId: string,
    adminClient: SupabaseClient,
  ): Promise<StaffManagementTableRow[]> {
    const rows = await this.listPropertyStaff(propertyId)

    const { data: catRows, error: catErr } = await this.supabase
      .from('property_role_categories')
      .select('id, name')
      .eq('property_id', propertyId)

    if (catErr) {
      console.error('[StaffManagementQueries] Failed to load category names for staff table', {
        propertyId,
        error: catErr,
      })
      throw catErr
    }

    const categoryNameById = new Map(
      (catRows ?? []).map((c) => [c.id, c.name] as const),
    )

    return Promise.all(
      rows.map(async (row) => {
        const userId = row.user_id
        let email = ''
        let displayName = '—'
        let lastSignIn: string | undefined

        if (userId) {
          const { data: authData, error: authErr } =
            await adminClient.auth.admin.getUserById(userId)
          if (!authErr && authData.user) {
            const u = authData.user
            email = u.email ?? ''
            const meta = u.user_metadata as Record<string, unknown> | undefined
            const fromFullOrName =
              typeof meta?.full_name === 'string'
                ? meta.full_name
                : typeof meta?.name === 'string'
                  ? meta.name
                  : ''
            const first =
              typeof meta?.first_name === 'string' ? meta.first_name.trim() : ''
            const last =
              typeof meta?.last_name === 'string' ? meta.last_name.trim() : ''
            const fromParts = [first, last].filter(Boolean).join(' ')
            const resolved = fromFullOrName.trim() || fromParts.trim()
            displayName = resolved || '—'
            lastSignIn = u.last_sign_in_at ?? undefined
          }
        }

        const ids = row.role_category_id ?? []
        const categories: string[] | 'All Categories' =
          ids.length === 0
            ? 'All Categories'
            : ids
                .map((id) => categoryNameById.get(id))
                .filter((n): n is string => Boolean(n))

        return {
          id: row.id,
          name: displayName,
          email: email || '—',
          role: formatStaffTableRoleLabel(row.role),
          categories,
          status: formatStaffTableStatus(row.status),
          lastLogin: formatStaffTableLastLogin(lastSignIn),
        }
      }),
    )
  }

  async findAuthUserIdByEmail(
    adminClient: SupabaseClient,
    email: string,
  ): Promise<string | null> {
    const normalized = email.toLowerCase()
    let page = 1
    const perPage = 200

    for (;;) {
      const { data, error: listError } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      })

      if (listError) {
        throw new Error(listError.message)
      }

      const match = data.users.find(
        (u) => (u.email ?? '').toLowerCase() === normalized,
      )
      if (match?.id) return match.id

      if (data.nextPage == null) break
      page = data.nextPage
    }

    return null
  }

  async inviteStaff(input: {
    propertyId: string
    userId: string
    role: UiRole
    roleCategoryIds: string[]
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
        role_category_id: input.roleCategoryIds,
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

  async updatePropertyStaffAssignment(input: {
    propertyId: string
    staffId: string
    role: 'admin' | 'manager' | 'staff'
    allCategories: boolean
    roleCategoryIds: string[]
  }): Promise<void> {
    const { data: row, error: fetchErr } = await this.supabase
      .from('property_staff')
      .select('id, role')
      .eq('id', input.staffId)
      .eq('property_id', input.propertyId)
      .maybeSingle()

    if (fetchErr) {
      console.error('[StaffManagementQueries] Failed to load staff row for update', {
        propertyId: input.propertyId,
        staffId: input.staffId,
        error: fetchErr,
      })
      throw fetchErr
    }

    if (!row) {
      throw new Error('Staff assignment not found')
    }

    const currentRole = (row.role ?? '').toLowerCase()
    if (currentRole === 'owner') {
      throw new Error('Cannot change property owner from staff management')
    }

    const nextCategoryIds = input.allCategories ? [] : [...new Set(input.roleCategoryIds)]

    if (!input.allCategories) {
      if (nextCategoryIds.length === 0) {
        throw new Error('Select at least one category, or choose All Categories')
      }

      const { data: cats, error: catErr } = await this.supabase
        .from('property_role_categories')
        .select('id, role')
        .eq('property_id', input.propertyId)
        .in('id', nextCategoryIds)

      if (catErr) {
        console.error('[StaffManagementQueries] Failed to validate role categories', {
          propertyId: input.propertyId,
          error: catErr,
        })
        throw catErr
      }

      if (!cats || cats.length !== nextCategoryIds.length) {
        throw new Error('One or more category ids are invalid for this property')
      }

      for (const c of cats) {
        const cr = String(c.role ?? '').toLowerCase()
        const matchesAdmin = input.role === 'admin' && (cr === 'admin' || cr === 'property_admin')
        const matchesOther = input.role !== 'admin' && cr === input.role
        if (!matchesAdmin && !matchesOther) {
          throw new Error('Each selected category must belong to the chosen role')
        }
      }
    }

    const { error: upErr } = await this.supabase
      .from('property_staff')
      .update({
        role: input.role,
        role_category_id: nextCategoryIds,
      })
      .eq('id', input.staffId)
      .eq('property_id', input.propertyId)

    if (upErr) {
      console.error('[StaffManagementQueries] Failed to update property staff', {
        propertyId: input.propertyId,
        staffId: input.staffId,
        error: upErr,
      })
      throw upErr
    }
  }

  async deactivatePropertyStaffAssignment(input: {
    propertyId: string
    staffId: string
  }): Promise<void> {
    const { data: row, error: fetchErr } = await this.supabase
      .from('property_staff')
      .select('id, role, status')
      .eq('id', input.staffId)
      .eq('property_id', input.propertyId)
      .maybeSingle()

    if (fetchErr) {
      console.error('[StaffManagementQueries] Failed to load staff row for deactivate', {
        propertyId: input.propertyId,
        staffId: input.staffId,
        error: fetchErr,
      })
      throw fetchErr
    }

    if (!row) {
      throw new Error('Staff assignment not found')
    }

    const currentRole = (row.role ?? '').toLowerCase()
    if (currentRole === 'owner') {
      throw new Error('Cannot deactivate property owner from staff management')
    }

    const currentStatus = (row.status ?? '').toLowerCase()
    if (currentStatus === 'inactive') {
      throw new Error('Staff member is already inactive')
    }

    const { error: upErr } = await this.supabase
      .from('property_staff')
      .update({ status: 'inactive' })
      .eq('id', input.staffId)
      .eq('property_id', input.propertyId)

    if (upErr) {
      console.error('[StaffManagementQueries] Failed to deactivate property staff', {
        propertyId: input.propertyId,
        staffId: input.staffId,
        error: upErr,
      })
      throw upErr
    }
  }

  async reactivatePropertyStaffAssignment(input: {
    propertyId: string
    staffId: string
  }): Promise<void> {
    const { data: row, error: fetchErr } = await this.supabase
      .from('property_staff')
      .select('id, role, status')
      .eq('id', input.staffId)
      .eq('property_id', input.propertyId)
      .maybeSingle()

    if (fetchErr) {
      console.error('[StaffManagementQueries] Failed to load staff row for reactivate', {
        propertyId: input.propertyId,
        staffId: input.staffId,
        error: fetchErr,
      })
      throw fetchErr
    }

    if (!row) {
      throw new Error('Staff assignment not found')
    }

    const currentRole = (row.role ?? '').toLowerCase()
    if (currentRole === 'owner') {
      throw new Error('Cannot change property owner status from staff management')
    }

    const currentStatus = (row.status ?? '').toLowerCase()
    if (currentStatus !== 'inactive') {
      throw new Error('Only inactive staff members can be reactivated')
    }

    const { error: upErr } = await this.supabase
      .from('property_staff')
      .update({ status: 'active' })
      .eq('id', input.staffId)
      .eq('property_id', input.propertyId)

    if (upErr) {
      console.error('[StaffManagementQueries] Failed to reactivate property staff', {
        propertyId: input.propertyId,
        staffId: input.staffId,
        error: upErr,
      })
      throw upErr
    }
  }
}