'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const siteTypeLabels: Record<string, string> = {
  rv: 'RV Sites',
  tent: 'Tent Sites',
  cabin: 'Cabins',
  glamping: 'Glamping',
  yurt: 'Yurts',
  other: 'Other Sites',
}

type SiteTypeFilterProps = {
  propertyId: string
  allowedSiteTypes?: string[] | null
  siteTypesFromDb: { siteType: string }[]
}

export function SiteTypeFilter({ propertyId, allowedSiteTypes, siteTypesFromDb }: SiteTypeFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const current = searchParams.get('siteType') ?? 'all'

  const baseOptions =
    siteTypesFromDb.length > 0
      ? siteTypesFromDb
      : (['rv', 'tent', 'cabin', 'glamping', 'yurt', 'other'] as const).map((t) => ({
          siteType: t,
        }))

  const options =
    Array.isArray(allowedSiteTypes) && allowedSiteTypes.length > 0
      ? baseOptions.filter(({ siteType }) =>
          allowedSiteTypes.map((t) => t.toLowerCase()).includes(siteType.toLowerCase())
        )
      : baseOptions

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('siteType')
    } else {
      params.set('siteType', value)
    }

    const query = params.toString()
    const href =
      query.length > 0
        ? `/dashboard/${propertyId}/reservations?${query}`
        : `/dashboard/${propertyId}/reservations`

    router.push(href)
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="All site types" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All site types</SelectItem>
        {options.map(({ siteType }) => (
          <SelectItem key={siteType} value={siteType}>
            {siteTypeLabels[siteType] ?? siteType}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

