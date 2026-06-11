'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { COUNTRIES, getCountryByCode } from '@/lib/countries'
import type { CountryData } from '@/lib/countries'
import { normalizePhone, formatPhone, toE164, parseE164 } from '@/lib/phone-utils'
import { cn } from '@/lib/utils'

interface PhoneInputProps {
  value?: string
  onChange?: (value: string) => void
  defaultCountry?: string
  error?: boolean
  disabled?: boolean
  id?: string
  name?: string
  className?: string
}

export function PhoneInput({
  value = '',
  onChange,
  defaultCountry = 'US',
  error = false,
  disabled = false,
  id,
  name,
  className,
}: PhoneInputProps) {
  const [country, setCountry] = useState<CountryData>(() => getCountryByCode(defaultCountry) ?? getCountryByCode('US')!)
  const [digits, setDigits] = useState('')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync from external value prop
  useEffect(() => {
    if (!value) {
      setDigits('')
      return
    }

    const normalized = value.startsWith('+') ? value : normalizePhone(value)
    if (!normalized) return

    const parsed = parseE164(normalized)
    if (parsed) {
      setCountry(getCountryByCode(parsed.countryCode) ?? country)
      setDigits(parsed.digits)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '')
      setDigits(raw)
      if (onChange) {
        onChange(raw ? toE164(raw, country.dialCode) : '')
      }
    },
    [onChange, country.dialCode],
  )

  const handleSelectCountry = useCallback(
    (c: CountryData) => {
      setCountry(c)
      setOpen(false)
      setSearch('')
      // Re-emit E.164 with new dial code
      if (onChange) {
        onChange(digits ? toE164(digits, c.dialCode) : '')
      }
      inputRef.current?.focus()
    },
    [onChange, digits],
  )

  const filtered = search
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase()) ||
          c.dialCode.includes(search),
      )
    : COUNTRIES

  const displayValue = formatPhone(digits, country.format)

  return (
    <div
      className={cn(
        'flex rounded-md border shadow-xs transition-colors',
        error ? 'border-red-500' : 'border-input',
        focused && 'ring-2 ring-ring ring-offset-2',
        disabled && 'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {/* Country selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            type="button"
            aria-label="Select country code"
            disabled={disabled}
            className={cn(
              'h-10 gap-1 rounded-none rounded-l-md border-0 px-2 text-sm font-normal',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
            )}
          >
            <span className="text-base leading-none">{country.flag}</span>
            <span className="text-sm">{country.dialCode}</span>
            <ChevronDown className="ml-0.5 h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search countries..."
                aria-label="Search countries"
                className="h-9 w-full rounded-md bg-muted pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="max-h-[250px] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No countries found.
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={c.code === country.code}
                onClick={() => handleSelectCountry(c)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  c.code === country.code && 'bg-accent',
                )}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-muted-foreground">{c.dialCode}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Phone number input */}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={country.placeholder}
        disabled={disabled}
        className={cn(
          'h-10 flex-1 border-0 bg-background px-3 py-2 text-base text-foreground outline-none',
          'placeholder:text-muted-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'sm:text-sm',
        )}
      />
    </div>
  )
}
