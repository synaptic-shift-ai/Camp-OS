import { render } from '@react-email/components'
import { resend, getFrom } from './resend'
import { BookingConfirmationEmail } from './templates/booking-confirmation'
import { CancellationNoticeEmail } from './templates/cancellation-notice'

export interface BookingConfirmationData {
  guestName: string
  guestEmail: string
  confirmationNumber: string
  propertyName: string
  siteName: string
  checkInDate: string
  checkOutDate: string
  numNights: number
  numAdults: number
  numChildren: number
  totalAmount: number
  paidAmount: number
  paymentStatus: 'paid' | 'unpaid' | 'partial'
  specialRequests?: string
}

export interface CancellationData {
  guestName: string
  guestEmail: string
  confirmationNumber: string
  propertyName: string
  siteName: string
  checkInDate: string
  checkOutDate: string
  cancellationReason?: string
  refundAmount?: number
  refundStatus?: 'processing' | 'completed' | 'none'
}

/**
 * Send a booking confirmation email to the guest
 */
export async function sendBookingConfirmation(data: BookingConfirmationData) {
  try {
    const emailProps: any = {
      guestName: data.guestName,
      confirmationNumber: data.confirmationNumber,
      propertyName: data.propertyName,
      siteName: data.siteName,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      numNights: data.numNights,
      numAdults: data.numAdults,
      numChildren: data.numChildren,
      totalAmount: data.totalAmount,
      paidAmount: data.paidAmount,
      paymentStatus: data.paymentStatus,
    }

    // Only add optional fields if they have values
    if (data.specialRequests) {
      emailProps.specialRequests = data.specialRequests
    }

    const emailHtml = await render(BookingConfirmationEmail(emailProps))

    const result = await resend.emails.send({
      from: getFrom(),
      to: data.guestEmail,
      subject: `Booking Confirmed - ${data.confirmationNumber} at ${data.propertyName}`,
      html: emailHtml,
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('[Email] Failed to send booking confirmation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}

/**
 * Send a cancellation notice email to the guest
 */
export async function sendCancellationNotice(data: CancellationData) {
  try {
    const emailProps: any = {
      guestName: data.guestName,
      confirmationNumber: data.confirmationNumber,
      propertyName: data.propertyName,
      siteName: data.siteName,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
    }

    // Only add optional fields if they have values
    if (data.cancellationReason) {
      emailProps.cancellationReason = data.cancellationReason
    }
    if (data.refundAmount !== undefined) {
      emailProps.refundAmount = data.refundAmount
    }
    if (data.refundStatus) {
      emailProps.refundStatus = data.refundStatus
    }

    const emailHtml = await render(CancellationNoticeEmail(emailProps))

    const result = await resend.emails.send({
      from: getFrom(),
      to: data.guestEmail,
      subject: `Reservation Cancelled - ${data.confirmationNumber} at ${data.propertyName}`,
      html: emailHtml,
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('[Email] Failed to send cancellation notice:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}
