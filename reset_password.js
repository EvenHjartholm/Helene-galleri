// Reset admin and guest passwords for Helene Bildegalleri
// Run: node reset_password.js

import { createClient } from '@supabase/supabase-js';
import { webcrypto } from 'node:crypto';

const supabaseUrl = 'https://qipixzqlegsxgnvgsskt.supabase.co';
const supabaseAnonKey = 'sb_publishable_CRHzrnVjAm3W3nYJKzF9JQ_mnSDLYA5';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await webcrypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function main() {
  // New passwords - change these to whatever you want
  const newAdminPassword = 'admin123';
  const newGuestPassword = 'helene';

  console.log('🔐 Resetting passwords...');
  console.log(`   Admin password will be: "${newAdminPassword}"`);
  console.log(`   Guest password will be: "${newGuestPassword}"`);

  const adminHash = await hashPassword(newAdminPassword);
  const guestHash = await hashPassword(newGuestPassword);

  console.log(`   Admin hash: ${adminHash.substring(0, 16)}...`);
  console.log(`   Guest hash: ${guestHash.substring(0, 16)}...`);

  // First, check what's in the table
  const { data: existing, error: readError } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (readError) {
    console.error('❌ Could not read app_settings:', readError.message);
    return;
  }

  console.log('📋 Current settings row:', existing ? 'Found' : 'Not found');

  // Update the passwords
  const { data, error } = await supabase
    .from('app_settings')
    .update({ 
      admin_hash: adminHash, 
      guest_hash: guestHash 
    })
    .eq('id', 1)
    .select();

  if (error) {
    console.error('❌ Failed to update passwords:', error.message);
    console.log('\n💡 If you get a permissions error, you may need to run the RLS fix first.');
    console.log('   Go to Supabase SQL Editor and run the contents of fix_rls_warning.sql');
    return;
  }

  console.log('\n✅ Passwords updated successfully!');
  console.log(`   Log in as ADMIN with: ${newAdminPassword}`);
  console.log(`   Log in as GUEST with: ${newGuestPassword}`);
  console.log('\n   You can change these later from the Settings menu inside the gallery.');
}

main().catch(console.error);
