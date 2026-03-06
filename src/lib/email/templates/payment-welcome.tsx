import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components'

export interface PaymentWelcomeEmailProps {
  companyName: string
  planLabel: string
  onboardingUrl: string
}

export function PaymentWelcomeEmail({
  companyName,
  planLabel,
  onboardingUrl,
}: PaymentWelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Payment confirmed – Welcome to CampOS, {companyName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Heading style={logo}>🏕️ CampOS</Heading>
          </Section>

          <Section style={contentSection}>
            <Heading style={h1}>
              Payment confirmed – Welcome, {companyName}!
            </Heading>
            <Text style={text}>
              Your payment was successful. Thank you for subscribing to the{' '}
              <strong>{planLabel}</strong> plan. Your account and properties are
              ready – use the link below to finish setup and start accepting
              bookings.
            </Text>

            <Section style={stepsBox}>
              <Heading as="h2" style={h2}>
                🚀 Next Steps
              </Heading>
              <Text style={stepsList}>
                <strong>1. Complete your property setup</strong> – Add details,
                photos, and amenities (2 minutes)
              </Text>
              <Text style={stepsList}>
                <strong>2. Create your campsites</strong> – Define sites and set
                pricing (5 minutes)
              </Text>
              <Text style={stepsList}>
                <strong>3. Connect Stripe</strong> – Link your account to
                receive payouts (3 minutes)
              </Text>
              <Text style={stepsList}>
                <strong>4. Launch!</strong> – Go live and start accepting
                bookings
              </Text>
            </Section>

            <Section style={buttonSection}>
              <Link href={onboardingUrl} style={button}>
                Open onboarding (finish setup) →
              </Link>
            </Section>

            <Text style={linkFallback}>
              Or copy this link into your browser:
              <br />
              <Link href={onboardingUrl} style={link}>
                {onboardingUrl}
              </Link>
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footerSection}>
            <Text style={footerText}>Need help getting started?</Text>
            <Text style={footerText}>
              <Link href="mailto:support@campgroundos.com" style={footerLink}>
                Contact our support team
              </Link>
            </Text>
            <Text style={copyright}>
              © {new Date().getFullYear()} CampOS. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default PaymentWelcomeEmail

const main = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  lineHeight: 1.6,
  color: '#333',
  backgroundColor: '#ffffff',
}

const container = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '20px',
}

const headerSection = {
  textAlign: 'center' as const,
  padding: '20px 0',
  borderBottom: '2px solid #f0f0f0',
}

const logo = {
  color: '#DC2626',
  margin: 0,
  fontSize: '28px',
}

const contentSection = {
  padding: '30px 0',
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  marginBottom: '20px',
  marginTop: 0,
}

const h2 = {
  marginTop: 0,
  color: '#1a1a1a',
  fontSize: '18px',
}

const text = {
  fontSize: '16px',
  color: '#555',
  marginBottom: '20px',
}

const stepsBox = {
  backgroundColor: '#f9fafb',
  borderLeft: '4px solid #DC2626',
  padding: '20px',
  margin: '30px 0',
}

const stepsList = {
  margin: '0 0 10px',
  paddingLeft: 0,
  color: '#555',
  fontSize: '16px',
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '40px 0',
}

const button = {
  display: 'inline-block',
  backgroundColor: '#DC2626',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '16px 32px',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '16px',
}

const linkFallback = {
  fontSize: '14px',
  color: '#888',
  textAlign: 'center' as const,
  marginTop: '30px',
}

const link = {
  color: '#DC2626',
  wordBreak: 'break-all' as const,
}

const hr = {
  borderColor: '#f0f0f0',
  margin: '40px 0 0',
}

const footerSection = {
  paddingTop: '20px',
  textAlign: 'center' as const,
  color: '#888',
  fontSize: '14px',
}

const footerText = {
  margin: '0 0 8px',
  color: '#888',
}

const footerLink = {
  color: '#DC2626',
  textDecoration: 'none',
}

const copyright = {
  marginTop: '20px',
  fontSize: '12px',
  color: '#aaa',
}
