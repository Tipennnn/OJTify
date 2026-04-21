import { Client, Users } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint('https://sgp.cloud.appwrite.io/v1')
    .setProject('69ba8d9c0027d10c447f')
    .setKey(process.env.APPWRITE_API_KEY);

  const users = new Users(client);

  // ── Parse body safely ────────────────────────────────────
  // Appwrite Functions can pass body as a string OR already-parsed object
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
};