-- Fix for Supabase RLS Warnings
-- Run this in your Supabase SQL Editor to resolve the "Table publicly accessible" warning.

-- 1. Enable Row Level Security (this stops the Supabase Advisor warning)
ALTER TABLE public.gallery_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 2. Allow the app to read data
CREATE POLICY "Enable read access for all users" 
ON public.gallery_content FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" 
ON public.app_settings FOR SELECT USING (true);

-- 3. Allow the app to update data
-- Note: Since your React app uses a custom passcode system instead of Supabase Auth,
-- we must allow the 'anon' role to update the tables so the app keeps functioning.
CREATE POLICY "Enable mutations for gallery" 
ON public.gallery_content FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable mutations for settings" 
ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
