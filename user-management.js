import {auth, db} from './firebase-init.js';
import {showMessageBox} from './utils.js';

export async function showBlockedUsers() {
    try {
        const userRef = db.collection('users').doc(auth.currentUser.uid);
        const doc = await userRef.get();
        const blockedUsers = doc.data()?.blockedUsers || [];


        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Blocked Users</h2>
                <div class="blocked-users-list">
                    ${blockedUsers.length ? blockedUsers.map(user => `
                        <div class="blocked-user-item">
                            <span>${user.email || user.uid}</span>
                            <button class="btn-secondary" onclick="unblockUser('${user.uid}')">Unblock</button>
                        </div>
                    `).join('') : '<p>No blocked users</p>'}
                </div>
                <button class="btn-primary" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error showing blocked users:', error);
        showMessageBox('Failed to load blocked users', true);
    }
}

export async function exportUserData() {
    try {
        const userRef = db.collection('users').doc(auth.currentUser.uid);
        const userDoc = await userRef.get();
        const userData = userDoc.data();


        const [settings, profile, preferences] = await Promise.all([
            db.collection('userSettings').doc(auth.currentUser.uid).get(),
            db.collection('userProfiles').doc(auth.currentUser.uid).get(),
            db.collection('userPreferences').doc(auth.currentUser.uid).get()
        ]);


        const exportData = {
            profile: userData,
            settings: settings.data(),
            preferences: preferences.data(),
            exportDate: new Date().toISOString()
        };


        const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `arcator-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showMessageBox('Data exported successfully');
    } catch (error) {
        console.error('Error exporting user data:', error);
        showMessageBox('Failed to export user data', true);
    }
}

export async function deactivateAccount() {
    try {
        if (!confirm('Are you sure you want to deactivate your account? This will hide your profile and content.')) {
            return;
        }

        const userRef = db.collection('users').doc(auth.currentUser.uid);
        await userRef.update({
            isDeactivated: true,
            deactivatedAt: new Date().toISOString()
        });

        showMessageBox('Account deactivated successfully');
        // Do not redirect the user; let the app decide next steps.
    } catch (error) {
        console.error('Error deactivating account:', error);
        showMessageBox('Failed to deactivate account', true);
    }
}

export async function deleteAccount() {
    try {
        if (!confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) {
            return;
        }


        if (!auth.currentUser.emailVerified) {
            await auth.currentUser.sendEmailVerification();
            showMessageBox('Please verify your email first. Verification email sent.');
            return;
        }


        const batch = db.batch();
        const collections = ['users', 'userSettings', 'userProfiles', 'userPreferences'];

        await Promise.all(collections.map(async collection => {
            const ref = db.collection(collection).doc(auth.currentUser.uid);
            batch.delete(ref);
        }));

        await batch.commit();
        await auth.currentUser.delete();

        showMessageBox('Account deleted successfully');
        // Do not redirect; let the app decide next steps.
    } catch (error) {
        console.error('Error deleting account:', error);
        showMessageBox('Failed to delete account', true);
    }
}