-- Final Fix for RLS Infinite Recursion using SECURITY DEFINER Functions
-- NOTE: This migration is SUPERSEDED by 20251029140003_fix_rls_public_schema.sql
-- which uses public schema instead of auth schema (auth schema not writable on Supabase)
--
-- This file is intentionally empty - the next migration handles everything.
-- Keeping this file to maintain migration history and avoid renumbering.

SELECT 1; -- No-op to make migration valid
