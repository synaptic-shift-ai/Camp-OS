import nodemailer from "nodemailer"

function getSmtpConfig() {
    const host = process.env.SMTP_HOST
    const port = process.env.SMTP_PORT
    const user = process.env.SMTP_USERNAME
    const pass = process.env.SMTP_PASSWORD
    if (!host || !user || !pass) {
        throw new Error(
            "SMTP_HOST, SMTP_PORT, SMTP_USERNAME, and SMTP_PASSWORD must be set"
        )
    }
    return {
        host,
        port: port ? parseInt(port, 10) : 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: { user, pass },
    }
}

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
    if (!transporter) {
        transporter = nodemailer.createTransport(getSmtpConfig())
    }
    return transporter
}

const SENDER_NAME = "CampOS"

function getFromEmail(): string {
    const from = process.env.SMTP_FROM_EMAIL
    if (!from) {
        throw new Error("SMTP_FROM_EMAIL environment variable is not set")
    }
    return from
}

export function getFrom(): string {
    return `${SENDER_NAME} <${getFromEmail()}>`
}

export type EmailitSendResult =
    | { success: true; id: string }
    | { success: false; error: string }

export async function sendEmail(params: {
    to: string | string[]
    subject: string
    html: string
    text?: string
    from?: string
}): Promise<EmailitSendResult> {
    const from = params.from ?? getFrom()
    const toList = Array.isArray(params.to) ? params.to : [params.to]

    try {
        const transport = getTransporter()
        const info = await transport.sendMail({
            from,
            to: toList,
            subject: params.subject,
            html: params.html,
            ...(params.text && { text: params.text }),
        })

        return {
            success: true,
            id: info.messageId ?? "",
        }
    } catch (error) {
        console.error("[Emailit] SMTP send failed:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to send email",
        }
    }
}
