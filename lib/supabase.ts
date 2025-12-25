import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zopvyleainibrvpysdrf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHZ5bGVhaW5pYnJ2cHlzZHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0OTUxNjYsImV4cCI6MjA2NTA3MTE2Nn0.RjIIwUaSpJpCo6e7KkBplI8_-mQMa5sMY9e9FvbO30s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
