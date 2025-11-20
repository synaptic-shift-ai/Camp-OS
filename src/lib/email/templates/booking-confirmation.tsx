import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components'

interface BookingConfirmationEmailProps {
  guestName: string
  confirmationNumber: string
  propertyName: string
  siteName: string
  checkInDate: string
  checkOutDate: string
  numNights: number
  numAdults: number
  numChildren: number
  totalAmount: number // in cents
  paidAmount: number // in cents
  paymentStatus: 'paid' | 'unpaid' | 'partial'
  specialRequests?: string
  propertyPhone?: string
  propertyEmail?: string
  propertyAddress?: string
  checkInTime?: string
  checkOutTime?: string
  directions?: string
}

export function BookingConfirmationEmail({
  guestName,
  confirmationNumber,
  propertyName,
  siteName,
  checkInDate,
  checkOutDate,
  numNights,
  numAdults,
  numChildren,
  totalAmount,
  paidAmount,
  paymentStatus,
  specialRequests,
  propertyPhone,
  propertyEmail,
  propertyAddress,
  checkInTime,
  checkOutTime,
  directions,
}: BookingConfirmationEmailProps) {
  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTime = (time: string | undefined) => {
    if (!time) return ''
    const parts = time.split(':')
    const hours = parts[0]
    const minutes = parts[1]
    if (!hours || !minutes) return ''
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const balanceDue = totalAmount - paidAmount

  return (
    <Html>
      <Head />
      <Preview>
        Booking Confirmed - {confirmationNumber} at {propertyName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Booking Confirmation</Heading>

          <Text style={text}>
            Dear {guestName},
          </Text>

          <Text style={text}>
            Your reservation at {propertyName} has been confirmed! We look forward to hosting you.
          </Text>

          <Section style={detailsSection}>
            <Heading as="h2" style={h2}>
              Reservation Details
            </Heading>

            <table style={detailsTable}>
              <tbody>
                <tr>
                  <td style={labelCell}>Confirmation Number:</td>
                  <td style={valueCell}><strong>{confirmationNumber}</strong></td>
                </tr>
                <tr>
                  <td style={labelCell}>Site:</td>
                  <td style={valueCell}>{siteName}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Check-in:</td>
                  <td style={valueCell}>{formatDate(checkInDate)}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Check-out:</td>
                  <td style={valueCell}>{formatDate(checkOutDate)}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Nights:</td>
                  <td style={valueCell}>{numNights}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Guests:</td>
                  <td style={valueCell}>
                    {numAdults} {numAdults === 1 ? 'Adult' : 'Adults'}
                    {numChildren > 0 && `, ${numChildren} ${numChildren === 1 ? 'Child' : 'Children'}`}
                  </td>
                </tr>
              </tbody>
            </table>

            {specialRequests && (
              <>
                <Hr style={hr} />
                <Text style={labelText}>Special Requests:</Text>
                <Text style={text}>{specialRequests}</Text>
              </>
            )}
          </Section>

          <Section style={paymentSection}>
            <Heading as="h2" style={h2}>
              Payment Information
            </Heading>

            <table style={detailsTable}>
              <tbody>
                <tr>
                  <td style={labelCell}>Total Amount:</td>
                  <td style={valueCell}><strong>{formatMoney(totalAmount)}</strong></td>
                </tr>
                <tr>
                  <td style={labelCell}>Amount Paid:</td>
                  <td style={valueCell}>{formatMoney(paidAmount)}</td>
                </tr>
                {balanceDue > 0 && (
                  <tr>
                    <td style={labelCell}>Balance Due:</td>
                    <td style={valueCell}><strong>{formatMoney(balanceDue)}</strong></td>
                  </tr>
                )}
                <tr>
                  <td style={labelCell}>Payment Status:</td>
                  <td style={valueCell}>
                    <span style={paymentStatus === 'paid' ? paidBadge : unpaidBadge}>
                      {paymentStatus.toUpperCase()}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            {paymentStatus !== 'paid' && (
              <Text style={noteText}>
                Please settle the remaining balance upon arrival or as arranged with the property.
              </Text>
            )}
          </Section>

          {(checkInTime || checkOutTime || propertyPhone || propertyEmail || propertyAddress || directions) && (
            <>
              <Section style={detailsSection}>
                <Heading as="h2" style={h2}>
                  Arrival & Check-In Information
                </Heading>

                {(checkInTime || checkOutTime) && (
                  <>
                    <table style={detailsTable}>
                      <tbody>
                        {checkInTime && (
                          <tr>
                            <td style={labelCell}>Check-in Time:</td>
                            <td style={valueCell}>After {formatTime(checkInTime)}</td>
                          </tr>
                        )}
                        {checkOutTime && (
                          <tr>
                            <td style={labelCell}>Check-out Time:</td>
                            <td style={valueCell}>Before {formatTime(checkOutTime)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <Hr style={hr} />
                  </>
                )}

                {(propertyPhone || propertyEmail || propertyAddress) && (
                  <>
                    <Text style={labelText}>Property Contact:</Text>
                    <table style={detailsTable}>
                      <tbody>
                        {propertyPhone && (
                          <tr>
                            <td style={labelCell}>Phone:</td>
                            <td style={valueCell}>{propertyPhone}</td>
                          </tr>
                        )}
                        {propertyEmail && (
                          <tr>
                            <td style={labelCell}>Email:</td>
                            <td style={valueCell}>{propertyEmail}</td>
                          </tr>
                        )}
                        {propertyAddress && (
                          <tr>
                            <td style={labelCell}>Address:</td>
                            <td style={valueCell}>{propertyAddress}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </>
                )}

                {directions && (
                  <>
                    <Hr style={hr} />
                    <Text style={labelText}>Directions:</Text>
                    <Text style={noteText}>{directions}</Text>
                  </>
                )}
              </Section>
            </>
          )}

          <Hr style={hr} />

          <Text style={footerText}>
            If you have any questions or need to modify your reservation, please contact {propertyName} directly.
          </Text>

          <Text style={footerText}>
            Thank you for choosing {propertyName}. We can't wait to welcome you!
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default BookingConfirmationEmail

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0 40px',
}

const h2 = {
  color: '#333',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '20px 0 10px',
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 40px',
}

const labelText = {
  color: '#666',
  fontSize: '14px',
  fontWeight: 'bold',
  padding: '0 40px',
  marginBottom: '8px',
}

const noteText = {
  color: '#666',
  fontSize: '14px',
  fontStyle: 'italic',
  marginTop: '16px',
}

const footerText = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 40px',
  marginTop: '16px',
}

const detailsSection = {
  padding: '24px 40px',
  backgroundColor: '#f9fafb',
  marginTop: '24px',
}

const paymentSection = {
  padding: '24px 40px',
  backgroundColor: '#f9fafb',
  marginTop: '16px',
}

const detailsTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
}

const labelCell = {
  color: '#666',
  fontSize: '14px',
  padding: '8px 0',
  verticalAlign: 'top' as const,
  width: '40%',
}

const valueCell = {
  color: '#333',
  fontSize: '14px',
  padding: '8px 0',
  verticalAlign: 'top' as const,
}

const paidBadge = {
  backgroundColor: '#10b981',
  color: '#ffffff',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 'bold',
}

const unpaidBadge = {
  backgroundColor: '#f59e0b',
  color: '#ffffff',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 'bold',
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 40px',
}
