const EMAILIT_API_URL = 'https://api.emailit.com/v2/emails'

function getApiKey(): string {
    const key = process.env.EMAILIT_API_KEY
    if (!key) {
        throw new Error('EMAILIT_API_KEY environment variable is not set')
    }
    return key
}

const SENDER_NAME = 'CampOS'

function getFromEmail(): string {
    const from = process.env.EMAILIT_FROM_EMAIL
    if (!from) {
        throw new Error('EMAILIT_FROM_EMAIL environment variable is not set')
    }
    return from
}

export function getFrom(): string {
    return `${SENDER_NAME} <${getFromEmail()}>`
}

export type EmailitSendResult = {
    success: true
    id: string
} | {
    success: false
    error: string
}

export async function sendEmail(params: {
    to: string | string[]
    subject: string
    html: string
    text?: string
    from?: string
}): Promise<EmailitSendResult> {
    const apiKey = getApiKey()
    const from = params.from ?? getFrom()

    try {
        const response = await fetch(EMAILIT_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to: Array.isArray(params.to) ? params.to : [params.to],
                subject: params.subject,
                html: params.html,
                ...(params.text && { text: params.text }),
            }),
        })

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ error: 'Unknown error' })) as {
                error?: string
                details?: string
                message?: string
            }
            console.error('[Emailit] API error:', response.status, errorBody)
            const main = errorBody.error || errorBody.message || `HTTP ${response.status}`
            const details = errorBody.details ? ` — ${errorBody.details}` : ''
            return {
                success: false,
                error: main + details,
            }
        }

        const data = await response.json()
        return { success: true, id: data.id }
    } catch (error) {
        console.error('[Emailit] Send failed:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send email',
        }
    }
}
