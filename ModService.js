import AuthService from './AuthService.js';
import DataService from './DataService.js';
import { initPage } from './UIService.js';

export async function init() {
    try {
        await initPage(AuthService);
        
        AuthService.onAuthChange(async ({ user }) => {
            document.getElementById('loading-view').classList.add('d-none');
            
            if (!user) {
                document.getElementById('denied-view').classList.remove('d-none');
                document.getElementById('admin-view').classList.add('d-none');
                return;
            }
            
            const isAdmin = await AuthService.isAdmin(user.uid);
            
            if (!isAdmin) {
                document.getElementById('denied-view').classList.remove('d-none');
                document.getElementById('admin-view').classList.add('d-none');
                return;
            }
            
            document.getElementById('denied-view').classList.add('d-none');
            document.getElementById('admin-view').classList.remove('d-none');
            
            await loadUsers();
            await loadPages();
            await loadThreads();
        });
    } catch (e) {
        console.error('Init error:', e);
        document.getElementById('loading-view').innerHTML = `<p class="text-danger">Error: ${e.message}</p>`;
    }
    
    document.getElementById('create-page-btn').onclick = createPage;
}

async function loadUsers() {
    const users = await DataService.getUsers();
    const tbody = document.getElementById('users-table');
    tbody.innerHTML = users.map(u => `
        <tr>
            <td class="d-flex align-items-center gap-2">
                <img src="${u.photoURL || './defaultuser.png'}" class="profile-img-sm" alt="">
                <span>${u.displayName || 'Unknown'}</span>
            </td>
            <td>${u.email || '-'}</td>
            <td><button class="btn btn-outline-primary btn-sm" data-uid="${u.id}">Edit</button></td>
        </tr>
    `).join('');
    
    tbody.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => editUser(users.find(u => u.id === btn.dataset.uid));
    });
}

async function loadPages() {
    const pages = await DataService.getPages();
    const list = document.getElementById('pages-list');
    const empty = document.getElementById('pages-empty');
    
    if (pages.length === 0) {
        empty.classList.remove('d-none');
        list.innerHTML = '';
        return;
    }
    
    empty.classList.add('d-none');
    list.innerHTML = pages.map(p => `
        <div class="list-group-item d-flex justify-content-between align-items-center">
            <span>${p.title || 'Untitled'}</span>
            <div class="btn-group btn-group-sm">
                <a href="./pages.html?id=${p.id}" class="btn btn-outline-secondary">View</a>
                <button class="btn btn-outline-primary edit-page-btn" data-pid="${p.id}">Edit</button>
                <button class="btn btn-outline-danger delete-page-btn" data-pid="${p.id}">Delete</button>
            </div>
        </div>
    `).join('');
    
    list.querySelectorAll('.edit-page-btn').forEach(btn => {
        btn.onclick = () => editPage(pages.find(p => p.id === btn.dataset.pid));
    });
    list.querySelectorAll('.delete-page-btn').forEach(btn => {
        btn.onclick = () => deletePage(btn.dataset.pid);
    });
}

