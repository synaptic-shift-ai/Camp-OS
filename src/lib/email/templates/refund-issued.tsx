import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface RefundIssuedEmailProps {
  guestName: string
  confirmationNumber: string
  propertyName: string
  refundAmountCents: number
  refundPaymentMethod?: string
}

export function RefundIssuedEmail({
  guestName,
  confirmationNumber,
  propertyName,
  refundAmountCents,
  refundPaymentMethod,
}: RefundIssuedEmailProps) {
  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  return (
    <Html>
      <Head />
      <Preview>
        Refund issued - {confirmationNumber} at {propertyName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Refund Issued</Heading>

          <Text style={textWithPadding}>
            Dear {guestName},
          </Text>

          <Text style={textWithPadding}>
            A refund has been issued for your cancelled reservation at {propertyName}.
          </Text>

          <Section style={detailsSection}>
            <Heading as="h2" style={h2}>
              Refund Details
            </Heading>

            <table style={detailsTable}>
              <tbody>
                <tr>
                  <td style={labelCell}>Confirmation Number:</td>
                  <td style={valueCell}><strong>{confirmationNumber}</strong></td>
                </tr>
                <tr>
                  <td style={labelCell}>Refund Amount:</td>
                  <td style={valueCell}><strong>{formatMoney(refundAmountCents)}</strong></td>
                </tr>
                {refundPaymentMethod ? (
                  <tr>
                    <td style={labelCell}>Refund Method:</td>
                    <td style={valueCell}>{refundPaymentMethod}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <Text style={noteText}>
              The refund has been processed and should appear in your account within 5-10 business days, depending on your financial institution.
            </Text>
          </Section>

          <Text style={footerText}>
            If you have any questions about this refund, please contact {propertyName} directly.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default RefundIssuedEmail

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

const textWithPadding = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 40px',
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
  backgroundColor: '#ecfdf5',
  marginTop: '24px',
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
