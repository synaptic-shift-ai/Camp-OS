-- Allow message_campaigns.template_id to reference either email_templates or sms_templates.
-- Channel determines which table the UUID belongs to (no single FK can cover both).

ALTER TABLE public.message_campaigns
    DROP CONSTRAINT IF EXISTS message_campaigns_template_id_fkey;

COMMENT ON COLUMN public.message_campaigns.template_id IS
    'Source template UUID from email_templates (channel=email) or sms_templates (channel=sms).';
