-- Migration: Create default_email_templates + default_automations tables, seed them,
--             backfill existing companies/properties, and add version tracking.
-- Description: Global (company-agnostic) default email templates and automations.
--              Runtime seed-defaults.ts reads from these tables to provision
--              per-company / per-property rows. Also backfills existing data.
-- Created: 2026-04-29

BEGIN;

-- ============================================================================
-- A. Create default_email_templates table (global master)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.default_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  subject_template TEXT,
  html_template TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.default_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read default email templates" ON public.default_email_templates
  FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- B. Create default_automations table (global master)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.default_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  phase TEXT NOT NULL DEFAULT 'COMMUNICATE',
  scope TEXT DEFAULT 'property',
  trigger_type TEXT NOT NULL UNIQUE,
  trigger_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  actions JSONB DEFAULT '[]',
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.default_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read default automations" ON public.default_automations
  FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- C. Add tracking columns to existing tables
-- ============================================================================

ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS is_modified BOOLEAN DEFAULT false;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS default_version INTEGER;

ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS is_modified BOOLEAN DEFAULT false;
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS default_version INTEGER;

-- ============================================================================
-- D. Seed default_email_templates — all 10 templates (idempotent upsert)
-- ============================================================================

INSERT INTO public.default_email_templates (slug, name, description, subject_template, html_template, category) VALUES

  -- welcome_email
  ('welcome_email', 'Welcome Email', 'Sent when a reservation is confirmed',
   'Booking Confirmed — {{reservation.confirmation_number}} at {{property.name}}',
   '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background-color:#f6f9fc;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f6f9fc!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style></head><body bgcolor="#f6f9fc" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f9fc" style="width:100%;min-height:100%;background-color:#f6f9fc;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f6f9fc" style="width:100%;padding:20px 0;background-color:#f6f9fc;vertical-align:top;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;"><tr><td style="padding:20px 0 48px;"><h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;padding:0 40px;">Booking Confirmation</h1><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Dear {{guest.name}},</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Your reservation at {{property.name}} has been confirmed! We look forward to hosting you.</p><div style="padding:24px 40px;background-color:#f9fafb;margin-top:24px;"><h2 style="color:#333;font-size:18px;font-weight:bold;margin:20px 0 10px;">Reservation Details</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Confirmation Number:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;"><strong>{{reservation.confirmation_number}}</strong></td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Site:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{site.site_name}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Check-in:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{reservation.check_in_date}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Check-out:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{reservation.check_out_date}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Nights:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{reservation.num_nights}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Guests:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{reservation.num_adults}} Adults{{reservation.num_children}} Children</td></tr></table></div><div style="padding:24px 40px;background-color:#f9fafb;margin-top:16px;"><h2 style="color:#333;font-size:18px;font-weight:bold;margin:20px 0 10px;">Payment Information</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Total Amount:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;"><strong>{{reservation.formatted_total}}</strong></td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Amount Paid:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{payment.formatted_amount}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Balance Due:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;"><strong>{{reservation.balance_due}}</strong></td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Payment Status:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;"><span style="background-color:#10b981;color:#ffffff;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold;">{{payment.payment_status}}</span></td></tr></table><p style="color:#666;font-size:14px;font-style:italic;margin-top:16px;">Please settle the remaining balance upon arrival or as arranged with the property.</p></div><div style="padding:24px 40px;background-color:#f9fafb;margin-top:16px;"><h2 style="color:#333;font-size:18px;font-weight:bold;margin:20px 0 10px;">Arrival &amp; Check-In Information</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Check-in Time:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">After {{property.check_in_time}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Check-out Time:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">Before {{property.check_out_time}}</td></tr></table><hr style="border-color:#e6ebf1;margin:20px 0;"/><p style="color:#666;font-size:14px;font-weight:bold;margin-bottom:8px;">Property Contact:</p><table style="width:100%;border-collapse:collapse;"><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Phone:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{property.phone}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Email:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{property.email}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Address:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{property.address}}</td></tr></table></div><hr style="border-color:#e6ebf1;margin:20px 40px;"/><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">If you have any questions or need to modify your reservation, please contact {{property.name}} directly.</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">Thank you for choosing {{property.name}}. We can''t wait to welcome you!</p></td></tr></table></td></tr></table></body></html>',
   'welcome'),

  -- cancellation_notice
  ('cancellation_notice', 'Cancellation Notice', 'Sent when a reservation is cancelled',
   'Reservation Cancelled — {{reservation.confirmation_number}}',
   '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background-color:#f6f9fc;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f6f9fc!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style></head><body bgcolor="#f6f9fc" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f9fc" style="width:100%;min-height:100%;background-color:#f6f9fc;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f6f9fc" style="width:100%;padding:20px 0;background-color:#f6f9fc;vertical-align:top;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;"><tr><td style="padding:20px 0 48px;"><h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;padding:0 40px;">Reservation Cancelled</h1><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Dear {{guest.name}},</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Your reservation at {{property.name}} has been cancelled as requested.</p><div style="padding:24px 40px;background-color:#f9fafb;margin-top:24px;"><h2 style="color:#333;font-size:18px;font-weight:bold;margin:20px 0 10px;">Cancellation Details</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Confirmation Number:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;"><strong>{{reservation.confirmation_number}}</strong></td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Site:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{site.site_name}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Original Check-in:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{reservation.check_in_date}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Original Check-out:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{reservation.check_out_date}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Nights:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{reservation.num_nights}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Cancelled On:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{reservation.cancellation_date}}</td></tr></table></div><hr style="border-color:#e6ebf1;margin:20px 40px;"/><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">We''re sorry to see your plans change. If you''d like to rebook in the future, we''d be happy to welcome you to {{property.name}}.</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">If you have any questions, please contact us at {{property.phone}} or {{property.email}}.</p></td></tr></table></td></tr></table></body></html>',
   'notification'),

  -- check_in_reminder
  ('check_in_reminder', 'Check-in Reminder', 'Sent on check-in day',
   'Check-in Reminder — {{property.name}}',
   '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background-color:#f6f9fc;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f6f9fc!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style></head><body bgcolor="#f6f9fc" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f9fc" style="width:100%;min-height:100%;background-color:#f6f9fc;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f6f9fc" style="width:100%;padding:20px 0;background-color:#f6f9fc;vertical-align:top;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;"><tr><td style="padding:20px 0 48px;"><h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;padding:0 40px;">Check-in Today!</h1><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Hi {{guest.first_name}},</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">This is a reminder that your check-in is today at <strong>{{property.check_in_time}}</strong>.</p><div style="padding:24px 40px;background-color:#f9fafb;margin-top:24px;"><h2 style="color:#333;font-size:18px;font-weight:bold;margin:20px 0 10px;">Reservation Details</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Confirmation #:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;"><strong>{{reservation.confirmation_number}}</strong></td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Site:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{site.site_number}} - {{site.site_name}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Check-in:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{reservation.check_in_date}} at {{property.check_in_time}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Check-out:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{reservation.check_out_date}} by {{property.check_out_time}}</td></tr></table></div><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">{{property.address}}</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">Questions? Call us at {{property.phone}}.</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">See you soon!<br/>The {{property.name}} Team</p></td></tr></table></td></tr></table></body></html>',
   'reservation'),

  -- thank_you_email
  ('thank_you_email', 'Thank You Email', 'Sent after checkout',
   'Thank You for Staying with Us!',
   '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background-color:#f6f9fc;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f6f9fc!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style></head><body bgcolor="#f6f9fc" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f9fc" style="width:100%;min-height:100%;background-color:#f6f9fc;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f6f9fc" style="width:100%;padding:20px 0;background-color:#f6f9fc;vertical-align:top;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;"><tr><td style="padding:20px 0 48px;"><h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;padding:0 40px;">Thank You!</h1><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Dear {{guest.first_name}},</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">We hope you enjoyed your stay at {{property.name}}.</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">You stayed {{reservation.num_nights}} night(s) at {{site.site_number}} - {{site.site_name}} ({{reservation.check_in_date}} to {{reservation.check_out_date}}).</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">We''d love to hear about your experience. If you have a moment, please consider leaving us a review!</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">Have a great day!<br/>The {{property.name}} Team</p></td></tr></table></td></tr></table></body></html>',
   'review'),

  -- review_request
  ('review_request', 'Review Request', 'Sent after checkout to request a review',
   'How Was Your Stay at {{property.name}}?',
   '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background-color:#f6f9fc;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f6f9fc!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style></head><body bgcolor="#f6f9fc" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f9fc" style="width:100%;min-height:100%;background-color:#f6f9fc;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f6f9fc" style="width:100%;padding:20px 0;background-color:#f6f9fc;vertical-align:top;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;"><tr><td style="padding:20px 0 48px;"><h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;padding:0 40px;">How Was Your Stay?</h1><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Hi {{guest.first_name}},</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">You recently stayed with us at {{property.name}} ({{reservation.check_in_date}} to {{reservation.check_out_date}}).</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">We strive to provide the best experience for our guests. Would you mind taking a moment to share your feedback?</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">Your review helps other campers and helps us improve.</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">Thank you for choosing {{property.name}}!</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">Warm regards,<br/>The {{property.name}} Team</p></td></tr></table></td></tr></table></body></html>',
   'review'),

  -- payment_receipt
  ('payment_receipt', 'Payment Receipt', 'Sent when a payment is received',
   'Payment Confirmation — {{reservation.confirmation_number}}',
   '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background-color:#f6f9fc;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f6f9fc!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style></head><body bgcolor="#f6f9fc" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f9fc" style="width:100%;min-height:100%;background-color:#f6f9fc;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f6f9fc" style="width:100%;padding:20px 0;background-color:#f6f9fc;vertical-align:top;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;"><tr><td style="padding:20px 0 48px;"><h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;padding:0 40px;">Payment Confirmation</h1><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Hi {{guest.first_name}},</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">We''ve received your payment for reservation <strong>{{reservation.confirmation_number}}</strong>.</p><div style="padding:24px 40px;background-color:#f9fafb;margin-top:24px;"><h2 style="color:#333;font-size:18px;font-weight:bold;margin:20px 0 10px;">Payment Details</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Amount:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;"><strong>{{payment.formatted_amount}}</strong></td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Method:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{payment.payment_method}}</td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Status:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;"><span style="background-color:#10b981;color:#ffffff;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold;">{{payment.payment_status}}</span></td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Processed:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{payment.processed_at}}</td></tr></table></div><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">Reservation total: {{reservation.formatted_total}}</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">Thank you!<br/>The {{property.name}} Team</p></td></tr></table></td></tr></table></body></html>',
   'payment'),

  -- payment_failed
  ('payment_failed', 'Payment Failed', 'Sent when a payment attempt fails',
   'Payment Issue — {{reservation.confirmation_number}}',
   '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background-color:#f6f9fc;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f6f9fc!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style></head><body bgcolor="#f6f9fc" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f9fc" style="width:100%;min-height:100%;background-color:#f6f9fc;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f6f9fc" style="width:100%;padding:20px 0;background-color:#f6f9fc;vertical-align:top;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;"><tr><td style="padding:20px 0 48px;"><h1 style="color:#c0392b;font-size:24px;font-weight:bold;margin:40px 0;padding:0 40px;">Payment Issue</h1><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Hi {{guest.first_name}},</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">We were unable to process your payment for reservation <strong>{{reservation.confirmation_number}}</strong>.</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Please update your payment method and try again, or contact us at {{property.phone}} for assistance.</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">Your reservation is still pending until payment is received.</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">Thank you for your patience.<br/>The {{property.name}} Team</p></td></tr></table></td></tr></table></body></html>',
   'payment'),

  -- pre_arrival
  ('pre_arrival', 'Pre-Arrival Email', 'Sent 2 days before check-in',
   'Getting Ready for Your Visit!',
   '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background-color:#f6f9fc;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f6f9fc!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style></head><body bgcolor="#f6f9fc" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f9fc" style="width:100%;min-height:100%;background-color:#f6f9fc;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f6f9fc" style="width:100%;padding:20px 0;background-color:#f6f9fc;vertical-align:top;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;"><tr><td style="padding:20px 0 48px;"><h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;padding:0 40px;">Getting Ready for Your Visit!</h1><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Hi {{guest.first_name}},</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Your stay at {{property.name}} is coming up on <strong>{{reservation.check_in_date}}</strong>!</p><div style="padding:24px 40px;background-color:#f9fafb;margin-top:24px;"><h2 style="color:#333;font-size:18px;font-weight:bold;margin:20px 0 10px;">Before You Arrive</h2><ul style="color:#333;font-size:14px;line-height:28px;padding-left:20px;"><li>Check-in time: <strong>{{property.check_in_time}}</strong></li><li>Check-out time: <strong>{{property.check_out_time}}</strong></li><li>Your site: <strong>{{site.site_number}} - {{site.site_name}}</strong></li></ul></div><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">{{property.address}}</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">If you need to make any changes, please contact us at {{property.email}} or {{property.phone}}.</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">See you soon!<br/>The {{property.name}} Team</p></td></tr></table></td></tr></table></body></html>',
   'reservation'),

  -- refund_issued
  ('refund_issued', 'Refund Issued', 'Sent when a refund has been processed',
   'Refund Issued — {{reservation.confirmation_number}} at {{property.name}}',
   '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background-color:#f6f9fc;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f6f9fc!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style></head><body bgcolor="#f6f9fc" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f9fc" style="width:100%;min-height:100%;background-color:#f6f9fc;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f6f9fc" style="width:100%;padding:20px 0;background-color:#f6f9fc;vertical-align:top;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;"><tr><td style="padding:20px 0 48px;"><h1 style="color:#333;font-size:24px;font-weight:bold;margin:40px 0;padding:0 40px;">Refund Issued</h1><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Dear {{guest.name}},</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">A refund has been issued for your cancelled reservation at {{property.name}}.</p><div style="padding:24px 40px;background-color:#ecfdf5;margin-top:24px;"><h2 style="color:#333;font-size:18px;font-weight:bold;margin:20px 0 10px;">Refund Details</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Confirmation Number:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;"><strong>{{reservation.confirmation_number}}</strong></td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Refund Amount:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;"><strong>{{payment.formatted_amount}}</strong></td></tr><tr><td style="color:#666;font-size:14px;padding:8px 0;vertical-align:top;width:40%;">Refund Method:</td><td style="color:#333;font-size:14px;padding:8px 0;vertical-align:top;">{{payment.payment_method}}</td></tr></table><p style="color:#666;font-size:14px;font-style:italic;margin-top:16px;">The refund has been processed and should appear in your account within 5-10 business days, depending on your financial institution.</p></div><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">If you have any questions about this refund, please contact {{property.name}} directly.</p></td></tr></table></td></tr></table></body></html>',
   'payment'),

  -- lead_time_rejection
  ('lead_time_rejection', 'Lead Time Rejection', 'Sent when a reservation is blocked due to minimum lead time',
   'Reservation Cannot Be Processed',
   '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background-color:#f6f9fc;"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style type="text/css">html,body{width:100%!important;margin:0!important;padding:0!important;min-height:100%!important;background-color:#f6f9fc!important;}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style></head><body bgcolor="#f6f9fc" style="margin:0;padding:0;width:100%!important;min-height:100%;height:100%;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Ubuntu,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f9fc" style="width:100%;min-height:100%;background-color:#f6f9fc;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="top" bgcolor="#f6f9fc" style="width:100%;padding:20px 0;background-color:#f6f9fc;vertical-align:top;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;"><tr><td style="padding:20px 0 48px;"><h1 style="color:#c0392b;font-size:24px;font-weight:bold;margin:40px 0;padding:0 40px;">Reservation Cannot Be Processed</h1><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">Hi {{guest.first_name}},</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">We''re sorry, but we were unable to process your reservation at {{property.name}}.</p><p style="color:#333;font-size:16px;line-height:26px;padding:0 40px;">This reservation requires advance notice that was not met. Please try booking with a later check-in date.</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">If you believe this is an error, please contact us at {{property.phone}} or {{property.email}}.</p><p style="color:#666;font-size:14px;line-height:24px;padding:0 40px;margin-top:16px;">We apologize for the inconvenience.<br/>The {{property.name}} Team</p></td></tr></table></td></tr></table></body></html>',
   'notification')

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  category = EXCLUDED.category,
  version = default_email_templates.version + 1,
  updated_at = now();

