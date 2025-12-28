import {
    addDoc, auth, collection, COLLECTIONS, db, deleteDoc, doc, getDoc, getDocs,
    getUserProfileFromFirestore, onSnapshot, updateDoc
} from "./firebase-init.js";
import {showCustomConfirm, showMessageBox} from "./utils.js";
import {getAvailableThemes} from "./themes.js";
import {initializePage, loadFooter, loadNavbar} from "./core.js";
import {themeManager} from "./theme-manager.js";
import {HARD_CODED_ADMIN_UID} from "./constants.js";

let usersData = [];
let currentEditingUser = null;
let _usersUnsubscribe = null;

const elementCache = new Map();

function getElement(id) {
    if (!elementCache.has(id)) {
        const element = document.getElementById(id);
        if (element) elementCache.set(id, element);
        return element;
    }
    return elementCache.get(id);
}

function setDisplayValue(elementId, value, isCheckbox = false) {
    const element = getElement(elementId);
    if (element) {
        if (isCheckbox) element.checked = !!value;
        else element.value = value ?? '';
    }
}

async function checkAdminAccess() {
    const user = auth.currentUser;
    if (!user) { showNotAdminMessage(); return false; }
    if (user.uid === HARD_CODED_ADMIN_UID) return true;
    try {
        const adminDoc = await getDoc(doc(db, 'whitelisted_admins', user.uid));
        if (adminDoc.data()) return true;
    } catch (e) { console.error('checkAdminAccess:', e); }
    showNotAdminMessage();
    return false;
}

function showNotAdminMessage() {
    const adminDashboard = getElement("admin-dashboard");
    const notAdminMessage = getElement("not-admin-message");

    if (adminDashboard) adminDashboard.style.display = 'none';
    if (notAdminMessage) notAdminMessage.style.display = 'block';
}

async function initializeAdmin() {
    try {
        console.log('Starting admin initialization...');

        // Initialize page layout and theme in parallel like other pages
        await Promise.all([
            initializePage('mod'),
            themeManager.init()
        ]);
        console.log('Page and theme initialized');

        // Explicitly update navbar with current user info
        try {
            const user = auth.currentUser;
            console.log('Current user:', user?.uid);
            if (user) {
                const userProfile = await getUserProfileFromFirestore(user.uid);
                await loadNavbar(user, userProfile);
            } else {
                await loadNavbar(null, null);
            }
        } catch (e) {
            console.warn('Failed to update navbar:', e);
        }

        // Now check if user is admin
        console.log('Checking admin access...');
        const isAdmin = await checkAdminAccess();
        console.log('Is admin:', isAdmin);

        if (!isAdmin) {
            // Load footer even if not admin
            try {
                loadFooter();
            } catch (e) {
                console.warn('Failed to load footer', e);
            }
            return;
        }

        // Show admin content now that user is verified as admin
        const adminContent = getElement('admin-content');
        if (adminContent) {
            console.log('Showing admin content');
            adminContent.style.display = 'grid';
        }

        console.log('Setting up listeners...');
        setupListeners();

        console.log('Starting realtime users listener...');
        await startRealtimeUsersListener();

        console.log('Loading pages...');
        await loadPagesForAdmin();

        // Load footer after everything is loaded
        try {
            loadFooter();
        } catch (e) {
            console.warn('Failed to load footer', e);
        }

        console.log('Page mod initialized successfully');
    } catch (error) {
        console.error("Admin initialization failed:", error);
        showMessageBox("Failed to initialize admin interface", true);
    }
}

function toggleAdminUI(show) {
    const adminContent = getElement("admin-dashboard");
    if (adminContent) adminContent.style.display = show ? "block" : "none";
}

function setupListeners() {
    const saveBtn = getElement("save-user-changes-btn");
    const cancelBtn = getElement("cancel-user-changes-btn");

    if (saveBtn) {
        saveBtn.addEventListener('click', e => {
            e.preventDefault();
            withRetry(saveUserChanges);
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', e => {
            e.preventDefault();
            closeEditModal();
        });
    }
}

