import {auth, collection, db, doc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch} from './firebase-init.js';
import {showMessageBox, showCustomConfirm} from './utils.js';

const userId = () => auth.currentUser?.uid;

export async function showBlockedUsers() {
    if (!userId()) return;
    try {
        const snap = await getDoc(doc(db, 'users', userId()));
        const blocked = snap.data()?.blockedUsers || [];

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Blocked Users</h2>
                <div class="blocked-users-list">
                    ${blocked.length ? blocked.map(u => `
                        <div class="blocked-user-item">
                            <span>${u.email || u.uid}</span>
                            <button class="btn-secondary" data-uid="${u.uid}">Unblock</button>
                        </div>
                    `).join('') : '<p>No blocked users</p>'}
                </div>
                <button class="btn-primary close-btn">Close</button>
            </div>
        `;
        modal.querySelector('.close-btn').onclick = () => modal.remove();
        modal.querySelectorAll('[data-uid]').forEach(btn => btn.onclick = () => unblockUser(btn.dataset.uid));
        document.body.appendChild(modal);
    } catch (e) {
        showMessageBox('Failed to load blocked users', true);
    }
}

export async function unblockUser(uid) {
    if (!userId()) return;
    try {
        const ref = doc(db, 'users', userId());
        const snap = await getDoc(ref);
        const blocked = (snap.data()?.blockedUsers || []).filter(u => u.uid !== uid);
        await updateDoc(ref, {blockedUsers: blocked});
        showMessageBox('User unblocked');
    } catch (e) {
        showMessageBox('Failed to unblock user', true);
    }
}

export async function exportUserData() {
    if (!userId()) return;
    try {
        const [user, settings, profile, prefs] = await Promise.all([
            getDoc(doc(db, 'users', userId())),
            getDoc(doc(db, 'userSettings', userId())),
            getDoc(doc(db, 'userProfiles', userId())),
            getDoc(doc(db, 'userPreferences', userId()))
        ]);

        const data = {
            profile: user.data(), settings: settings.data(),
            preferences: prefs.data(), exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), {
            href: url, download: `arcator-export-${new Date().toISOString().split('T')[0]}.json`
        });
        a.click();
        URL.revokeObjectURL(url);
        showMessageBox('Data exported');
    } catch (e) {
        showMessageBox('Failed to export data', true);
    }
}

export async function deactivateAccount() {
    if (!userId()) return;
    if (!await showCustomConfirm('Deactivate account?', 'Your profile and content will be hidden.')) return;
    try {
        await updateDoc(doc(db, 'users', userId()), {isDeactivated: true, deactivatedAt: new Date().toISOString()});
        showMessageBox('Account deactivated');
    } catch (e) {
        showMessageBox('Failed to deactivate', true);
    }
}

export async function deleteAccount() {
    if (!userId()) return;
    if (!await showCustomConfirm('Delete account?', 'This is permanent and cannot be undone.')) return;

    const user = auth.currentUser;
    if (!user.emailVerified) {
        await user.sendEmailVerification();
        return showMessageBox('Verify your email first. Email sent.');
    }

    try {
        const batch = writeBatch(db);
        ['users', 'userSettings', 'userProfiles', 'userPreferences'].forEach(c => batch.delete(doc(db, c, userId())));
        await batch.commit();
        await user.delete();
        showMessageBox('Account deleted');
    } catch (e) {
        showMessageBox('Failed to delete account', true);
    }
}