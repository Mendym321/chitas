// Feedback and mistake reports: what's checked and kept, and the email about it.
// Pure apart from sendEmail (which only calls fetch), so tools/test-api.mjs checks it.

const MAX = 4000;
const clean = (s, n) => String(s ?? '').replace(/\r/g, '').trim().slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// What someone sent → what's kept, or { error }. Only what they wrote, an
// optional email to answer, and (for a mistake) what they were reading.
export function cleanFeedback(body) {
  const message = clean(body?.message, MAX);
  if (message.length < 3) return { error: 'Please write a few words.' };
  const email = clean(body?.email, 200);
  if (email && !EMAIL.test(email)) return { error: 'That email doesn\'t look right.' };
  const kind = body?.kind === 'mistake' ? 'mistake' : 'feedback';
  const c = body?.context || {};
  const context = kind === 'mistake' ? {
    reading: clean(c.reading, 200),          // "Tanya · Likkutei Amarim · Chapter 41"
    day: /^\d{4}-\d{2}-\d{2}$/.test(c.day || '') ? c.day : '',
    where: clean(c.where, 300),              // the passage on the screen, its first words
  } : {};
  return { kind, message, email, context, app: clean(body?.app, 40), device: clean(body?.device, 160) };
}

export function emailFor(f) {
  const subject = (f.kind === 'mistake' ? 'Mistake report: ' + (f.context.reading || 'a text') : 'Feedback') + ' · ' + f.message.slice(0, 50).replace(/\s+/g, ' ');
  const lines = [f.message, '', '—'];
  if (f.kind === 'mistake') lines.push('Reading: ' + (f.context.reading || '?') + (f.context.day ? ' (' + f.context.day + ')' : ''), f.context.where ? 'At: ' + f.context.where : '');
  lines.push(f.email ? 'Reply to: ' + f.email : 'No email left, so no reply possible.', 'App ' + (f.app || '?') + ' · ' + (f.device || '?'));
  return { subject, text: lines.filter(l => l !== '').join('\n') };
}

// Through Resend (https://resend.com), when RESEND_API_KEY is set on Vercel.
// Returns 'sent', 'skipped' (no key) or 'failed'; never throws (the message is
// already saved either way).
export async function sendEmail(f) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 'skipped';
  const { subject, text } = emailFor(f);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'Chitas <onboarding@resend.dev>', to: [process.env.FEEDBACK_TO || 'chitas.daily@gmail.com'],
        subject, text, ...(f.email ? { reply_to: f.email } : {}) }),
    });
    return r.ok ? 'sent' : 'failed';
  } catch { return 'failed'; }
}