async function startRealtimeUsersListener() {
    if (!db) {
        console.warn('Database not initialized');
        return;
    }
    cleanup();

    try {
        const usersRef = collection(db, COLLECTIONS.USER_PROFILES);
        console.log('Setting up realtime listener for:', COLLECTIONS.USER_PROFILES);
        _usersUnsubscribe = onSnapshot(usersRef, handleUsersSnapshot, (err) => {
            console.error('Realtime users listener error:', err);
            handleError(err);
        });
    } catch (error) {
        console.error('Error setting up users listener:', error);
        handleError(error);
    }
}

function handleUsersSnapshot(snapshot) {
    console.log('Users snapshot received with', snapshot.size, 'documents');
    usersData = Array.from(snapshot).map(doc => ({uid: doc.id, ...doc.data()}));
    console.log('Loaded users:', usersData);
    renderUserList();
}

function handleError(error) {
    console.error("Operation failed:", error);
    // For admin page, show a non-blocking admin notice when possible.
    const notice = getElement('admin-notice');
    if (notice) {
        notice.textContent = error?.message ? error.message : 'An error occurred while performing admin operation';
        notice.style.display = 'block';
        notice.classList.add('error');
        // If permission denied, show a clearer description.
        if (error?.code === 'permission-denied') {notice.textContent = 'Insufficient permissions to load admin data. Sign in with an admin account or check Firestore rules.';}
    } else if (error?.code === 'permission-denied') {
        showMessageBox('Insufficient permissions to access admin data. Some features are disabled.', true);
    } else {
        showMessageBox(error?.message ? error.message : 'An error occurred', true);
    }
}

function cleanup() {
    if (_usersUnsubscribe) {
        _usersUnsubscribe();
        _usersUnsubscribe = null;
    }
}

function renderUserList() {
    const tbody = getElement("user-list-tbody");
    if (!tbody) return;

    if (!usersData.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-text-secondary text-xs">No users found.</td></tr>';
        return;
    }

    tbody.innerHTML = usersData.map((user, idx) => `
        <tr class="hover:bg-table-row-even-bg transition-colors">
            <td class="px-2 py-1 text-text-primary text-xs font-mono">${user.uid.substring(0, 8)}...</td>
            <td class="px-2 py-1 text-text-primary text-xs">${user.displayName || "N/A"}</td>
            <td class="px-2 py-1 text-text-secondary text-xs">${user.email || "N/A"}</td>
            <td class="px-2 py-1 text-text-secondary text-xs">${user.themePreference || "dark"}</td>
            <td class="px-2 py-1 text-text-secondary text-xs">
                <div class="flex space-x-1">
                    <button data-action="edit" data-index="${idx}" class="text-link hover:text-link transition-colors admin-action-btn" title="Edit User">📝</button>
                    <button data-action="delete" data-index="${idx}" class="text-red-400 hover:text-red-300 transition-colors admin-action-btn" title="Delete Profile">❌</button>
                </div>
            </td>
        </tr>
    `).join("");

    attachRowListeners(tbody);
}

function attachRowListeners(tbody) {
    tbody.querySelectorAll('button[data-action]').forEach(btn => {
        const action = btn.dataset.action;
        const idx = Number(btn.dataset.index);
        const user = usersData[idx];

        btn.addEventListener('click', async (e) => {
            if (!user) return;
            if (action === 'edit') await openEditUserModal(user.uid, user);
            if (action === 'delete') await deleteUserProfile(user.uid, user.displayName);
        });
    });
}

