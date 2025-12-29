import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.esm.min.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';
import AuthService from './AuthService.js';
import DataService from './DataService.js';
import { initPage } from './UIService.js';
import { $, syncGithub, syncDiscord } from './Utils.js';

window.adminPanel = function() {
    return {
        loading: true,
        denied: false,
        users: [],
        pages: [],
        threads: [],
        
        async init() {
            try {
                await initPage(AuthService);
                
                AuthService.onAuthChange(async ({ user }) => {
                    this.loading = false;
                    const isAdmin = user ? await AuthService.isAdmin(user.uid) : false;
                    this.denied = !isAdmin;
                    
                    if (isAdmin) {
                        await this.refreshAll();
                    }
                });
            } catch (e) {
                console.error('Init error:', e);
                this.loading = false;
            }
        },

        async refreshAll() {
            const [users, pages, threads] = await Promise.all([
                DataService.getUsers(),
                DataService.getPages(),
                DataService.getForums()
            ]);
            this.users = users;
            this.pages = pages;
            this.threads = threads;
        },
        
        getAuthorName(uid) {
            const u = this.users.find(u => u.id === uid);
            return u ? u.displayName : (uid ? 'Unknown' : 'System');
        },
        
        formatDate(ts) {
            return ts?.seconds ? new Date(ts.seconds * 1000).toLocaleDateString() : '-';
        },

        async editUser(u) {
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
                    const syncEdDiscord = (id) => syncDiscord(id, { pic: $('ed-discord-pic') });
                    const syncEdGithub = (url) => syncGithub(url, { pic: $('ed-github-pic') });

                    $('ed-discordId').oninput = (e) => syncEdDiscord(e.target.value);
                    $('ed-githubURL').oninput = (e) => syncEdGithub(e.target.value);
                },
                showCancelButton: true,
                preConfirm: () => ({
                    displayName: $('ed-displayName').value,
                    handle: $('ed-handle').value,
                    email: $('ed-email').value,
                    photoURL: $('ed-photoURL').value,
                    discordId: $('ed-discordId').value,
                    githubURL: $('ed-githubURL').value,
                    themePreference: $('ed-themePreference').value,
                    fontScaling: $('ed-fontScaling').value,
                    customCSS: $('ed-customCSS').value,
                    dataRetention: $('ed-dataRetention').value,
                    notificationFrequency: $('ed-notificationFrequency').value,
                    emailNotifications: $('ed-emailNotifications').checked,
                    pushNotifications: $('ed-pushNotifications').checked,
                    discordNotifications: $('ed-discordNotifications').checked,
                    profileVisible: $('ed-profileVisible').checked,
                    activityTracking: $('ed-activityTracking').checked,
                    thirdPartySharing: $('ed-thirdPartySharing').checked,
                    debugMode: $('ed-debugMode').checked,
                    reducedMotion: $('ed-reducedMotion').checked,
                    highContrast: $('ed-highContrast').checked,
                    focusIndicators: $('ed-focusIndicators').checked,
                    screenReader: $('ed-screenReader').checked
                })
            });
            if (value) {
                await AuthService.updateProfile(u.id, value);
                await this.refreshAll();
                Swal.fire('Updated', '', 'success');
            }
        },

        async createPage() {
            const { value } = await Swal.fire({
                title: 'Create Page',
                html: `
                    <input id="new-page-title" class="form-control mb-2" placeholder="Title">
                    <input id="new-page-slug" class="form-control mb-2" placeholder="Slug">
                    <textarea id="new-page-content" class="form-control" rows="10" placeholder="Content"></textarea>
                `,
                showCancelButton: true,
                preConfirm: () => ({
                    title: $('new-page-title').value,
                    slug: $('new-page-slug').value,
                    content: $('new-page-content').value
                })
            });
            if (value) {
                await DataService.createPage(value);
                await this.refreshAll();
                Swal.fire('Created', '', 'success');
            }
        },

        async editPage(p) {
            const { value } = await Swal.fire({
                title: 'Edit Page',
                html: `
                    <input id="ed-page-title" class="form-control mb-2" placeholder="Title" value="${p.title || ''}">
                    <input id="ed-page-slug" class="form-control mb-2" placeholder="Slug" value="${p.slug || ''}">
                    <textarea id="ed-page-content" class="form-control" rows="10" placeholder="Content (HTML/Markdown)">${p.content || ''}</textarea>
                `,
                showCancelButton: true,
                preConfirm: () => ({
                    title: $('ed-page-title').value,
                    slug: $('ed-page-slug').value,
                    content: $('ed-page-content').value
                })
            });
            if (value) {
                await DataService.updatePage(p.id, value);
                await this.refreshAll();
                Swal.fire('Updated', '', 'success');
            }
        },

        async deletePage(id) {
            const { isConfirmed } = await Swal.fire({
                title: 'Delete Page?',
                text: 'This cannot be undone.',
                icon: 'warning',
                showCancelButton: true
            });
            if (isConfirmed) {
                await DataService.deletePage(id);
                await this.refreshAll();
                Swal.fire('Deleted', '', 'success');
            }
        },

        async editThread(t) {
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
                    title: $('ed-thread-title').value,
                    category: $('ed-thread-category').value,
                    content: $('ed-thread-content').value
                })
            });
            if (value) {
                await DataService.updateForum(t.id, value);
                await this.refreshAll();
                Swal.fire('Updated', '', 'success');
            }
        },

        async deleteThread(id) {
            const { isConfirmed } = await Swal.fire({ title: 'Delete Thread?', icon: 'warning', showCancelButton: true });
            if (isConfirmed) {
                await DataService.deleteForum(id);
                await this.refreshAll();
                Swal.fire('Deleted', '', 'success');
            }
        }
    }
}
