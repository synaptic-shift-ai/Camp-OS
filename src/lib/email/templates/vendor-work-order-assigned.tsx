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
import { render } from '@react-email/components'

export type VendorWorkOrderAssignedEmailProps = {
  vendorName: string
  propertyName: string
  propertyAddress: string
  propertyEmail: string
  workOrderNumber: string
  taskTitle: string
  category?: string | null
  priority?: string | null
  siteLabel: string
  description?: string | null
  estimatedLaborCost?: number | null
}

export function VendorWorkOrderAssignedEmail({
  vendorName,
  propertyName,
  propertyAddress,
  propertyEmail,
  workOrderNumber,
  taskTitle,
  category,
  priority,
  siteLabel,
  description,
  estimatedLaborCost,
}: VendorWorkOrderAssignedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Work order invitation: {workOrderNumber}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Heading style={h1}>Work Order Invitation</Heading>
            <Text style={text}>Hello {vendorName},</Text>
            <Text style={text}>
              You are invited to handle a maintenance work order for {propertyName}.
            </Text>
            <Section style={details}>
              <Text style={detail}><strong>Property:</strong> {propertyName}</Text>
              <Text style={detail}><strong>Property Address:</strong> {propertyAddress}</Text>
              <Text style={detail}><strong>Work Order:</strong> {workOrderNumber}</Text>
              <Text style={detail}><strong>Task:</strong> {taskTitle}</Text>
              <Text style={detail}><strong>Site:</strong> {siteLabel}</Text>
              <Text style={detail}><strong>Category:</strong> {category ?? 'Uncategorized'}</Text>
              <Text style={detail}><strong>Priority:</strong> {priority ?? 'medium'}</Text>
              <Text style={detail}>
                <strong>Estimated Labor Cost:</strong>{" "}
                {estimatedLaborCost != null ? `$${estimatedLaborCost.toFixed(2)}` : "Not provided"}
              </Text>
            </Section>
            {description ? (
              <Section style={descriptionBox}>
                <Text style={descriptionLabel}>Work Order Description</Text>
                <Text style={descriptionText}>{description}</Text>
              </Section>
            ) : null}
            <Text style={footer}>
              Contact {propertyEmail} if you are interested.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export async function buildVendorWorkOrderAssignedEmailHtml(
  props: VendorWorkOrderAssignedEmailProps,
): Promise<string> {
  return render(VendorWorkOrderAssignedEmail(props))
}

const main = {
  margin: 0,
  padding: 0,
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
  width: '100%',
  backgroundColor: '#f4f4f5',
  padding: '40px 20px',
}

const card = {
  maxWidth: '520px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e4e4e7',
  padding: '28px 28px 22px',
}

const h1 = {
  margin: '0 0 10px',
  fontSize: '22px',
  fontWeight: 700,
  color: '#18181b',
}

const text = {
  margin: '0 0 12px',
  fontSize: '14px',
  color: '#3f3f46',
}

const details = {
  marginTop: '8px',
  marginBottom: '14px',
  padding: '14px',
  borderRadius: '10px',
  border: '1px solid #e4e4e7',
  backgroundColor: '#fafafa',
}

const detail = {
  margin: '0 0 8px',
  fontSize: '13px',
  color: '#27272a',
}

const descriptionBox = {
  marginBottom: '14px',
  padding: '12px 14px',
  borderRadius: '10px',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
}

const descriptionLabel = {
  margin: '0 0 6px',
  fontSize: '12px',
  fontWeight: 700,
  color: '#334155',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.02em',
}

const descriptionText = {
  margin: 0,
  fontSize: '13px',
  color: '#334155',
}

const footer = {
  margin: 0,
  fontSize: '12px',
  color: '#71717a',
}
