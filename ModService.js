import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.esm.min.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';
import AuthService from './AuthService.js';
import DataService from './DataService.js';
import { initPage } from './UIService.js';
import { $, syncGithub, syncDiscord } from './Utils.js';

const state = {
    users: [],
    pages: [],
    threads: []
};

async function init() {
    try {
        await initPage(AuthService);
        
        AuthService.onAuthChange(async ({ user }) => {
            const loadingSpinner = document.getElementById('loading-spinner');
            const accessDenied = document.getElementById('access-denied');
            const adminContent = document.getElementById('admin-content');
            
            if (loadingSpinner) loadingSpinner.classList.add('d-none');
            
            const isAdmin = user ? await AuthService.isAdmin(user.uid) : false;
            
            if (isAdmin) {
                if (adminContent) adminContent.classList.remove('d-none');
                await refreshAll();
            } else {
                if (accessDenied) accessDenied.classList.remove('d-none');
            }
        });
    } catch (e) {
        console.error('Init error:', e);
        const loadingSpinner = document.getElementById('loading-spinner');
        if (loadingSpinner) loadingSpinner.classList.add('d-none');
    }
}

async function refreshAll() {
    const [users, pages, threads] = await Promise.all([
        DataService.getUsers(),
        DataService.getPages(),
        DataService.getForums()
    ]);
    state.users = users;
    state.pages = pages;
    state.threads = threads;
    
    renderUsers();
    renderPages();
    renderThreads();
}

function getAuthorName(uid) {
    const u = state.users.find(u => u.id === uid);
    return u ? u.displayName : (uid ? 'Unknown' : 'System');
}

function formatDate(ts) {
    return ts?.seconds ? new Date(ts.seconds * 1000).toLocaleDateString() : '-';
}

function renderUsers() {
    const tbody = document.getElementById('users-list');
    if (!tbody) return;
    
    tbody.innerHTML = state.users.map(u => `
        <tr>
            <td class="d-flex align-items-center gap-2">
                <img src="${u.photoURL || './defaultuser.png'}" class="profile-img-sm" alt="">
                <span>${u.displayName || 'Unknown'}</span>
            </td>
            <td>${u.email || '-'}</td>
            <td><button class="btn btn-outline-primary btn-sm" onclick="window.adminPanel.editUser('${u.id}')">Edit</button></td>
        </tr>
    `).join('');
}

