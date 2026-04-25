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
    error('Failed to parse request body');
    return res.json({ success: false, message: 'Invalid JSON body' }, 400);
  }

  log('Received body: ' + JSON.stringify(body));

  const action = body?.action || 'delete-user';

  // ── ROUTE: Send OTP Email ─────────────────────────────────
  if (action === 'send-otp') {
    const { email, userName, otp, templateId } = body;

    if (!email || !otp) {
      return res.json({ success: false, message: 'email and otp are required' }, 400);
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
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

  // ── ROUTE: Delete Auth User ───────────────────────────────
  const userId = body?.userId;

  if (!userId) {
    error('userId is missing from body');
    return res.json({ success: false, message: 'userId is required' }, 400);
  }

  try {
    await users.delete(userId);
    log('Successfully deleted auth user: ' + userId);
    return res.json({ success: true, deletedUserId: userId });
  } catch (err) {
    error('Failed to delete user ' + userId + ': ' + err.message);
    return res.json({ success: false, message: err.message }, 500);
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

};