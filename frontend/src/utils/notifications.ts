import { createClient } from "@supabase/supabase-js";

// In a real app, these would be in .env.local
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;

export async function sendNotification(to: string, type: 'email' | 'sms', subject: string, body: string) {
  console.log(`[NOTIFICATION] Sending ${type} to ${to}: ${subject}`);
  
  // Placeholder for real Twilio/Resend calls
  // if (type === 'sms' && TWILIO_SID) { ... }
  // if (type === 'email' && RESEND_API_KEY) { ... }
  
  return true;
}

export async function updateApplicationStatus(id: number, status: string, interviewTime?: string, meetLink?: string) {
  // Update Supabase and trigger notifications
  const { data, error } = await (global as any).supabase
    .from('applications')
    .update({ 
      status, 
      interview_scheduled_at: interviewTime, 
      interview_meet_link: meetLink 
    })
    .eq('id', id);

  if (error) throw error;
  return data;
}