async function openEditUserModal(uid, userData) {
    currentEditingUser = {uid, ...userData};

    const fields = [
        ['display-name', 'displayName'],
        ['handle', 'handle'],
        ['email', 'email'],
        ['photo-url', 'photoURL'],
        ['discord-url', 'discordURL'],
        ['github-url', 'githubURL'],
        ['font-scaling', 'fontScaling', 'normal'],
        ['notification-frequency', 'notificationFrequency', 'immediate'],
        ['data-retention', 'dataRetention', '365'],
        ['keyboard-shortcuts', 'keyboardShortcuts', 'enabled'],
        ['custom-css', 'customCSS']
    ];

    const checkboxes = [
        'email-notifications',
        'discord-notifications',
        'push-notifications',
        'profile-visible',
        'activity-tracking',
        'third-party-sharing',
        'high-contrast',
        'reduced-motion',
        'screen-reader',
        'focus-indicators',
        'debug-mode'
    ];

    fields.forEach(([elementId, dataKey, defaultValue]) => {
        setDisplayValue(`edit-user-${elementId}`, userData[dataKey] ?? defaultValue);
    });

    checkboxes.forEach(key => {
        setDisplayValue(`edit-user-${key}`, userData[key], true);
    });

    await populateEditUserThemeSelect(userData.themePreference);

    const modal = getElement("edit-user-modal");
    if (modal) {
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
    }
}

async function populateEditUserThemeSelect(selectedThemeId) {
    const select = getElement('edit-user-theme');
    if (!select) return;

    select.innerHTML = '';
    const themes = await getAvailableThemes();

    themes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.id;
        option.textContent = theme.name;
        select.appendChild(option);
    });

    select.value = selectedThemeId || 'dark';
}

async function saveUserChanges() {
    if (!currentEditingUser) throw new Error("No user selected for editing.");

    const updatedData = {};
    const fields = ['displayName', 'handle', 'email', 'photoURL', 'discordURL', 'githubURL',
        'themePreference', 'fontScaling', 'notificationFrequency', 'dataRetention',
        'keyboardShortcuts', 'customCSS'];

    const checkboxes = ['emailNotifications', 'discordNotifications', 'pushNotifications',
        'profileVisible', 'activityTracking', 'thirdPartySharing', 'highContrast',
        'reducedMotion', 'screenReader', 'focusIndicators', 'debugMode'];

    fields.forEach(field => {
        const element = getElement(`edit-user-${field.toLowerCase()}`);
        if (element) updatedData[field] = element.value;
    });

    checkboxes.forEach(field => {
        const element = getElement(`edit-user-${field.toLowerCase()}`);
        if (element) updatedData[field] = element.checked;
    });

    updatedData.lastUpdated = new Date().toISOString();

    try {
        await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, currentEditingUser.uid), updatedData);
        showMessageBox("User profile updated successfully!", false);
        closeEditModal();
    } catch (err) {
        console.error('Error updating user:', err);
        handleError(err);
    }
}

async function deleteUserProfile(uid, displayName) {
    const confirmed = await showCustomConfirm(
        `Delete profile for ${displayName}?`,
        "This will permanently delete the user's profile data. This action cannot be undone."
    );

    if (confirmed) {
        try {
            await deleteDoc(doc(db, COLLECTIONS.USER_PROFILES, uid));
            showMessageBox("Profile deleted successfully", false);
            await startRealtimeUsersListener();
        } catch (err) {
            console.error('Error deleting profile:', err);
            handleError(err);
        }
    }
}

function closeEditModal() {
    const modal = getElement("edit-user-modal");
    if (modal) modal.style.display = 'none';
    currentEditingUser = null;
}

async function withRetry(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
    }
}

