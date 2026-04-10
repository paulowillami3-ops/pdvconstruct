import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Role = 'owner' | 'employee' | 'cashier' | 'driver';

export interface Profile {
  id: string;
  tenant_id: string;
  role: Role;
  full_name: string;
  username: string;
}

export interface Tenant {
  id: string;
  name: string;
}