function renderPages() {
    const list = document.getElementById('pages-list');
    const noPages = document.getElementById('no-pages');
    if (!list) return;
    
    if (state.pages.length === 0) {
        if (noPages) noPages.classList.remove('d-none');
        list.innerHTML = '';
    } else {
        if (noPages) noPages.classList.add('d-none');
        list.innerHTML = state.pages.map(p => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>${p.title || 'Untitled'}</span>
                <div class="btn-group btn-group-sm">
                    <a href="./pages.html?id=${p.id}" class="btn btn-outline-secondary">View</a>
                    <button class="btn btn-outline-primary" onclick="window.adminPanel.editPage('${p.id}')">Edit</button>
                    <button class="btn btn-outline-danger" onclick="window.adminPanel.deletePage('${p.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }
}

function renderThreads() {
    const tbody = document.getElementById('threads-list');
    if (!tbody) return;
    
    tbody.innerHTML = state.threads.map(t => `
        <tr>
            <td>${t.title || 'Untitled'}</td>
            <td>${getAuthorName(t.authorId)}</td>
            <td>${t.category || 'General'}</td>
            <td>${formatDate(t.createdAt)}</td>
            <td>
                <button class="btn btn-outline-primary btn-sm" onclick="window.adminPanel.editThread('${t.id}')">Edit</button>
                <button class="btn btn-outline-danger btn-sm" onclick="window.adminPanel.deleteThread('${t.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

// Expose functions to global scope for onclick handlers
window.adminPanel = {
    createPage: async () => {
        const { value } = await Swal.fire({
            title: 'Create Page',
            html: `
                <input id="new-page-title" class="form-control mb-2" placeholder="Title">
                <input id="new-page-slug" class="form-control mb-2" placeholder="Slug">
                <textarea id="new-page-content" class="form-control" rows="10" placeholder="Content"></textarea>
            `,
            showCancelButton: true,
            preConfirm: () => ({
                title: document.getElementById('new-page-title').value,
                slug: document.getElementById('new-page-slug').value,
                content: document.getElementById('new-page-content').value
            })
        });
        if (value) {
            await DataService.createPage(value);
            await refreshAll();
            Swal.fire('Created', '', 'success');
        }
    },

    editPage: async (id) => {
        const p = state.pages.find(p => p.id === id);
        if (!p) return;
        
        const { value } = await Swal.fire({
            title: 'Edit Page',
            html: `
                <input id="ed-page-title" class="form-control mb-2" placeholder="Title" value="${p.title || ''}">
                <input id="ed-page-slug" class="form-control mb-2" placeholder="Slug" value="${p.slug || ''}">
                <textarea id="ed-page-content" class="form-control" rows="10" placeholder="Content (HTML/Markdown)">${p.content || ''}</textarea>
            `,
            showCancelButton: true,
            preConfirm: () => ({
                title: document.getElementById('ed-page-title').value,
                slug: document.getElementById('ed-page-slug').value,
                content: document.getElementById('ed-page-content').value
            })
        });
        if (value) {
            await DataService.updatePage(p.id, value);
            await refreshAll();
            Swal.fire('Updated', '', 'success');
        }
    },

    deletePage: async (id) => {
        const { isConfirmed } = await Swal.fire({
            title: 'Delete Page?',
            text: 'This cannot be undone.',
            icon: 'warning',
            showCancelButton: true
        });
        if (isConfirmed) {
            await DataService.deletePage(id);
            await refreshAll();
            Swal.fire('Deleted', '', 'success');
        }
    },

    editThread: async (id) => {
        const t = state.threads.find(t => t.id === id);
        if (!t) return;
        
        const { value } = await Swal.fire({
            title: 'Edit Thread',
            html: `
                <input id="ed-thread-title" class="form-control mb-2" placeholder="Title" value="${t.title || ''}">
                <select id="ed-thread-category" class="form-select mb-2">
                    <option value="General" ${t.category === 'General' ? 'selected' : ''}>General</option>
                    <option value="Announcements" ${t.category === 'Announcements' ? 'selected' : ''}>Announcements</option>
                    <option value="Support" ${t.category === 'Support' ? 'selected' : ''}>Support</option>
                    <option value="Feedback" ${t.category === 'Feedback' ? 'selected' : ''}>Feedback</option>
                </select>
                <textarea id="ed-thread-content" class="form-control" rows="10" placeholder="Content (HTML/Markdown)">${t.content || ''}</textarea>
            `,
            showCancelButton: true,
            preConfirm: () => ({
                title: document.getElementById('ed-thread-title').value,
                category: document.getElementById('ed-thread-category').value,
                content: document.getElementById('ed-thread-content').value
            })
        });
        if (value) {
            await DataService.updateForum(t.id, value);
            await refreshAll();
            Swal.fire('Updated', '', 'success');
        }
    },

    deleteThread: async (id) => {
        const { isConfirmed } = await Swal.fire({ title: 'Delete Thread?', icon: 'warning', showCancelButton: true });
        if (isConfirmed) {
            await DataService.deleteForum(id);
            await refreshAll();
            Swal.fire('Deleted', '', 'success');
        }
    },

    editUser: async (id) => {
        const u = state.users.find(u => u.id === id);
        if (!u) return;

        const { value } = await Swal.fire({
            title: 'Edit User',
            width: '600px',
            html: `
                <div class="text-start" style="max-height:60vh;overflow-y:auto;">
                    <div class="mb-2"><label class="form-label small mb-0">User ID (UID)</label><input class="form-control form-control-sm bg-dark-subtle" value="${u.uid}" readonly></div>
                    <div class="mb-2"><label class="form-label small mb-0">Display Name</label><input id="ed-displayName" class="form-control form-control-sm" value="${u.displayName || ''}"></div>
                    <div class="mb-2"><label class="form-label small mb-0">Handle</label><input id="ed-handle" class="form-control form-control-sm" value="${u.handle || ''}"></div>
                    <div class="mb-2"><label class="form-label small mb-0">Email</label><input id="ed-email" class="form-control form-control-sm" value="${u.email || ''}"></div>
                    <div class="mb-2"><label class="form-label small mb-0">Photo URL</label><input id="ed-photoURL" class="form-control form-control-sm" value="${u.photoURL || ''}"></div>
                    <div class="row mb-2">
                        <div class="col-6">
                            <label class="form-label small mb-0">Discord ID</label>
                            <div class="d-flex align-items-center gap-2">
                                <img id="ed-discord-pic" src="${u.discordPic || './defaultuser.png'}" class="rounded border" style="width: 30px; height: 30px; object-fit: cover;">
                                <input id="ed-discordId" class="form-control form-control-sm" value="${u.discordId || ''}">
                            </div>
                        </div>
                        <div class="col-6">
                            <label class="form-label small mb-0">GitHub URL</label>
                            <div class="d-flex align-items-center gap-2">
                                <img id="ed-github-pic" src="${u.githubPic || './defaultuser.png'}" class="rounded border" style="width: 30px; height: 30px; object-fit: cover;">
                                <input id="ed-githubURL" class="form-control form-control-sm" value="${u.githubURL || ''}">
                            </div>
                        </div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-6"><label class="form-label small mb-0">Theme</label><select id="ed-themePreference" class="form-select form-select-sm"><option value="dark" ${u.themePreference==='dark'?'selected':''}>Dark</option><option value="light" ${u.themePreference==='light'?'selected':''}>Light</option></select></div>
                        <div class="col-6"><label class="form-label small mb-0">Font Size</label><select id="ed-fontScaling" class="form-select form-select-sm"><option value="small" ${u.fontScaling==='small'?'selected':''}>Small</option><option value="normal" ${u.fontScaling==='normal'?'selected':''}>Normal</option><option value="large" ${u.fontScaling==='large'?'selected':''}>Large</option></select></div>
                    </div>
                    <div class="mb-2"><label class="form-label small mb-0">Custom CSS</label><textarea id="ed-customCSS" class="form-control form-control-sm" rows="2">${u.customCSS || ''}</textarea></div>
                    <div class="row mb-2">
                        <div class="col-6"><label class="form-label small mb-0">Data Retention (days)</label><input id="ed-dataRetention" class="form-control form-control-sm" value="${u.dataRetention || '365'}"></div>
                        <div class="col-6"><label class="form-label small mb-0">Notification Freq</label><select id="ed-notificationFrequency" class="form-select form-select-sm"><option value="immediate" ${u.notificationFrequency==='immediate'?'selected':''}>Immediate</option><option value="daily" ${u.notificationFrequency==='daily'?'selected':''}>Daily</option><option value="weekly" ${u.notificationFrequency==='weekly'?'selected':''}>Weekly</option></select></div>
                    </div>
                    <hr><p class="small text-secondary mb-1">Toggles</p>
                    <div class="row">
                        <div class="col-6"><div class="form-check"><input type="checkbox" class="form-check-input" id="ed-emailNotifications" ${u.emailNotifications?'checked':''}><label class="form-check-label small" for="ed-emailNotifications">Email Notifications</label></div></div>
                        <div class="col-6"><div class="form-check"><input type="checkbox" class="form-check-input" id="ed-pushNotifications" ${u.pushNotifications?'checked':''}><label class="form-check-label small" for="ed-pushNotifications">Push Notifications</label></div></div>
                        <div class="col-6"><div class="form-check"><input type="checkbox" class="form-check-input" id="ed-discordNotifications" ${u.discordNotifications?'checked':''}><label class="form-check-label small" for="ed-discordNotifications">Discord Notifications</label></div></div>
                        <div class="col-6"><div class="form-check"><input type="checkbox" class="form-check-input" id="ed-profileVisible" ${u.profileVisible?'checked':''}><label class="form-check-label small" for="ed-profileVisible">Profile Visible</label></div></div>
                        <div class="col-6"><div class="form-check"><input type="checkbox" class="form-check-input" id="ed-activityTracking" ${u.activityTracking?'checked':''}><label class="form-check-label small" for="ed-activityTracking">Activity Tracking</label></div></div>
                        <div class="col-6"><div class="form-check"><input type="checkbox" class="form-check-input" id="ed-thirdPartySharing" ${u.thirdPartySharing?'checked':''}><label class="form-check-label small" for="ed-thirdPartySharing">Third Party Sharing</label></div></div>
                        <div class="col-6"><div class="form-check"><input type="checkbox" class="form-check-input" id="ed-debugMode" ${u.debugMode?'checked':''}><label class="form-check-label small" for="ed-debugMode">Debug Mode</label></div></div>
                        <div class="col-6"><div class="form-check"><input type="checkbox" class="form-check-input" id="ed-reducedMotion" ${u.reducedMotion?'checked':''}><label class="form-check-label small" for="ed-reducedMotion">Reduced Motion</label></div></div>
                        <div class="col-6"><div class="form-check"><input type="checkbox" class="form-check-input" id="ed-highContrast" ${u.highContrast?'checked':''}><label class="form-check-label small" for="ed-highContrast">High Contrast</label></div></div>
                        <div class="col-6"><div class="form-check"><input type="checkbox" class="form-check-input" id="ed-focusIndicators" ${u.focusIndicators?'checked':''}><label class="form-check-label small" for="ed-focusIndicators">Focus Indicators</label></div></div>
                        <div class="col-6"><div class="form-check"><input type="checkbox" class="form-check-input" id="ed-screenReader" ${u.screenReader?'checked':''}><label class="form-check-label small" for="ed-screenReader">Screen Reader</label></div></div>
                    </div>
                </div>`,
            didOpen: () => {
                const syncEdDiscord = (id) => syncDiscord(id, { pic: document.getElementById('ed-discord-pic') });
                const syncEdGithub = (url) => syncGithub(url, { pic: document.getElementById('ed-github-pic') });

                document.getElementById('ed-discordId').oninput = (e) => syncEdDiscord(e.target.value);
                document.getElementById('ed-githubURL').oninput = (e) => syncEdGithub(e.target.value);
            },
            showCancelButton: true,
            preConfirm: () => ({
                displayName: document.getElementById('ed-displayName').value,
                handle: document.getElementById('ed-handle').value,
                email: document.getElementById('ed-email').value,
                photoURL: document.getElementById('ed-photoURL').value,
                discordId: document.getElementById('ed-discordId').value,
                githubURL: document.getElementById('ed-githubURL').value,
                themePreference: document.getElementById('ed-themePreference').value,
                fontScaling: document.getElementById('ed-fontScaling').value,
                customCSS: document.getElementById('ed-customCSS').value,
                dataRetention: document.getElementById('ed-dataRetention').value,
                notificationFrequency: document.getElementById('ed-notificationFrequency').value,
                emailNotifications: document.getElementById('ed-emailNotifications').checked,
                pushNotifications: document.getElementById('ed-pushNotifications').checked,
                discordNotifications: document.getElementById('ed-discordNotifications').checked,
                profileVisible: document.getElementById('ed-profileVisible').checked,
                activityTracking: document.getElementById('ed-activityTracking').checked,
                thirdPartySharing: document.getElementById('ed-thirdPartySharing').checked,
                debugMode: document.getElementById('ed-debugMode').checked,
                reducedMotion: document.getElementById('ed-reducedMotion').checked,
                highContrast: document.getElementById('ed-highContrast').checked,
                focusIndicators: document.getElementById('ed-focusIndicators').checked,
                screenReader: document.getElementById('ed-screenReader').checked
            })
        });
        if (value) {
            await AuthService.updateProfile(u.id, value);
            await refreshAll();
            Swal.fire('Updated', '', 'success');
        }
    }
};

init();
