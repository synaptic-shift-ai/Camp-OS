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
  paymentStatus: 'paid' | 'pending' | 'partial'
  specialRequests?: string
  // Property contact & arrival info
  propertyPhone?: string
  propertyEmail?: string
  propertyAddress?: string
  checkInTime?: string
  checkOutTime?: string
  directions?: string
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
    if (data.propertyPhone) {
      emailProps.propertyPhone = data.propertyPhone
    }
    if (data.propertyEmail) {
      emailProps.propertyEmail = data.propertyEmail
    }
    if (data.propertyAddress) {
      emailProps.propertyAddress = data.propertyAddress
    }
    if (data.checkInTime) {
      emailProps.checkInTime = data.checkInTime
    }
    if (data.checkOutTime) {
      emailProps.checkOutTime = data.checkOutTime
    }
    if (data.directions) {
      emailProps.directions = data.directions
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
