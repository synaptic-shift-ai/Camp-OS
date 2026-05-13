import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import { enrichContext } from '@/lib/email/template-renderer'

export type PreArrivalEmailBranding = {
  logoUrl?: string | null
  primaryColor?: string | null
}

export type PreArrivalEmailProps = {
  guestName: string
  confirmationNumber: string
  propertyName: string
  siteName: string
  checkInDate: string
  checkOutDate: string
  numNights: number
  formattedTotal?: string
  balanceDueDisplay?: string
  specialRequests?: string
  propertyPhone?: string
  propertyEmail?: string
  propertyAddress?: string
  checkInTime?: string
  checkOutTime?: string
  directions?: string
  branding?: PreArrivalEmailBranding | null
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(time: string | undefined): string {
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

function optionalTrimmedString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const s = typeof value === 'string' ? value.trim() : String(value).trim()
  return s.length > 0 ? s : undefined
}

export function buildPreArrivalEmailPropsFromEventContext(
  raw: Record<string, unknown>,
  branding?: PreArrivalEmailBranding | null,
): PreArrivalEmailProps | null {
  const data = enrichContext(raw)
  const guest = data.guest as Record<string, unknown> | undefined
  const reservation = data.reservation as Record<string, unknown> | undefined
  const property = data.property as Record<string, unknown> | undefined
  const site = data.site as Record<string, unknown> | undefined

  if (!property || typeof property.name !== 'string' || !property.name.trim()) return null
  if (!reservation?.check_in_date || !reservation?.check_out_date) return null

  const first = typeof guest?.first_name === 'string' ? guest.first_name.trim() : ''
  const last = typeof guest?.last_name === 'string' ? guest.last_name.trim() : ''
  const combined = [first, last].filter(Boolean).join(' ')
  const guestName =
    typeof guest?.name === 'string' && guest.name.trim()
      ? String(guest.name).trim()
      : combined || 'Guest'

  const siteNameParts = [site?.site_name, site?.site_number].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  )
  const siteName = siteNameParts.length > 0 ? siteNameParts.join(' · ') : 'Your site'

  const confirmationNumber =
    typeof reservation.confirmation_number === 'string' && reservation.confirmation_number
      ? reservation.confirmation_number
      : String(reservation.id ?? '')

  const checkInDate = String(reservation.check_in_date)
  const checkOutDate = String(reservation.check_out_date)
  const numNights =
    typeof reservation.num_nights === 'number' && reservation.num_nights > 0
      ? reservation.num_nights
      : 1

  const formattedTotal =
    typeof reservation.formatted_total === 'string' ? reservation.formatted_total : undefined
  const balanceDueDisplay =
    typeof reservation.balance_due === 'string' && reservation.balance_due !== '$0.00'
      ? reservation.balance_due
      : undefined

  const specialRequests =
    typeof reservation.special_requests === 'string' && reservation.special_requests.trim()
      ? reservation.special_requests.trim()
      : undefined

  const propertyPhone = optionalTrimmedString(property.phone)
  const propertyEmail = optionalTrimmedString(property.email)
  const propertyAddress = optionalTrimmedString(property.address)
  const checkInTime = optionalTrimmedString(property.check_in_time)
  const checkOutTime = optionalTrimmedString(property.check_out_time)
  const directions = optionalTrimmedString(property.directions)

  const core: PreArrivalEmailProps = {
    guestName,
    confirmationNumber,
    propertyName: String(property.name).trim(),
    siteName,
    checkInDate,
    checkOutDate,
    numNights,
  }

  return {
    ...core,
    ...(formattedTotal !== undefined ? { formattedTotal } : {}),
    ...(balanceDueDisplay !== undefined ? { balanceDueDisplay } : {}),
    ...(specialRequests !== undefined ? { specialRequests } : {}),
    ...(propertyPhone !== undefined ? { propertyPhone } : {}),
    ...(propertyEmail !== undefined ? { propertyEmail } : {}),
    ...(propertyAddress !== undefined ? { propertyAddress } : {}),
    ...(checkInTime !== undefined ? { checkInTime } : {}),
    ...(checkOutTime !== undefined ? { checkOutTime } : {}),
    ...(directions !== undefined ? { directions } : {}),
    ...(branding ? { branding } : {}),
  }
}

