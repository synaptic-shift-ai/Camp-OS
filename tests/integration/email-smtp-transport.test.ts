/**
 * SMTP transport integration test
 *
 * Exercises src/lib/email/emailit.ts against a real SMTP conversation on
 * localhost, rather than mocking nodemailer. Added when nodemailer crossed
 * 8.x -> 10.x: the API surface used here is small, but nothing else in the
 * suite covers an actual send, so an upgrade could break delivery silently.
 *
 * Asserts the parts a transport regression would break: authentication, the
 * envelope, and a MIME body carrying both alternatives plus the inline image
 * that convertDataUrisToCid() produces.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import net from 'node:net'

type Captured = {
  ehlo: string | null
  authCommands: string[]
  mailFrom: string | null
  rcptTo: string[]
  data: string
}

const captured: Captured = { ehlo: null, authCommands: [], mailFrom: null, rcptTo: [], data: '' }
let server: net.Server
let port = 0

/** Smallest valid PNG, so the data-URI -> cid path has something real to carry. */
const TINY_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII='

beforeAll(async () => {
  server = net.createServer((sock) => {
    let buf = ''
    let inData = false
    let authStep = 0
    const reply = (s: string) => sock.write(s + '\r\n')
    reply('220 localhost ESMTP test-sink')

    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8')
      for (;;) {
        if (inData) {
          const end = buf.indexOf('\r\n.\r\n')
          if (end === -1) return
          captured.data += buf.slice(0, end)
          buf = buf.slice(end + 5)
          inData = false
          reply('250 2.0.0 Ok: queued as TESTQUEUEID')
          continue
        }
        const nl = buf.indexOf('\r\n')
        if (nl === -1) return
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 2)
        const up = line.toUpperCase()

        if (up.startsWith('EHLO') || up.startsWith('HELO')) {
          captured.ehlo = line
          reply('250-localhost greets you')
          reply('250-AUTH PLAIN LOGIN')
          reply('250-8BITMIME')
          reply('250 SMTPUTF8')
        } else if (up.startsWith('AUTH PLAIN')) {
          captured.authCommands.push('AUTH PLAIN')
          reply('235 2.7.0 Authentication successful')
        } else if (up.startsWith('AUTH LOGIN')) {
          captured.authCommands.push('AUTH LOGIN')
          authStep = 1
          reply('334 VXNlcm5hbWU6')
        } else if (authStep === 1) {
          authStep = 2
          reply('334 UGFzc3dvcmQ6')
        } else if (authStep === 2) {
          authStep = 0
          reply('235 2.7.0 Authentication successful')
        } else if (up.startsWith('MAIL FROM')) {
          captured.mailFrom = line
          reply('250 2.1.0 Ok')
        } else if (up.startsWith('RCPT TO')) {
          captured.rcptTo.push(line)
          reply('250 2.1.5 Ok')
        } else if (up === 'DATA') {
          inData = true
          reply('354 End data with <CR><LF>.<CR><LF>')
        } else if (up === 'QUIT') {
          reply('221 2.0.0 Bye')
          sock.end()
        } else {
          reply('250 2.0.0 Ok')
        }
      }
    })
    sock.on('error', () => {})
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as net.AddressInfo).port
      resolve()
    })
  })

  process.env.SMTP_HOST = '127.0.0.1'
  process.env.SMTP_PORT = String(port)
  process.env.SMTP_SECURE = 'false'
  process.env.SMTP_USERNAME = 'qa-user'
  process.env.SMTP_PASSWORD = 'qa-pass'
  process.env.SMTP_FROM_EMAIL = 'noreply@campos.test'
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('sendEmail over SMTP', () => {
  it('authenticates, sends the envelope, and builds a MIME body with the inline image', async () => {
    // Imported after the SMTP env is in place; getTransporter() reads it on first use.
    const { sendEmail, getFrom } = await import('@/lib/email/emailit')

    const result = await sendEmail({
      to: ['guest@example.com', 'ops@example.com'],
      subject: 'Reservation confirmed',
      html: `<p>Reservation confirmed.</p><img src="${TINY_PNG_DATA_URI}" alt="logo" />`,
      text: 'Reservation confirmed.',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.id).toMatch(/\S/)
      expect(result.attempts).toBe(1)
    }

    expect(getFrom()).toBe('CampOS <noreply@campos.test>')

    // Authentication happened
    expect(captured.authCommands.length).toBeGreaterThan(0)

    // Envelope
    expect(captured.mailFrom).toContain('noreply@campos.test')
    expect(captured.rcptTo).toHaveLength(2)
    expect(captured.rcptTo.join(' ')).toContain('guest@example.com')
    expect(captured.rcptTo.join(' ')).toContain('ops@example.com')

    // Message
    expect(captured.data).toMatch(/^Subject: Reservation confirmed/mi)
    expect(captured.data).toMatch(/^From: CampOS <noreply@campos\.test>/mi)
    expect(captured.data).toMatch(/^Message-ID: </mi)
    expect(captured.data).toMatch(/Content-Type: multipart\//i)
    expect(captured.data).toMatch(/Content-Type: text\/plain/i)
    expect(captured.data).toMatch(/Content-Type: text\/html/i)

    // The data URI was rewritten to a cid: reference and attached as an image
    expect(captured.data).toMatch(/Content-Type: image\/png/i)
    expect(captured.data).toMatch(/cid:/i)
    expect(captured.data).not.toContain('data:image/png;base64')
  })
})
