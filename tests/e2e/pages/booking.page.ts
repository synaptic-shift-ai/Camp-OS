import type { Page, Locator } from '@playwright/test'

/**
 * Page Object for Booking Flow
 *
 * Phase 6: Testing & Quality Gates
 * Handles all booking-related page interactions for E2E tests.
 *
 * Following CLAUDE.md:
 * - T-2: E2E tests in tests/e2e/
 * - C-2: Domain vocabulary (reservation, site, guest)
 */
export class BookingPage {
  readonly page: Page

  // Navigation elements
  readonly bookingsLink: Locator
  readonly newBookingButton: Locator
  readonly calendarView: Locator
  readonly listView: Locator

  // Site selection
  readonly siteSelector: Locator
  readonly siteAvailabilityCalendar: Locator

  // Date selection
  readonly checkInDatePicker: Locator
  readonly checkOutDatePicker: Locator
  readonly dateRangeDisplay: Locator

  // Guest information
  readonly guestSearchInput: Locator
  readonly newGuestButton: Locator
  readonly guestFirstName: Locator
  readonly guestLastName: Locator
  readonly guestEmail: Locator
  readonly guestPhone: Locator

  // Occupancy
  readonly adultsInput: Locator
  readonly childrenInput: Locator
  readonly vehiclesInput: Locator
  readonly petsInput: Locator

  // Pricing
  readonly nightlyRateDisplay: Locator
  readonly totalPriceDisplay: Locator
  readonly discountInput: Locator

  // Actions
  readonly createBookingButton: Locator
  readonly cancelButton: Locator
  readonly confirmButton: Locator

  // Status
  readonly bookingStatusBadge: Locator
  readonly confirmationNumber: Locator
  readonly paymentStatusBadge: Locator

  // Check-in/out
  readonly checkInButton: Locator
  readonly checkOutButton: Locator

  // Toast/alerts
  readonly successToast: Locator
  readonly errorToast: Locator

  constructor(page: Page) {
    this.page = page

    // Navigation
    this.bookingsLink = page.getByRole('link', { name: /bookings|reservations/i })
    this.newBookingButton = page.getByRole('button', { name: /new booking|add reservation/i })
    this.calendarView = page.getByRole('button', { name: /calendar/i })
    this.listView = page.getByRole('button', { name: /list/i })

    // Site selection
    this.siteSelector = page.getByTestId('site-selector')
    this.siteAvailabilityCalendar = page.getByTestId('site-availability')

    // Date selection
    this.checkInDatePicker = page.getByTestId('check-in-date')
    this.checkOutDatePicker = page.getByTestId('check-out-date')
    this.dateRangeDisplay = page.getByTestId('date-range-display')

    // Guest
    this.guestSearchInput = page.getByPlaceholder(/search guest/i)
    this.newGuestButton = page.getByRole('button', { name: /new guest|add guest/i })
    this.guestFirstName = page.getByLabel(/first name/i)
    this.guestLastName = page.getByLabel(/last name/i)
    this.guestEmail = page.getByLabel(/email/i)
    this.guestPhone = page.getByLabel(/phone/i)

    // Occupancy
    this.adultsInput = page.getByLabel(/adults/i)
    this.childrenInput = page.getByLabel(/children/i)
    this.vehiclesInput = page.getByLabel(/vehicles/i)
    this.petsInput = page.getByLabel(/pets/i)

    // Pricing
    this.nightlyRateDisplay = page.getByTestId('nightly-rate')
    this.totalPriceDisplay = page.getByTestId('total-price')
    this.discountInput = page.getByLabel(/discount/i)

    // Actions
    this.createBookingButton = page.getByRole('button', { name: /create booking|book now/i })
    this.cancelButton = page.getByRole('button', { name: /cancel/i })
    this.confirmButton = page.getByRole('button', { name: /confirm/i })

    // Status
    this.bookingStatusBadge = page.getByTestId('booking-status')
    this.confirmationNumber = page.getByTestId('confirmation-number')
    this.paymentStatusBadge = page.getByTestId('payment-status')

    // Check-in/out
    this.checkInButton = page.getByRole('button', { name: /check.?in/i })
    this.checkOutButton = page.getByRole('button', { name: /check.?out/i })

    // Toasts
    this.successToast = page.getByRole('alert').filter({ hasText: /success/i })
    this.errorToast = page.getByRole('alert').filter({ hasText: /error/i })
  }

  /**
   * Navigate to bookings page
   */
  async navigateToBookings(): Promise<void> {
    await this.page.goto('/dashboard/bookings')
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Start new booking flow
   */
  async startNewBooking(): Promise<void> {
    await this.newBookingButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Select a site for booking
   */
  async selectSite(siteName: string): Promise<void> {
    await this.siteSelector.click()
    await this.page.getByRole('option', { name: siteName }).click()
  }

  /**
   * Set booking dates
   */
  async setDates(checkIn: string, checkOut: string): Promise<void> {
    await this.checkInDatePicker.fill(checkIn)
    await this.checkOutDatePicker.fill(checkOut)
  }

  /**
   * Fill guest information for new guest
   */
  async fillNewGuestInfo(guest: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }): Promise<void> {
    await this.newGuestButton.click()
    await this.guestFirstName.fill(guest.firstName)
    await this.guestLastName.fill(guest.lastName)
    await this.guestEmail.fill(guest.email)
    await this.guestPhone.fill(guest.phone)
  }

  /**
   * Select existing guest by search
   */
  async selectExistingGuest(searchTerm: string): Promise<void> {
    await this.guestSearchInput.fill(searchTerm)
    await this.page.getByRole('option').first().click()
  }

  /**
   * Set occupancy details
   */
  async setOccupancy(occupancy: {
    adults: number
    children?: number
    vehicles?: number
    pets?: number
  }): Promise<void> {
    await this.adultsInput.fill(occupancy.adults.toString())
    if (occupancy.children !== undefined) {
      await this.childrenInput.fill(occupancy.children.toString())
    }
    if (occupancy.vehicles !== undefined) {
      await this.vehiclesInput.fill(occupancy.vehicles.toString())
    }
    if (occupancy.pets !== undefined) {
      await this.petsInput.fill(occupancy.pets.toString())
    }
  }

  /**
   * Complete booking submission
   */
  async submitBooking(): Promise<void> {
    await this.createBookingButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Get confirmation number from successful booking
   */
  async getConfirmationNumber(): Promise<string> {
    return await this.confirmationNumber.textContent() ?? ''
  }

  /**
   * Get current booking status
   */
  async getBookingStatus(): Promise<string> {
    return await this.bookingStatusBadge.textContent() ?? ''
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(): Promise<string> {
    return await this.paymentStatusBadge.textContent() ?? ''
  }

  /**
   * Perform check-in
   */
  async performCheckIn(): Promise<void> {
    await this.checkInButton.click()
    await this.confirmButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Perform check-out
   */
  async performCheckOut(): Promise<void> {
    await this.checkOutButton.click()
    await this.confirmButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Cancel booking
   */
  async cancelBooking(): Promise<void> {
    await this.cancelButton.click()
    await this.confirmButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Get total price displayed
   */
  async getTotalPrice(): Promise<number> {
    const text = await this.totalPriceDisplay.textContent() ?? '0'
    return parseFloat(text.replace(/[^0-9.]/g, ''))
  }

  /**
   * Wait for success toast
   */
  async waitForSuccess(): Promise<void> {
    await this.successToast.waitFor({ state: 'visible', timeout: 10000 })
  }

  /**
   * Check if error toast is visible
   */
  async hasError(): Promise<boolean> {
    return await this.errorToast.isVisible()
  }
}