async function editUser(u) {
    const { value } = await Swal.fire({
        title: 'Edit User',
        width: '600px',
        html: `
            <div class="text-start" style="max-height:60vh;overflow-y:auto;">
                <div class="mb-2"><label class="form-label small mb-0">Display Name</label><input id="ed-displayName" class="form-control form-control-sm" value="${u.displayName || ''}"></div>
                <div class="mb-2"><label class="form-label small mb-0">Handle</label><input id="ed-handle" class="form-control form-control-sm" value="${u.handle || ''}"></div>
                <div class="mb-2"><label class="form-label small mb-0">Email</label><input id="ed-email" class="form-control form-control-sm" value="${u.email || ''}"></div>
                <div class="mb-2"><label class="form-label small mb-0">Photo URL</label><input id="ed-photoURL" class="form-control form-control-sm" value="${u.photoURL || ''}"></div>
                <div class="mb-2"><label class="form-label small mb-0">Discord URL</label><input id="ed-discordURL" class="form-control form-control-sm" value="${u.discordURL || ''}"></div>
                <div class="mb-2"><label class="form-label small mb-0">GitHub URL</label><input id="ed-githubURL" class="form-control form-control-sm" value="${u.githubURL || ''}"></div>
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
        showCancelButton: true,
        preConfirm: () => ({
            displayName: document.getElementById('ed-displayName').value,
            handle: document.getElementById('ed-handle').value,
            email: document.getElementById('ed-email').value,
            photoURL: document.getElementById('ed-photoURL').value,
            discordURL: document.getElementById('ed-discordURL').value,
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
        await loadUsers();
        Swal.fire('Updated', '', 'success');
    }
}

async function editPage(p) {
    const { value } = await Swal.fire({
        title: 'Edit Page',
        width: '80%',
        html: `<div class="text-start mb-2"><label class="form-label small">Title</label><div id="ed-title"></div></div>
               <div class="text-start mb-2"><label class="form-label small">Description</label><div id="ed-desc"></div></div>
               <div class="text-start mb-2"><label class="form-label small">Content</label><div id="ed-content"></div></div>`,
        didOpen: () => {
            const minToolbar = [['bold','italic','underline'],['link']];
            const fullToolbar = [['bold','italic','underline','strike'],['blockquote','code-block'],['link','image'],[{header:1},{header:2}],[{list:'ordered'},{list:'bullet'}],[{color:[]},{background:[]}],['clean']];
            window.edTitle = new Quill('#ed-title', { theme:'snow', modules:{toolbar:minToolbar} });
            window.edDesc = new Quill('#ed-desc', { theme:'snow', modules:{toolbar:minToolbar} });
            window.edContent = new Quill('#ed-content', { theme:'snow', modules:{toolbar:fullToolbar} });
            window.edTitle.root.innerHTML = p.title || '';
            window.edDesc.root.innerHTML = p.description || '';
            window.edContent.root.innerHTML = p.content || '';
        },
        showCancelButton: true,
        preConfirm: () => ({ 
            title: window.edTitle.root.innerHTML, 
            description: window.edDesc.root.innerHTML,
            content: window.edContent.root.innerHTML 
        })
    });
    if (value) {
        await DataService.updatePage(p.id, value);
        await loadPages();
        Swal.fire('Updated', '', 'success');
    }
}

async function deletePage(id) {
    const { isConfirmed } = await Swal.fire({ title: 'Delete page?', icon: 'warning', showCancelButton: true });
    if (isConfirmed) {
        await DataService.deletePage(id);
        await loadPages();
        Swal.fire('Deleted', '', 'success');
    }
}

async function createPage() {
    const { value } = await Swal.fire({
        title: 'Create Page',
        width: '80%',
        html: `<div class="text-start mb-2"><label class="form-label small">Title</label><div id="ed-title"></div></div>
               <div class="text-start mb-2"><label class="form-label small">Description</label><div id="ed-desc"></div></div>
               <div class="text-start mb-2"><label class="form-label small">Content</label><div id="ed-content"></div></div>`,
        didOpen: () => {
            const minToolbar = [['bold','italic','underline'],['link']];
            const fullToolbar = [['bold','italic','underline','strike'],['blockquote','code-block'],['link','image'],[{header:1},{header:2}],[{list:'ordered'},{list:'bullet'}],[{color:[]},{background:[]}],['clean']];
            window.edTitle = new Quill('#ed-title', { theme:'snow', modules:{toolbar:minToolbar} });
            window.edDesc = new Quill('#ed-desc', { theme:'snow', modules:{toolbar:minToolbar} });
            window.edContent = new Quill('#ed-content', { theme:'snow', modules:{toolbar:fullToolbar} });
        },
        showCancelButton: true,
        preConfirm: () => ({ 
            title: window.edTitle.root.innerHTML, 
            description: window.edDesc.root.innerHTML,
            content: window.edContent.root.innerHTML 
        })
    });
    if (value && value.title) {
        await DataService.createPage(value);
        await loadPages();
        Swal.fire('Created', '', 'success');
    }
}

async function loadThreads() {
    const threads = await DataService.getForums();
    const tbody = document.getElementById('threads-table');
    
    const rows = await Promise.all(threads.map(async t => {
        let authorName = 'System';
        if (t.authorId) {
            const users = await DataService.getUsers();
            const author = users.find(u => u.id === t.authorId || u.uid === t.authorId);
            authorName = author?.displayName || 'Unknown';
        }
        const date = t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : '';
        return `
            <tr>
                <td>${t.title || 'Untitled'}</td>
                <td>${authorName}</td>
                <td>${t.category || 'General'}</td>
                <td>${date}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary edit-thread-btn" data-tid="${t.id}">Edit</button>
                        <button class="btn btn-outline-danger delete-thread-btn" data-tid="${t.id}">Delete</button>
                    </div>
                </td>
            </tr>`;
    }));
    tbody.innerHTML = rows.join('');
    
    tbody.querySelectorAll('.edit-thread-btn').forEach(btn => {
        btn.onclick = () => editThread(threads.find(t => t.id === btn.dataset.tid));
    });
    tbody.querySelectorAll('.delete-thread-btn').forEach(btn => {
        btn.onclick = () => deleteThread(btn.dataset.tid);
    });
}

async function editThread(t) {
    const users = await DataService.getUsers();
    const userOptions = users.map(u => `<option value="${u.id}" ${u.id === t.authorId ? 'selected' : ''}>${u.displayName || u.email}</option>`).join('');
    
    const { value } = await Swal.fire({
        title: 'Edit Thread',
        width: '80%',
        html: `
            <div class="text-start" style="max-height:60vh;overflow-y:auto;">
                <div class="mb-2"><label class="form-label small">Title</label><div id="ed-title"></div></div>
                <div class="mb-2"><label class="form-label small">Description</label><div id="ed-desc"></div></div>
                <div class="row mb-2">
                    <div class="col-6">
                        <label class="form-label small">Category</label>
                        <select id="ed-category" class="form-select form-select-sm">
                            <option value="announcements" ${t.category==='announcements'?'selected':''}>Announcements</option>
                            <option value="gaming" ${t.category==='gaming'?'selected':''}>Gaming</option>
                            <option value="discussion" ${t.category==='discussion'?'selected':''}>Discussion</option>
                            <option value="support" ${t.category==='support'?'selected':''}>Support</option>
                            <option value="general" ${t.category==='general'?'selected':''}>General</option>
                        </select>
                    </div>
                    <div class="col-6">
                        <label class="form-label small">Author</label>
                        <select id="ed-author" class="form-select form-select-sm">
                            <option value="">System</option>
                            ${userOptions}
                        </select>
                    </div>
                </div>
                <div class="mb-2"><label class="form-label small">Tags (comma-separated)</label><input id="ed-tags" class="form-control form-control-sm" value="${(t.tags || []).join(', ')}"></div>
            </div>`,
        didOpen: () => {
            const minToolbar = [['bold','italic','underline'],['link']];
            window.edTitle = new Quill('#ed-title', { theme:'snow', modules:{toolbar:minToolbar} });
            window.edDesc = new Quill('#ed-desc', { theme:'snow', modules:{toolbar:minToolbar} });
            window.edTitle.root.innerHTML = t.title || '';
            window.edDesc.root.innerHTML = t.description || '';
        },
        showCancelButton: true,
        preConfirm: () => ({
            title: window.edTitle.root.innerHTML,
            description: window.edDesc.root.innerHTML,
            category: document.getElementById('ed-category').value,
            authorId: document.getElementById('ed-author').value || null,
            tags: document.getElementById('ed-tags').value.split(',').map(s => s.trim()).filter(Boolean)
        })
    });
    if (value) {
        await DataService.updateForum(t.id, value);
        await loadThreads();
        Swal.fire('Updated', '', 'success');
    }
}

async function deleteThread(id) {
    const { isConfirmed } = await Swal.fire({ title: 'Delete thread?', icon: 'warning', showCancelButton: true });
    if (isConfirmed) {
        await DataService.deleteForum(id);
        await loadThreads();
        Swal.fire('Deleted', '', 'success');
    }
}

init();