export function PreArrivalEmail({
  guestName,
  confirmationNumber,
  propertyName,
  siteName,
  checkInDate,
  checkOutDate,
  numNights,
  formattedTotal,
  balanceDueDisplay,
  specialRequests,
  propertyPhone,
  propertyEmail,
  propertyAddress,
  checkInTime,
  checkOutTime,
  directions,
  branding,
}: PreArrivalEmailProps) {
  const primary = branding?.primaryColor && branding.primaryColor.trim() ? branding.primaryColor : '#0f766e'

  return (
    <Html>
      <Head />
      <Preview>Your stay at {propertyName} starts in two days — arrival details inside</Preview>
      <Body style={main}>
        <Container style={container}>
          {branding?.logoUrl ? (
            <Section style={{ padding: '0 40px', marginTop: '24px' }}>
              <Img src={branding.logoUrl} alt={propertyName} style={{ maxHeight: 56, width: 'auto' }} />
            </Section>
          ) : null}

          <div style={{ height: 3, backgroundColor: primary, borderRadius: 2, margin: '16px 40px 0' }} />

          <Heading style={h1}>You arrive in two days</Heading>

          <Text style={text}>Hi {guestName},</Text>

          <Text style={text}>
            Your stay at <strong>{propertyName}</strong> is coming up soon. Here is a quick refresher so you can
            pack and plan with confidence.
          </Text>

          <Section style={detailsSection}>
            <Heading as="h2" style={h2}>
              Reservation summary
            </Heading>
            <table style={detailsTable}>
              <tbody>
                <tr>
                  <td style={labelCell}>Confirmation</td>
                  <td style={valueCell}>
                    <strong>{confirmationNumber}</strong>
                  </td>
                </tr>
                <tr>
                  <td style={labelCell}>Site</td>
                  <td style={valueCell}>{siteName}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Check-in</td>
                  <td style={valueCell}>{formatDate(checkInDate)}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Check-out</td>
                  <td style={valueCell}>{formatDate(checkOutDate)}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Nights</td>
                  <td style={valueCell}>{numNights}</td>
                </tr>
                {formattedTotal ? (
                  <tr>
                    <td style={labelCell}>Reservation total</td>
                    <td style={valueCell}>{formattedTotal}</td>
                  </tr>
                ) : null}
                {balanceDueDisplay ? (
                  <tr>
                    <td style={labelCell}>Balance due</td>
                    <td style={valueCell}>
                      <strong>{balanceDueDisplay}</strong>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Section>

          <Section style={tipsSection}>
            <Heading as="h2" style={h2}>
              Before you hit the road
            </Heading>
            <Text style={bulletIntro}>A short checklist that helps most guests arrive smoothly:</Text>
            <Text style={bullet}>Confirm your vehicle length and slide-outs match your site type.</Text>
            <Text style={bullet}>Pack layers, rain gear, and any site-specific adapters or hoses you rely on.</Text>
            <Text style={bullet}>Save this email offline so you have directions and contact info if signal is spotty.</Text>
            <Text style={bullet}>Review balance or add-ons with the property if anything has changed since booking.</Text>
          </Section>

          {(checkInTime || checkOutTime || propertyPhone || propertyEmail || propertyAddress || directions) && (
            <Section style={detailsSection}>
              <Heading as="h2" style={h2}>
                Arrival and property contact
              </Heading>
              {(checkInTime || checkOutTime) && (
                <table style={detailsTable}>
                  <tbody>
                    {checkInTime ? (
                      <tr>
                        <td style={labelCell}>Check-in</td>
                        <td style={valueCell}>After {formatTime(checkInTime)}</td>
                      </tr>
                    ) : null}
                    {checkOutTime ? (
                      <tr>
                        <td style={labelCell}>Check-out</td>
                        <td style={valueCell}>Before {formatTime(checkOutTime)}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              )}
              {(propertyPhone || propertyEmail || propertyAddress) && (
                <>
                  <table style={detailsTable}>
                    <tbody>
                      {propertyPhone ? (
                        <tr>
                          <td style={labelCell}>Phone</td>
                          <td style={valueCell}>{propertyPhone}</td>
                        </tr>
                      ) : null}
                      {propertyEmail ? (
                        <tr>
                          <td style={labelCell}>Email</td>
                          <td style={valueCell}>{propertyEmail}</td>
                        </tr>
                      ) : null}
                      {propertyAddress ? (
                        <tr>
                          <td style={labelCell}>Address</td>
                          <td style={valueCell}>{propertyAddress}</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </>
              )}
              {directions ? (
                <>
                  <Text style={{ ...labelText, marginTop: '16px' }}>Directions</Text>
                  <Text style={noteText}>{directions}</Text>
                </>
              ) : null}
            </Section>
          )}

          {specialRequests ? (
            <Section style={detailsSection}>
              <Heading as="h2" style={h2}>
                Notes on your reservation
              </Heading>
              <Text style={text}>{specialRequests}</Text>
            </Section>
          ) : null}

          <Text style={{ ...footerText, marginTop: '24px' }}>
            We are glad you chose {propertyName}. If you need to update your arrival time or have questions, reply
            to this email or call the number above.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PreArrivalEmail

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
  color: '#111827',
  fontSize: '24px',
  fontWeight: 'bold' as const,
  margin: '28px 0 12px',
  padding: '0 40px',
}

const h2 = {
  color: '#111827',
  fontSize: '18px',
  fontWeight: 'bold' as const,
  margin: '20px 0 10px',
}

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 40px',
}

const bulletIntro = {
  ...text,
  marginBottom: '8px',
}

const bullet = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '24px',
  padding: '0 40px 0 52px',
  margin: '0 0 8px',
}

const labelText = {
  color: '#6b7280',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  padding: '0 40px',
  marginBottom: '8px',
}

const noteText = {
  color: '#4b5563',
  fontSize: '14px',
  lineHeight: '22px',
  padding: '0 40px',
}

const footerText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 40px',
  marginTop: '8px',
}

const detailsSection = {
  padding: '24px 40px',
  backgroundColor: '#f9fafb',
  marginTop: '20px',
}

const tipsSection = {
  padding: '8px 0 8px',
  marginTop: '8px',
}

const detailsTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
}

const labelCell = {
  color: '#6b7280',
  fontSize: '14px',
  padding: '8px 0',
  verticalAlign: 'top' as const,
  width: '38%',
}

const valueCell = {
  color: '#111827',
  fontSize: '14px',
  padding: '8px 0',
  verticalAlign: 'top' as const,
}