-- ============================================================================
-- E. Seed default_automations — all 8 (idempotent upsert on trigger_type)
-- ============================================================================

INSERT INTO public.default_automations (name, description, phase, scope, trigger_type, sort_order, actions) VALUES
  ('Booking Confirmation Email', 'Sends a booking confirmation email when a reservation is confirmed', 'COMMUNICATE', 'property', 'reservation.confirmed', 0,
   '[{"action_type":"send_email","action_config":{"template":"welcome_email"},"sort_order":0}]'::jsonb),
  ('Cancellation Notice', 'Sends a cancellation notice when a reservation is cancelled', 'COMMUNICATE', 'property', 'reservation.cancelled', 1,
   '[{"action_type":"send_email","action_config":{"template":"cancellation_notice"},"sort_order":0}]'::jsonb),
  ('Check-In Reminder', 'Sends a check-in reminder for reservations checking in today', 'COMMUNICATE', 'property', 'system.check_in_reminder', 2,
   '[{"action_type":"send_email","action_config":{"template":"check_in_reminder"},"sort_order":0}]'::jsonb),
  ('Thank You Email', 'Sends a thank you email after guest check-out', 'COMMUNICATE', 'property', 'reservation.checked_out', 3,
   '[{"action_type":"send_email","action_config":{"template":"thank_you_email"},"sort_order":0}]'::jsonb),
  ('Payment Receipt', 'Sends a payment receipt when payment is received', 'COMMUNICATE', 'property', 'payment.received', 4,
   '[{"action_type":"send_email","action_config":{"template":"payment_receipt"},"sort_order":0}]'::jsonb),
  ('Refund Issued', 'Sends a refund issued email when a refund has been processed', 'COMMUNICATE', 'property', 'refund.processed', 5,
   '[{"action_type":"send_email","action_config":{"template":"refund_issued"},"sort_order":0}]'::jsonb),
  ('Check-Out Reminder', 'Sends a check-out reminder for reservations checking out today', 'COMMUNICATE', 'property', 'system.check_out_reminder', 7,
   '[{"action_type":"send_email","action_config":{"template":"thank_you_email"},"sort_order":0}]'::jsonb)
