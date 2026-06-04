# AWS SES Email + SNS SMS Setup and Sandbox Limitations

**Status:** Verified working in sandbox mode (2026-06-04)
**AWS account:** 479279106824 · **IAM user:** `VyteTeam` · **Region:** `eu-west-1`
**Test scripts:** `/apps/campos/aws` (Node project; credentials in local `.env`, not committed)

CampOS can send email via AWS SES and SMS via AWS SNS. Both channels are verified end-to-end but remain in **sandbox mode**, which restricts who we can send to and how much. This document records the current setup, the sandbox limits the team must design around, and the steps required to go to production.

> Note: booking confirmation emails currently use **Resend** (see `docs/RESEND_SETUP.md`). AWS SES/SNS is a separate, verified channel — primarily relevant for SMS and any future AWS-native messaging.

## Email — AWS SES ✅ working (sandbox)

| Item | State |
|---|---|
| Sending enabled | Yes |
| Mode | **Sandbox** — production access NOT granted |
| Quota | 200 emails / 24 h, max 1 message/second |
| Verified identities | `me@jnbruno.com` (single email identity) |
| Verified test send | 2026-06-04, MessageId `0102019e9088e8b0-730c8f9e-f6e8-4990-b2f8-1669baf322a1-000000` |

### Sandbox restrictions (email)

- **Recipients must also be verified identities.** You cannot email arbitrary addresses until production access is granted.
- 200 emails per 24 hours, 1 msg/s send rate.

### Gotcha: identity verification links expire

SES identity verification links expire after **24 hours**. If the link wasn't clicked in time, the identity stays stuck in "pending" — delete the identity and recreate it to trigger a fresh verification email. `verify-identity.js` handles status checks.

## SMS — AWS SNS ✅ working (sandbox)

| Item | State |
|---|---|
| Service subscription | Activated 2026-06-04 (previously failed with `SubscriptionRequiredException`; resolved by the account owner in the console — payment/activation issue) |
| Mode | **SMS sandbox** |
| Spend cap | USD 1.00 / month |
| Verified destinations | +639174740855 (PH) |
| Verified test send | 2026-06-04, MessageId `fe8fe645-a024-5133-9876-84ded51dd8c6` |

### Sandbox restrictions (SMS)

- **Destination numbers must be verified first** (OTP flow — see `verify-sms-number.js`).
- Monthly spend is capped at USD 1.00 until an increase is approved.

### IAM note

`VyteTeam` has SNS permissions but **no `sms-voice:*`** — the newer AWS End User Messaging API is denied (`AccessDenied`). SMS sends therefore go through the classic SNS publish path. `check-sms.js` is kept ready for when IAM is widened.

## Test scripts (`/apps/campos/aws`)

| Script | Purpose |
|---|---|
| `test-aws.js` | STS credential check |
| `check-ses-sns.js` | SES account/identities + SNS SMS status |
| `check-sms.js` | End User Messaging (sms-voice) status — currently AccessDenied, kept for when IAM is widened |
| `verify-identity.js <email>` | SES identity create/check |
| `send-test-email.js <from> [to]` | SES send test |
| `verify-sms-number.js <phone> [otp]` | SMS sandbox destination verification (OTP flow) |
| `send-test-sms.js <phone> [message]` | SNS SMS send test (Transactional type) |

Credentials are read from a local `.env` in that directory — never commit it.

## App integration (CC01-13)

CampOS is wired to both channels through the existing communication system:

### Email — via the SES SMTP interface (config-only)

The app sends all email through SMTP (`src/lib/email/emailit.ts`), so SES needs no code change. Set the `SMTP_*` env vars to SES SMTP values (see `.env.example`): host `email-smtp.eu-west-1.amazonaws.com`, port 587, username/password = **SES SMTP credentials** (generated in the SES console — distinct from IAM access keys), from = a verified identity.

**Rollout decision (2026-06-04):** dev/staging point at SES SMTP now; **production keeps its current SMTP provider** until SES production access is granted — otherwise live guest emails to unverified addresses would fail.

### SMS — via AWS SNS

- **Provider:** `src/lib/messaging/providers/sms.ts` — `sendSMS(to, body)` publishes through SNS (`Transactional` type, E.164 normalisation, 4-attempt retry). It never throws; all failures return `{ success: false, error }`. Env: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (server-side only).
- **Reach:** this one provider powers the Guest Communication SMS inbox direct sends (`POST /api/v1/guests/[id]/messages`), SMS/both campaigns (`src/lib/messaging/send.ts`), and the automation action below. Deliveries are logged to `communication_log`.
- **Automation action:** `send_sms` (`src/lib/automations/action-registry.ts`) — config takes `template` (an `sms_templates` slug, what the automations UI writes) or an inline `message` string; merge fields like `{{guest.first_name}}` are rendered. Recipient is the **guest only** (staff SMS needs staff-phone context — not available yet). The action checks `communication_opt_outs` (channel `sms`) and writes `communication_log` rows (`sent` → `delivered`/`failed`, or `skipped` on opt-out).

### Known follow-ups

- SMS inbox thread history calls `GET /api/v1/guests/[id]/messages`, but the route only implements POST — history display needs a GET handler (separate task).
- Inbound STOP: SNS honours carrier STOP automatically; mirroring it into `communication_opt_outs` (`source: 'sms_stop'`) needs an inbound webhook (separate task).

## Going to production (not yet done)

1. **SES production access** — submit the one-off production access request in the SES console. At the same time, verify a sending **domain** with DKIM instead of individual email addresses.
2. **SNS SMS sandbox exit** — open a support case to exit the SMS sandbox and request a spend-limit increase. Choose an origination identity per destination country:
   - **PH:** registered alphanumeric sender ID recommended for deliverability.
   - **US:** would require a 10DLC or toll-free number.
3. **Optional IAM widening** — grant `sms-voice:*` to `VyteTeam` to enable the newer End User Messaging API (then `check-sms.js` becomes usable).

## What this means for feature work

- Any feature sending email via SES today can only reach **verified addresses** and ≤200/day.
- Any feature sending SMS can only reach **verified phone numbers** and ≤USD 1.00/month of traffic.
- Do not build user-facing flows that assume unrestricted sending until the production steps above are completed.
