import { Client, Users } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint('https://sgp.cloud.appwrite.io/v1')
    .setProject('69ba8d9c0027d10c447f')
    .setKey(process.env.APPWRITE_API_KEY);

  const users = new Users(client);

  let body = {};
  try {
    body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body ?? {};
  } catch {
    return res.json({ success: false, message: 'Invalid JSON body' }, 400);
  }

  const action = body?.action;

  // ── ROUTE: Send OTP ───────────────────────────────────────
  if (action === 'send-otp') {
    const { email, userName, otp, templateId } = body;

    if (!email || !otp) {
      return res.json({ success: false, message: 'email and otp are required' }, 400);
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY
        },
        body: JSON.stringify({
          sender: { name: 'OJTify Admin', email: 'adminojtify@gmail.com' },
          to: [{ email, name: userName || 'Student' }],
          templateId: templateId,
          params: { user_name: userName || 'Student', otp_code: otp }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        error('Brevo error: ' + JSON.stringify(data));
        return res.json({ success: false, message: 'Failed to send email' }, 400);
      }

      log('OTP sent to ' + email);
      return res.json({ success: true });

    } catch (err) {
      error('Fetch error: ' + err.message);
      return res.json({ success: false, message: err.message }, 500);
    }
  }

  // ── ROUTE: Reset Password ─────────────────────────────────
  if (action === 'reset-password') {
    const { userId, password } = body;

    if (!userId || !password) {
      return res.json({ success: false, message: 'userId and password are required' }, 400);
    }

    try {
      await users.updatePassword(userId, password);
      log('Password reset for user: ' + userId);
      return res.json({ success: true });
    } catch (err) {
      error('Failed to reset password: ' + err.message);
      return res.json({ success: false, message: err.message }, 500);
    }
  }

  return res.json({ success: false, message: 'Unknown action' }, 400);

  // ── ROUTE: Send OTP for Admin (looks up admin from DB) ────
if (action === 'send-otp-admin') {
  const { email, templateId, databaseId, collectionId } = body;

  if (!email) {
    return res.json({ success: false, message: 'email is required' }, 400);
  }

  try {
    // Look up admin using server-side SDK
    const { Databases, Query } = await import('node-appwrite');
    const databases = new Databases(client);

    const res = await databases.listDocuments(
      databaseId,
      collectionId,
      [Query.equal('email', email), Query.limit(1)]
    );

    if (res.total === 0) {
      return res.json({ success: false, message: 'No admin account found with this email.' }, 404);
    }

    const adminDoc  = res.documents[0];
    const userId    = adminDoc.auth_user_id;
    const userName  = 'Admin';
    const otp       = Math.floor(100000 + Math.random() * 900000).toString();

    // Send email via Brevo
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: 'OJTify Admin', email: 'adminojtify@gmail.com' },
        to: [{ email, name: userName }],
        templateId: templateId,
        params: { user_name: userName, otp_code: otp }
      })
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      error('Brevo error: ' + JSON.stringify(emailData));
      return res.json({ success: false, message: 'Failed to send email' }, 400);
    }

    log('Admin OTP sent to ' + email);
    // Return otp and userId back to Angular so it can verify locally
    return res.json({ success: true, userId, userName, otp });

  } catch (err) {
    error('send-otp-admin error: ' + err.message);
    return res.json({ success: false, message: err.message }, 500);
  }
}
};