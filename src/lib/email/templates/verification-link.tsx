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
} from '@react-email/components'
import { render } from '@react-email/components'

export interface VerificationLinkEmailProps {
  verifyUrl: string
  appName?: string
  expiresIn?: string
}

export function VerificationLinkEmail({
  verifyUrl,
  appName = 'CampOS',
  expiresIn = '24 hours',
}: VerificationLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your email – {appName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={inner}>
            <Heading style={h1}>✉️ Verify your email</Heading>
            <Text style={intro}>
              Click the button below to verify your email and get started with{' '}
              {appName}.
            </Text>
            <Section style={buttonSection}>
              <Link href={verifyUrl} style={button}>
                Verify Email Address
              </Link>
            </Section>
            <Text style={linkLabel}>
              Or copy and paste this link into your browser:
            </Text>
            <Text style={linkUrl}>{verifyUrl}</Text>
            <Text style={footer}>
              This link expires in {expiresIn}. If you didn&rsquo;t sign up for{' '}
              {appName}, you can safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default VerificationLinkEmail

export async function buildVerificationLinkEmailHtml(
  verifyUrl: string,
  appName = 'CampOS',
  expiresIn?: string
): Promise<string> {
  return render(
    VerificationLinkEmail({
      verifyUrl,
      appName,
      ...(expiresIn !== undefined && { expiresIn }),
    })
  )
}

const main = {
  margin: 0,
  padding: 0,
  backgroundColor: '#f4f4f5',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
  width: '100%',
  backgroundColor: '#f4f4f5',
  padding: '40px 20px',
}

const inner = {
  maxWidth: '460px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e4e4e7',
  overflow: 'hidden' as const,
  padding: '32px 32px 24px',
}

const h1 = {
  margin: '0 0 8px',
  fontSize: '22px',
  fontWeight: 700,
  color: '#18181b',
}

const intro = {
  margin: '0 0 24px',
  fontSize: '14px',
  color: '#52525b',
}

const buttonSection = {
  textAlign: 'center' as const,
  marginBottom: '24px',
}

const button = {
  display: 'inline-block',
  padding: '14px 32px',
  background: 'linear-gradient(to right, #ef4444, #ec4899)',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 600,
  textDecoration: 'none',
  borderRadius: '8px',
}

const linkLabel = {
  margin: '0 0 16px',
  fontSize: '13px',
  color: '#71717a',
}

const linkUrl = {
  margin: '0 0 24px',
  fontSize: '12px',
  color: '#52525b',
  wordBreak: 'break-all' as const,
}

const footer = {
  margin: 0,
  fontSize: '13px',
  color: '#71717a',
}