ON CONFLICT (trigger_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  actions = EXCLUDED.actions,
  version = default_automations.version + 1,
  updated_at = now();

-- ============================================================================
-- F. Backfill existing companies from default tables
-- ============================================================================

-- F.1. Backfill email templates for every existing company
INSERT INTO public.email_templates (
  company_id, property_id, slug, name, description,
  subject_template, html_template, category,
  is_system_default, is_active, is_modified, default_version
)
SELECT
  c.id,
  NULL,
  dt.slug,
  dt.name,
  dt.description,
  dt.subject_template,
  dt.html_template,
  dt.category,
  true,
  true,
  false,
  dt.version
FROM public.companies c
CROSS JOIN public.default_email_templates dt
WHERE dt.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.email_templates et
    WHERE et.company_id = c.id
      AND et.property_id IS NULL
      AND et.slug = dt.slug
  )
ON CONFLICT DO NOTHING;

-- F.2. Backfill automations + actions for properties with completed onboarding
WITH inserted_automations AS (
  INSERT INTO public.automations (
    id, company_id, property_id, name, description,
    phase, scope, is_active, trigger_type, trigger_config,
    sort_order, is_modified, default_version,
    created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    ep.company_id,
    ep.property_id,
    da.name,
    da.description,
    da.phase,
    COALESCE(da.scope, 'property'),
    da.is_active,
    da.trigger_type,
    da.trigger_config,
    da.sort_order,
    false,
    da.version,
    now(),
    now()
  FROM (
    SELECT p.id AS property_id, p.company_id
    FROM public.properties p
    WHERE p.onboarding_completed = true
  ) ep
  CROSS JOIN public.default_automations da
  WHERE da.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.automations a
      WHERE a.property_id = ep.property_id
        AND a.company_id = ep.company_id
        AND a.trigger_type = da.trigger_type
        AND a.phase = da.phase
    )
  ON CONFLICT DO NOTHING
  RETURNING id, company_id, property_id, trigger_type
)
INSERT INTO public.automation_actions (
  id, automation_id, action_type, action_config, sort_order, created_at
)
SELECT
  gen_random_uuid(),
  ia.id,
  act->>'action_type',
  COALESCE(act->'action_config', '{}'::jsonb),
  COALESCE((act->>'sort_order')::integer, 0),
  now()
FROM inserted_automations ia
JOIN public.default_automations da ON da.trigger_type = ia.trigger_type
CROSS JOIN LATERAL jsonb_array_elements(da.actions) AS act
ON CONFLICT DO NOTHING;

-- ============================================================================
-- G. Set version tracking on existing rows that lack it
-- ============================================================================

-- Mark existing system-default templates as unmodified with version 1
UPDATE public.email_templates
SET is_modified = false, default_version = 1
WHERE is_system_default = true
  AND is_modified IS NULL;

-- Mark existing automations as unmodified with version 1
UPDATE public.automations
SET is_modified = false, default_version = 1
WHERE is_modified IS NULL;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON public.default_email_templates TO service_role;
GRANT ALL ON public.default_automations TO service_role;
GRANT SELECT ON public.default_email_templates TO authenticated;
GRANT SELECT ON public.default_automations TO authenticated;

COMMIT;
