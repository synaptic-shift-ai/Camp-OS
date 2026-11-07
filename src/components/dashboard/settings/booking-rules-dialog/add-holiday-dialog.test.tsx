/**
 * Form QA for the zod 4 / @hookform/resolvers 7 / react-hook-form 7.91 upgrade.
 *
 * These versions changed how the resolver is typed, and each affected form now
 * asserts the resolver's type rather than threading input/output generics. That
 * assertion is only sound if the runtime behaviour is unchanged, which nothing
 * in the suite checked. This drives a real form component to confirm the three
 * things the upgrade actually put at risk:
 *
 *   1. validation still runs and messages still reach the DOM
 *   2. z.preprocess still coerces, so handlers receive numbers and `undefined`
 *      rather than strings and empty strings
 *   3. cross-field .refine still fires on a preprocessed schema
 *
 * add-holiday-dialog is used because it takes only props - no Supabase client,
 * router or auth context - so it can be mounted as the application renders it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddHolidayDialog, type HolidayRule } from './add-holiday-dialog'

/** A seeded holiday, so a valid submit does not require driving the calendar popover. */
const SEEDED: HolidayRule = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  title: 'Memorial Day Weekend',
  start_date: '2026-05-22',
  end_date: '2026-05-25',
  min_stay_nights: 2,
  max_stay_nights: 7,
  enabled: true,
}

function mount(overrides: Partial<Parameters<typeof AddHolidayDialog>[0]> = {}) {
  const onSubmit = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <AddHolidayDialog
      open
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  return { onSubmit, onOpenChange }
}

const submitButton = () => screen.getByRole('button', { name: /add holiday|save/i })

beforeEach(() => vi.clearAllMocks())

describe('AddHolidayDialog validation', () => {
  it('blocks submission and surfaces messages when required fields are empty', async () => {
    const user = userEvent.setup()
    const { onSubmit } = mount()

    await user.click(submitButton())

    await waitFor(() => {
      expect(screen.queryByText('Holiday title is required')).not.toBeNull()
    })
    expect(screen.queryByText('Start and end dates are required')).not.toBeNull()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the seeded holiday with numeric stay lengths, not strings', async () => {
    const user = userEvent.setup()
    const { onSubmit, onOpenChange } = mount({ initialValues: SEEDED })

    await user.click(submitButton())

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))

    const payload = onSubmit.mock.calls[0]![0] as HolidayRule
    expect(payload).toMatchObject({
      id: SEEDED.id,
      title: 'Memorial Day Weekend',
      start_date: '2026-05-22',
      end_date: '2026-05-25',
      min_stay_nights: 2,
      max_stay_nights: 7,
      enabled: true,
    })
    // z.preprocess + valueAsNumber must still yield numbers through the resolver.
    expect(typeof payload.min_stay_nights).toBe('number')
    expect(typeof payload.max_stay_nights).toBe('number')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('enforces the cross-field rule that max stay cannot be below min stay', async () => {
    const user = userEvent.setup()
    const { onSubmit } = mount({ initialValues: SEEDED })

    const maxStay = screen.getByLabelText(/max stay/i)
    await user.clear(maxStay)
    await user.type(maxStay, '1')

    await user.click(submitButton())

    await waitFor(() => {
      expect(
        screen.queryByText('Maximum stay must be greater than or equal to minimum stay'),
      ).not.toBeNull()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('treats a cleared optional max stay as absent rather than an empty string', async () => {
    const user = userEvent.setup()
    const { onSubmit } = mount({ initialValues: SEEDED })

    await user.clear(screen.getByLabelText(/max stay/i))
    await user.click(submitButton())

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))

    const payload = onSubmit.mock.calls[0]![0] as HolidayRule
    expect(payload.max_stay_nights).toBeUndefined()
    expect(payload.min_stay_nights).toBe(2)
  })

  it('leaves a below-minimum stay to native constraint validation', async () => {
    // The input carries min={1} and the form does not set noValidate, so the
    // browser blocks this submit before react-hook-form runs and shows its own
    // tooltip. The schema's .min(1) message is a backstop that never renders
    // for this case - worth pinning so it is not mistaken for a missing error.
    const user = userEvent.setup()
    const { onSubmit } = mount({ initialValues: SEEDED })

    const minStay = screen.getByLabelText(/minimum stay/i) as HTMLInputElement
    await user.clear(minStay)
    await user.type(minStay, '0')

    expect(minStay.validity.rangeUnderflow).toBe(true)
    expect(minStay.checkValidity()).toBe(false)

    await user.click(submitButton())

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits once the stay length is corrected', async () => {
    const user = userEvent.setup()
    const { onSubmit } = mount({ initialValues: SEEDED })

    const minStay = screen.getByLabelText(/minimum stay/i) as HTMLInputElement
    await user.clear(minStay)
    await user.type(minStay, '3')
    expect(minStay.checkValidity()).toBe(true)

    await user.click(submitButton())

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ min_stay_nights: 3, max_stay_nights: 7 })
  })
})
