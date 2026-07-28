import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vejvxpjswlmcsbfiqywp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlanZ4cGpzd2xtY3NiZmlxeXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MzI3NTMsImV4cCI6MjEwMDEwODc1M30.oliBQIW9k8TL_d5q73bza7tt-CSK34yY-prJrYTfcBI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