async function loadPagesForAdmin() {
    const list = getElement('pages-management-list');
    if (!list) {
        console.warn('Pages management list element not found');
        return;
    }

    list.innerHTML = '<div class="text-text-2">Loading pages…</div>';
    try {
        const pagesRef = collection(db, COLLECTIONS.PAGES);
        console.log('Fetching pages from:', COLLECTIONS.PAGES);

        /** @type {import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js').QuerySnapshot} */
        const snapshot = await getDocs(pagesRef);

        console.log('Pages snapshot received with', snapshot.size, 'documents');

        if (snapshot.empty) {
            list.innerHTML = '<div class="text-text-2">No pages found. Create one to get started!</div>';
            return;
        }

        list.innerHTML = Array.from(snapshot).map(docSnap => {
            const p = docSnap.data();
            return `
                <div class="p-3 bg-surface-2 rounded-lg flex justify-between items-center">
                    <div>
                        <div class="font-semibold">${p.title || 'Untitled'}</div>
                        <div class="text-sm text-text-2">${p.description || ''}</div>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn-secondary" data-id="${docSnap.id}" data-action="edit">Edit</button>
                        <button class="btn-secondary" data-id="${docSnap.id}" data-action="delete">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
        console.log('Pages rendered successfully');

        // attach listeners
        list.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.getAttribute('data-id');
                const action = btn.getAttribute('data-action');
                if (action === 'edit') await openEditPageModal(id);
                if (action === 'delete') await deletePage(id);
            });
        });
    } catch (error) {
        console.error('Error loading pages for admin:', error);
        if (error?.code === 'permission-denied') {
            list.innerHTML = '<div class="text-text-2">Insufficient permissions to view pages. Check Firestore rules.</div>';
        } else {
            list.innerHTML = `<div class="text-text-2">Failed to load pages: ${error?.message || 'Unknown error'}</div>`;
        }
        handleError(error);
    }
}

async function openEditPageModal(pageId = null) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${pageId ? 'Edit Page' : 'Create Page'}</h2>
                <button class="modal-close-btn">×</button>
            </div>
            <div class="modal-body">
                <form id="page-form">
                    <div class="form-field">
                        <label>Title</label>
                        <input id="page-title" class="form-input" required />
                    </div>
                    <div class="form-field">
                        <label>Description</label>
                        <input id="page-desc" class="form-input" />
                    </div>
                    <div class="form-field">
                        <label>Content (HTML)</label>
                        <textarea id="page-content" class="form-input" rows="10"></textarea>
                    </div>
                    <div class="flex justify-end gap-2 mt-3">
                        <button type="button" class="btn-secondary modal-close-btn">Cancel</button>
                        <button type="submit" class="btn-primary">Save</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    modal.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', () => modal.remove()));

    document.body.appendChild(modal);

    if (pageId) {
        try {
            const pageSnap = await getDoc(doc(db, COLLECTIONS.PAGES, pageId));
            if (pageSnap.data()) {
                const page = pageSnap.data();
                modal.querySelector('#page-title').value = page.title || '';
                modal.querySelector('#page-desc').value = page.description || '';
                modal.querySelector('#page-content').value = page.content || '';
            }
        } catch (e) {
            console.error('Error loading page to edit', e);
            handleError(e);
        }
    }

    modal.querySelector('#page-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = modal.querySelector('#page-title').value.trim();
        const description = modal.querySelector('#page-desc').value.trim();
        const content = modal.querySelector('#page-content').value;

        try {
            if (pageId) {
                await updateDoc(doc(db, COLLECTIONS.PAGES, pageId), {
                    title, description, content, updatedAt: new Date().toISOString()
                });
            } else {
                await addDoc(collection(db, COLLECTIONS.PAGES), {
                    title, description, content, createdAt: new Date().toISOString(), createdBy: 'moderator'
                });
            }
            showMessageBox('Page saved');
            modal.remove();
            await loadPagesForAdmin();
        } catch (err) {
            console.error('Error saving page', err);
            handleError(err);
            showMessageBox('Failed to save page', true);
        }
    });
}

async function deletePage(pageId) {
    const confirmed = await showCustomConfirm('Delete page?', 'This will permanently delete the page.');
    if (!confirmed) return;
    try {
        await deleteDoc(doc(db, COLLECTIONS.PAGES, pageId));
        showMessageBox('Page deleted');
        await loadPagesForAdmin();
    } catch (err) {
        console.error('Error deleting page', err);
        handleError(err);
        showMessageBox('Failed to delete page', true);
    }
}

// wire create page button
const createPageBtn = document.getElementById('create-page-btn');
if (createPageBtn) createPageBtn.addEventListener('click', () => openEditPageModal());


// attach init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdmin);
} else {
    initializeAdmin().catch(handleError);
}


Object.assign(window, {
    openEditUserModal,
    deleteUserProfile,
    saveUserChanges,
    populateEditUserThemeSelect
});

export {openEditUserModal, deleteUserProfile, saveUserChanges, populateEditUserThemeSelect, initializeAdmin};