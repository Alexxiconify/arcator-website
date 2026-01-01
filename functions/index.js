import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

initializeApp();
const auth = getAuth();
const db = getFirestore();

const SUPER_ADMIN = 'CEch8cXWemSDQnM3dHVKPt0RGpn2';

// Set admin claim when user is added to whitelisted_admins
export const onAdminAdded = onDocumentCreated('artifacts/arcator-web/public/data/whitelisted_admins/{uid}', async (event) => {
    const uid = event.params.uid;
    await auth.setCustomUserClaims(uid, { admin: true });
    console.log(`Admin claim set for ${uid}`);
});

// Remove admin claim when user is removed from whitelisted_admins
export const onAdminRemoved = onDocumentDeleted('artifacts/arcator-web/public/data/whitelisted_admins/{uid}', async (event) => {
    const uid = event.params.uid;
    const claims = (await auth.getUser(uid)).customClaims || {};
    delete claims.admin;
    await auth.setCustomUserClaims(uid, claims);
    console.log(`Admin claim removed for ${uid}`);
});

// Callable function for super admin to grant/revoke admin status
export const setAdminClaim = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');
    
    const callerClaims = request.auth.token;
    if (request.auth.uid !== SUPER_ADMIN && !callerClaims.admin) {
        throw new HttpsError('permission-denied', 'Only admins can modify admin status');
    }
    
    const { uid, isAdmin } = request.data;
    if (!uid) throw new HttpsError('invalid-argument', 'uid required');
    
    await auth.setCustomUserClaims(uid, { admin: !!isAdmin });
    
    // Sync with whitelisted_admins collection
    const adminRef = db.doc(`artifacts/arcator-web/public/data/whitelisted_admins/${uid}`);
    if (isAdmin) {
        await adminRef.set({ grantedAt: FieldValue.serverTimestamp(), grantedBy: request.auth.uid });
    } else {
        await adminRef.delete();
    }
    
    return { success: true };
});

// Phase 3: Server-side censorship wipe
export const onContentCensored = onDocumentUpdated('artifacts/arcator-web/public/data/forms/{docId}', async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    
    // Only act if censored was just set to true
    if (!before.censored && after.censored) {
        await event.data.after.ref.update({
            description: '[REDACTED]',
            title: after.title ? `[CENSORED] ${after.title}` : '[CENSORED]'
        });
        console.log(`Content censored for ${event.params.docId}`);
    }
});

// Callable: send Discord notification to a linked user
export const sendDiscordNotification = onCall(async (request) => {
  // Auth check
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');
  const { uid, message } = request.data;
  if (!uid || !message) throw new HttpsError('invalid-argument', 'uid and message required');

  // Get user's Discord ID from profile
  const profileSnap = await db.doc(`user_profiles/${uid}`).get();
  const profile = profileSnap.data();
  if (!profile?.discordId) throw new HttpsError('failed-precondition', 'User has no linked Discord ID');

  const discordId = profile.discordId;
  // Read token from Firestore secrets
  const secretSnap = await db.doc('secrets/discord').get();
  const botToken = secretSnap.data()?.bot_token;
  if (!botToken) throw new HttpsError('failed-precondition', 'Discord bot token not configured');

  // Create DM channel
  const channelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_id: discordId })
  });
  if (!channelRes.ok) throw new HttpsError('internal', 'Failed to create DM channel');
  const { id: channelId } = await channelRes.json();

  // Send message
  const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message })
  });
  if (!msgRes.ok) throw new HttpsError('internal', 'Failed to send Discord message');

  return { success: true };
});
