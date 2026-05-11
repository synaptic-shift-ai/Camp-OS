import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export type PaymentReceiptLineItem = {
  quantity: number
  description: string
  unitPriceCents: number
  amountCents: number
  /** When true, unit price column shows e.g. "40.00/night" (site stay billing). */
  unitPricePerNight?: boolean
}

export interface PaymentReceivedInvoiceEmailProps {
  propertyName: string
  propertyAddressLines: string[]
  propertyContactEmail?: string | null
  propertyContactPhone?: string | null
  guestName: string
  guestAddressLines: string[]
  confirmationNumber: string
  receiptNumber: string
  receiptDate: string
  documentTitle?: string
  lineItems: PaymentReceiptLineItem[]
  chargesSubtotalCents: number
  amountPaidThisReceiptCents: number
  paymentMethodLabel: string
  paymentSourceLabel: string
  totalReservationCents: number | null
  newPaidTotalCents: number | null
}

export function PaymentReceivedInvoiceEmail({
  propertyName,
  propertyAddressLines,
  propertyContactEmail,
  propertyContactPhone,
  guestName,
  guestAddressLines,
  confirmationNumber,
  receiptNumber,
  receiptDate,
  documentTitle = 'PAYMENT RECEIPT',
  lineItems,
  chargesSubtotalCents,
  amountPaidThisReceiptCents,
  paymentMethodLabel,
  paymentSourceLabel,
  totalReservationCents,
  newPaidTotalCents,
}: PaymentReceivedInvoiceEmailProps) {
  const formatMoney = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)

  const formatMoneyPlain = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100)

  const remainingCents =
    totalReservationCents != null && newPaidTotalCents != null
      ? Math.max(0, totalReservationCents - newPaidTotalCents)
      : null

  const guestBlock = [guestName, ...guestAddressLines].filter(Boolean).join('\n')

  return (
    <Html>
      <Head />
      <Preview>
        {documentTitle} — {confirmationNumber} · {propertyName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header: company left */}
          <Section style={headerSection}>
            <table cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: 'top', width: '58%' }}>
                    <Text style={companyName}>{propertyName}</Text>
                    {propertyAddressLines.map((line) => (
                      <Text key={line} style={companyAddress}>
                        {line}
                      </Text>
                    ))}
                  </td>
                  <td style={{ verticalAlign: 'top', width: '42%', textAlign: 'right' }}>
                    <Text style={logoPlaceholder}> </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Hr style={hr} />

          <Section style={titleSection}>
            <Text style={docTitle}>{documentTitle}</Text>
          </Section>

          {/* Billed to + receipt meta */}
          <Section style={metaSection}>
            <table cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: 'top', width: '50%', paddingRight: '16px' }}>
                    <Text style={metaLabel}>Billed to</Text>
                    <Text style={metaValue}>{guestBlock || guestName}</Text>
                  </td>
                  <td style={{ verticalAlign: 'top', width: '50%', textAlign: 'right' }}>
                    <table cellPadding={0} cellSpacing={0} style={{ marginLeft: 'auto' }}>
                      <tbody>
                        <tr>
                          <td style={receiptMetaLabel}>Receipt #</td>
                          <td style={receiptMetaValue}>{receiptNumber}</td>
                        </tr>
                        <tr>
                          <td style={receiptMetaLabel}>Confirmation</td>
                          <td style={receiptMetaValue}>{confirmationNumber}</td>
                        </tr>
                        <tr>
                          <td style={receiptMetaLabel}>Receipt date</td>
                          <td style={receiptMetaValue}>{receiptDate}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={{ padding: '0 32px', marginTop: '28px' }}>
            <Text style={sectionIntro}>
              The following charges are on your account. This receipt reflects the payment recorded today.
            </Text>
          </Section>

          {/* Line items table */}
          <Section style={tableWrap}>
            <table cellPadding={0} cellSpacing={0} style={lineTable}>
              <thead>
                <tr>
                  <th style={thQty}>QTY</th>
                  <th style={thDesc}>Description</th>
                  <th style={thPrice}>Unit price</th>
                  <th style={thAmt}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length > 0 ? (
                  lineItems.map((row, idx) => (
                    <tr key={`line-${idx}`}>
                      <td style={tdQty}>{row.quantity}</td>
                      <td style={tdDesc}>{row.description}</td>
                      <td style={tdPrice}>
                        {row.unitPricePerNight
                          ? `${formatMoney(row.unitPriceCents)}/night`
                          : formatMoneyPlain(row.unitPriceCents)}
                      </td>
                      <td style={tdAmt}>{formatMoney(row.amountCents)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td style={tdQty}>1</td>
                    <td style={tdDesc}>Payment on account</td>
                    <td style={tdPrice}>{formatMoneyPlain(amountPaidThisReceiptCents)}</td>
                    <td style={tdAmt}>{formatMoney(amountPaidThisReceiptCents)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>

          <Hr style={hrLight} />

          {/* Totals */}
          <Section style={totalsSection}>
            <table cellPadding={0} cellSpacing={0} style={{ width: '100%', maxWidth: '280px', marginLeft: 'auto' }}>
              <tbody>
                <tr>
                  <td style={totalLabel}>Charges subtotal</td>
                  <td style={totalValue}>{formatMoney(lineItems.length > 0 ? chargesSubtotalCents : amountPaidThisReceiptCents)}</td>
                </tr>
                <tr>
                  <td style={totalLabel}>Amount paid (this receipt)</td>
                  <td style={totalValueStrong}>{formatMoney(amountPaidThisReceiptCents)}</td>
                </tr>
                <tr>
                  <td style={totalLabel}>Payment method</td>
                  <td style={totalValue}>
                    {paymentMethodLabel}
                    <span style={paymentSourceMuted}> · {paymentSourceLabel}</span>
                  </td>
                </tr>
                {remainingCents != null ? (
                  <tr>
                    <td style={totalLabelFinal}>Remaining balance</td>
                    <td style={totalValueFinal}>{formatMoney(remainingCents)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Section>

          <Hr style={hrDouble} />

          {/* Notes / footer */}
          <Section style={notesSection}>
            <Text style={notesHeading}>Notes</Text>
            <Text style={notesBody}>
              Thank you for your payment. Please retain this receipt for your records. If you have questions about
              charges or payments, contact {propertyName}
              {propertyContactEmail ? ` at ${propertyContactEmail}` : ''}
              {propertyContactPhone ? ` or ${propertyContactPhone}` : ''}.
            </Text>
            {totalReservationCents != null ? (
              <Text style={notesFine}>
                Reservation total {formatMoney(totalReservationCents)}
                {newPaidTotalCents != null ? ` · Total paid after this receipt ${formatMoney(newPaidTotalCents)}` : ''}
                .
              </Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default PaymentReceivedInvoiceEmail

const main = {
  backgroundColor: '#f0f0f0',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '32px 0 48px',
  maxWidth: '640px',
}

const headerSection = {
  padding: '0 32px',
}

const companyName = {
  color: '#111',
  fontSize: '15px',
  fontWeight: 700,
  lineHeight: '22px',
  margin: '0 0 4px',
}

const companyAddress = {
  color: '#444',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
}

const logoPlaceholder = {
  fontSize: '11px',
  color: '#999',
  margin: '0',
}

const hr = {
  borderColor: '#ddd',
  margin: '20px 32px',
}

const hrLight = {
  borderColor: '#e5e5e5',
  margin: '0 32px 16px',
}

const hrDouble = {
  borderColor: '#111',
  borderTopWidth: '2px',
  margin: '8px 32px 24px',
}

const titleSection = {
  padding: '8px 32px 0',
  textAlign: 'right' as const,
}

const docTitle = {
  color: '#111',
  fontSize: '22px',
  fontWeight: 800,
  letterSpacing: '0.04em',
  margin: '0',
  textTransform: 'uppercase' as const,
}

const metaSection = {
  padding: '24px 32px 0',
}

const metaLabel = {
  color: '#111',
  fontSize: '13px',
  fontWeight: 700,
  margin: '0 0 8px',
}

const metaValue = {
  color: '#333',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
  whiteSpace: 'pre-line' as const,
}

const receiptMetaLabel = {
  color: '#333',
  fontSize: '12px',
  fontWeight: 700,
  padding: '4px 12px 4px 0',
  textAlign: 'right' as const,
  verticalAlign: 'top' as const,
}

const receiptMetaValue = {
  color: '#111',
  fontSize: '12px',
  padding: '4px 0',
  textAlign: 'right' as const,
  verticalAlign: 'top' as const,
}

const sectionIntro = {
  color: '#555',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
}

const tableWrap = {
  padding: '16px 32px 0',
}

const lineTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  border: '1px solid #ddd',
}

const thShared = {
  backgroundColor: '#3d3d3d',
  color: '#fff',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  padding: '10px 12px',
  textAlign: 'left' as const,
  textTransform: 'uppercase' as const,
}

const thQty = { ...thShared, width: '44px' }
const thDesc = { ...thShared }
const thPrice = { ...thShared, width: '96px', textAlign: 'right' as const }
const thAmt = { ...thShared, width: '96px', textAlign: 'right' as const }

const tdShared = {
  borderBottom: '1px solid #eee',
  color: '#222',
  fontSize: '13px',
  padding: '12px',
  verticalAlign: 'top' as const,
}

const tdQty = { ...tdShared, textAlign: 'center' as const }
const tdDesc = { ...tdShared }
const tdPrice = { ...tdShared, textAlign: 'right' as const }
const tdAmt = { ...tdShared, textAlign: 'right' as const, fontWeight: 600 }

const totalsSection = {
  padding: '8px 32px 0',
}

const totalLabel = {
  color: '#555',
  fontSize: '13px',
  padding: '6px 12px 6px 0',
}

const totalValue = {
  color: '#111',
  fontSize: '13px',
  padding: '6px 0',
  textAlign: 'right' as const,
}

const totalValueStrong = {
  ...totalValue,
  fontWeight: 700,
}

const paymentSourceMuted = {
  color: '#777',
  fontWeight: 400,
}

const totalLabelFinal = {
  ...totalLabel,
  borderTop: '1px solid #ccc',
  fontWeight: 700,
  color: '#111',
  paddingTop: '12px',
}

const totalValueFinal = {
  ...totalValue,
  borderTop: '1px solid #ccc',
  fontWeight: 800,
  fontSize: '15px',
  paddingTop: '12px',
}

const notesSection = {
  padding: '0 32px',
}

const notesHeading = {
  color: '#111',
  fontSize: '13px',
  fontWeight: 700,
  margin: '0 0 8px',
}

const notesBody = {
  color: '#444',
  fontSize: '13px',
  lineHeight: '21px',
  margin: '0 0 8px',
}

const notesFine = {
  color: '#777',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0',
}
