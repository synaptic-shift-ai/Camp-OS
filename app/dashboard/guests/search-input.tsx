"use client"

import { useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface SearchInputProps {
  defaultValue?: string
}

export function SearchInput({ defaultValue = "" }: SearchInputProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(defaultValue)

  const handleSearch = (value: string) => {
    setSearchValue(value)

    startTransition(() => {
      const params = new URLSearchParams()
      if (value) {
        params.set("search", value)
      }

      const queryString = params.toString()
      const url = queryString ? `${pathname}?${queryString}` : pathname

      router.push(url)
    })
  }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search guests..."
        className="pl-8 w-[250px]"
        value={searchValue}
        onChange={(e) => handleSearch(e.target.value)}
        disabled={isPending}
      />
    </div>
  )
}
