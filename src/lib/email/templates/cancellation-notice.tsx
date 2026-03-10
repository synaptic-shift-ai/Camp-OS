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

interface CancellationNoticeEmailProps {
  guestName: string
  confirmationNumber: string
  propertyName: string
  siteName: string
  checkInDate: string
  checkOutDate: string
  cancellationDate: string
  cancellationReason?: string
  refundAmount?: number // in cents, if applicable
  refundPaymentMethod?: string
  refundStatus?: 'processing' | 'completed' | 'none'
}

export function CancellationNoticeEmail({
  guestName,
  confirmationNumber,
  propertyName,
  siteName,
  checkInDate,
  checkOutDate,
  cancellationDate,
  cancellationReason,
  refundAmount,
  refundPaymentMethod,
  refundStatus = 'none',
}: CancellationNoticeEmailProps) {
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

  return (
    <Html>
      <Head />
      <Preview>
        Reservation Cancelled - {confirmationNumber} at {propertyName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Reservation Cancelled</Heading>

          <Text style={textWithPadding}>
            Dear {guestName},
          </Text>

          <Text style={textWithPadding}>
            Your reservation at {propertyName} has been cancelled.
          </Text>

          <Section style={detailsSection}>
            <Heading as="h2" style={h2}>
              Cancelled Reservation Details
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
                  <td style={labelCell}>Original Check-in:</td>
                  <td style={valueCell}>{formatDate(checkInDate)}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Original Check-out:</td>
                  <td style={valueCell}>{formatDate(checkOutDate)}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Cancellation Date:</td>
                  <td style={valueCell}>{formatDate(cancellationDate)}</td>
                </tr>
              </tbody>
            </table>

            {cancellationReason && (
              <>
                <Hr style={hr} />
                <Text style={labelText}>Cancellation Reason:</Text>
                <Text style={text}>{cancellationReason}</Text>
              </>
            )}
          </Section>

          {refundAmount !== undefined && refundAmount > 0 && (
            <Section style={refundSection}>
              <Heading as="h2" style={h2}>
                Refund Information
              </Heading>

              <table style={detailsTable}>
                <tbody>
                  <tr>
                    <td style={labelCell}>Refund Amount:</td>
                    <td style={valueCell}><strong>{formatMoney(refundAmount)}</strong></td>
                  </tr>
                  {refundPaymentMethod ? (
                    <tr>
                      <td style={labelCell}>Refund Method:</td>
                      <td style={valueCell}>{refundPaymentMethod}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td style={labelCell}>Refund Status:</td>
                    <td style={valueCell}>
                      <span style={refundStatus === 'completed' ? completedBadge : processingBadge}>
                        {refundStatus === 'completed' ? 'COMPLETED' : 'PROCESSING'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <Text style={noteText}>
                {refundStatus === 'processing'
                  ? 'Your refund is being processed and should appear in your account within 5-10 business days.'
                  : 'Your refund has been completed and should appear in your account shortly.'}
              </Text>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={footerText}>
            We're sorry to see your plans change. If you'd like to rebook in the future, we'd be happy to welcome you to {propertyName}.
          </Text>

          <Text style={footerText}>
            If you have any questions about this cancellation, please contact {propertyName} directly.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default CancellationNoticeEmail

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
}

const textWithPadding = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 40px',
}

const labelText = {
  color: '#666',
  fontSize: '14px',
  fontWeight: 'bold',
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

const refundSection = {
  padding: '24px 40px',
  backgroundColor: '#fef3c7',
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

const completedBadge = {
  backgroundColor: '#10b981',
  color: '#ffffff',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 'bold',
}

const processingBadge = {
  backgroundColor: '#3b82f6',
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
