import AuthService from './AuthService.js';
import DataService from './DataService.js';
import { initPage } from './UIService.js';
import { db, COLLECTIONS, getDoc, doc } from './firebase-init.js';

let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let selectedConv = null;
let allConversations = [];
const userCache = {};

async function getUserInfo(uid) {
    if (!uid) return { displayName: 'Anonymous', photoURL: './defaultuser.png' };
    if (userCache[uid]) return userCache[uid];
    try {
        const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, uid));
        if (snap.exists()) {
            userCache[uid] = snap.data();
            return userCache[uid];
        }
    } catch (e) { console.error('getUserInfo:', e); }
    return { displayName: 'Unknown', photoURL: './defaultuser.png' };
}

function formatDate(ts) {
    if (!ts) return '';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    const now = new Date();
    const diff = now - d;
    const isToday = d.toDateString() === now.toDateString();
    
    if (typeof dayjs !== 'undefined') {
        if (isToday) return dayjs(d).format('HH:mm:ss');
        if (diff < 86400000 * 7) return dayjs(d).format('ddd HH:mm');
        return dayjs(d).format('DD/MM/YY HH:mm');
    }
    // Fallback without dayjs
    const pad = n => String(n).padStart(2, '0');
    if (isToday) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)}`;
}

async function loadForums() {
    const forums = await DataService.getForums();
    document.getElementById('forums-loading').classList.add('d-none');
    
    if (forums.length === 0) {
        document.getElementById('forums-empty').classList.remove('d-none');
        return;
    }
    
    // Fetch comment counts for forums missing the count field
    const forumData = await Promise.all(forums.map(async f => {
        let commentCount = f.commentCount;
        if (commentCount === undefined || commentCount === null) {
            const comments = await DataService.getComments(f.id);
            commentCount = comments.length;
        }
        return { ...f, commentCount };
    }));
    
    const forumHtml = await Promise.all(forumData.map(async f => {
        const isSystemThread = !f.authorId;
        const author = isSystemThread ? null : await getUserInfo(f.authorId);
        
        const categoryEmoji = { announcements: '📢', gaming: '🎮', discussion: '💬', support: '🛠️', general: '📝' };
        const cat = f.category?.toLowerCase() || 'general';
        const categoryDisplay = categoryEmoji[cat] || f.category || '📝';
        
        const authorInfo = isSystemThread 
            ? `<span class="badge bg-info">System</span> • ${categoryDisplay} • ${formatDate(f.createdAt)}`
            : `<img src="${author.photoURL || './defaultuser.png'}" class="profile-img-sm me-1" alt="">
               ${author.displayName || 'Anonymous'} • ${categoryDisplay} • ${formatDate(f.createdAt)}`;
        
        return `
            <div class="card mb-2 forum-thread-card" data-id="${f.id}">
                <div class="card-body py-2">
                    <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn btn-link btn-sm p-0 text-primary view-comments-btn" data-id="${f.id}">
                                <span class="toggle-icon">▼</span>
                            </button>
                            <span class="fw-bold">${DOMPurify.sanitize(f.title || 'Untitled')}</span>
                        </div>
                        <small class="text-secondary">${authorInfo}</small>
                    </div>
                    <p class="mb-0 small mt-1">${DOMPurify.sanitize(f.description || '')}</p>
                </div>
                <div class="card-footer py-2 comments-section" id="comments-${f.id}">
                    <div class="comments-list mb-2"><div class="text-center py-1"><div class="loading-spinner mx-auto"></div></div></div>
                    <div class="d-none add-comment-form">
                        <div class="add-comment-editor" id="add-comment-${f.id}"></div>
                        <button class="btn btn-primary btn-sm mt-1 submit-comment-btn" data-forum-id="${f.id}">Post</button>
                    </div>
                </div>
            </div>
        `;
    }));
    
    document.getElementById('forums-list').innerHTML = forumHtml.join('');
    
    // Bind toggle handlers and load comments for expanded sections
    document.querySelectorAll('.view-comments-btn').forEach(btn => {
        btn.onclick = () => toggleComments(btn.dataset.id);
    });
    document.querySelectorAll('.submit-comment-btn').forEach(btn => {
        btn.onclick = () => submitComment(btn.dataset.forumId);
    });
    
    // Load comments for all forums (expanded by default)
    for (const f of forumData) {
        await loadComments(f.id);
        if (currentUser) {
            const section = document.getElementById(`comments-${f.id}`);
            section?.querySelector('.add-comment-form')?.classList.remove('d-none');
            // Initialize Quill for add comment
            const editorEl = document.getElementById(`add-comment-${f.id}`);
            if (editorEl && !editorEl.classList.contains('ql-container')) {
                new Quill(`#add-comment-${f.id}`, { theme: 'snow', placeholder: 'Add a comment...', modules: { toolbar: [['bold','italic','underline'],['link'],['clean']] } });
            }
        }
    }
}

async function toggleComments(forumId) {
    const section = document.getElementById(`comments-${forumId}`);
    const btn = document.querySelector(`.view-comments-btn[data-id="${forumId}"]`);
    const icon = btn?.querySelector('.toggle-icon');
    const isHidden = section.classList.contains('d-none');
    
    if (isHidden) {
        section.classList.remove('d-none');
        if (icon) icon.textContent = '▼';
        await loadComments(forumId);
        if (currentUser) section.querySelector('.add-comment-form')?.classList.remove('d-none');
    } else {
        section.classList.add('d-none');
        if (icon) icon.textContent = '▶';
    }
}

async function loadComments(forumId) {
    const comments = await DataService.getComments(forumId);
    const list = document.querySelector(`#comments-${forumId} .comments-list`);
    
    if (comments.length === 0) {
        list.innerHTML = '<p class="text-secondary">No comments yet</p>';
        return;
    }
    
    const rootComments = comments.filter(c => !c.parentCommentId);
    const replies = comments.filter(c => c.parentCommentId);
    
    function getVoteCount(c) {
        if (!c.reactions) return 0;
        let count = 0;
        Object.keys(c.reactions).forEach(k => {
            if (k.startsWith('👍_')) count++;
            if (k.startsWith('👎_')) count--;
        });
        return count;
    }
    
    function hasVoted(c, emoji) {
        if (!c.reactions || !currentUser) return false;
        return c.reactions[`${emoji}_${currentUser.uid}`] === true;
    }
    
    async function renderComment(c, depth = 0) {
        const author = await getUserInfo(c.authorId);
        const isOwn = c.authorId === currentUser?.uid;
        const wasEdited = c.editedByAdmin ? '<span class="text-warning ms-2">[Edited by Admin]</span>' : '';
        const voteCount = getVoteCount(c);
        const upvoted = hasVoted(c, '👍');
        const downvoted = hasVoted(c, '👎');
        const childReplies = replies.filter(r => r.parentCommentId === c.id);
        const childHtml = await Promise.all(childReplies.map(r => renderComment(r, depth + 1)));
        
        return `
            <div class="comment mb-2" data-id="${c.id}" data-depth="${depth}">
                <div class="d-flex">
                    <div class="vote-buttons d-flex flex-column align-items-center me-2">
                        <button class="btn btn-link btn-sm p-0 upvote-btn ${upvoted ? 'text-success' : 'text-secondary'}" data-forum-id="${forumId}" data-comment-id="${c.id}">▲</button>
                        <span class="vote-count ${voteCount > 0 ? 'text-success' : voteCount < 0 ? 'text-danger' : ''}">${voteCount}</span>
                        <button class="btn btn-link btn-sm p-0 downvote-btn ${downvoted ? 'text-danger' : 'text-secondary'}" data-forum-id="${forumId}" data-comment-id="${c.id}">▼</button>
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <img src="${author.photoURL || './defaultuser.png'}" class="profile-img-sm" alt="">
                            <strong>${DOMPurify.sanitize(author.displayName || 'Anonymous')}</strong>
                            <small class="text-secondary">${formatDate(c.createdAt)}</small>
                            ${wasEdited}
                        </div>
                        <p class="mb-1">${DOMPurify.sanitize(c.content || '')}</p>
                        <div class="comment-actions mb-2">
                            ${currentUser ? `<button class="btn btn-link btn-sm p-0 reply-btn" data-forum-id="${forumId}" data-comment-id="${c.id}">Reply</button>` : ''}
                            ${isOwn ? `
                                <button class="btn btn-link btn-sm p-0 ms-2 edit-comment-btn" data-forum-id="${forumId}" data-comment-id="${c.id}">Edit</button>
                                <button class="btn btn-link btn-sm p-0 text-danger delete-comment-btn" data-forum-id="${forumId}" data-comment-id="${c.id}">Delete</button>
                            ` : ''}
                            ${isAdmin && !isOwn ? `
                                <button class="btn btn-link btn-sm p-0 ms-2 text-warning admin-edit-btn" data-forum-id="${forumId}" data-comment-id="${c.id}">Censor</button>
                                <button class="btn btn-link btn-sm p-0 text-danger admin-delete-btn" data-forum-id="${forumId}" data-comment-id="${c.id}">Remove</button>
                            ` : ''}
                        </div>
                        <div class="replies-container ps-3 border-start">${childHtml.join('')}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    const commentsHtml = await Promise.all(rootComments.map(c => renderComment(c)));
    list.innerHTML = commentsHtml.join('');
    
    list.querySelectorAll('.upvote-btn').forEach(btn => btn.onclick = () => voteComment(btn.dataset.forumId, btn.dataset.commentId, '👍'));
    list.querySelectorAll('.downvote-btn').forEach(btn => btn.onclick = () => voteComment(btn.dataset.forumId, btn.dataset.commentId, '👎'));
    list.querySelectorAll('.reply-btn').forEach(btn => btn.onclick = () => replyToComment(btn.dataset.forumId, btn.dataset.commentId));
    list.querySelectorAll('.edit-comment-btn').forEach(btn => btn.onclick = () => editComment(btn.dataset.forumId, btn.dataset.commentId, false));
    list.querySelectorAll('.delete-comment-btn').forEach(btn => btn.onclick = () => deleteComment(btn.dataset.forumId, btn.dataset.commentId));
    list.querySelectorAll('.admin-edit-btn').forEach(btn => btn.onclick = () => editComment(btn.dataset.forumId, btn.dataset.commentId, true));
    list.querySelectorAll('.admin-delete-btn').forEach(btn => btn.onclick = () => deleteComment(btn.dataset.forumId, btn.dataset.commentId));
}

async function voteComment(forumId, commentId, emoji) {
    if (!currentUser) return Swal.fire('Error', 'Sign in to vote', 'error');
    const comments = await DataService.getComments(forumId);
    const comment = comments.find(c => c.id === commentId);
    const reactions = comment?.reactions || {};
    const key = `${emoji}_${currentUser.uid}`;
    const otherKey = emoji === '👍' ? `👎_${currentUser.uid}` : `👍_${currentUser.uid}`;
    
    if (reactions[key]) delete reactions[key];
    else { reactions[key] = true; delete reactions[otherKey]; }
    
    await DataService.updateComment(forumId, commentId, { reactions });
    await loadComments(forumId);
}

async function replyToComment(forumId, parentId) {
    if (!currentUser) return Swal.fire('Error', 'Sign in first', 'error');
    const { value } = await Swal.fire({
        title: 'Reply',
        html: '<div id="reply-editor"></div>',
        didOpen: () => {
            window.replyQuill = new Quill('#reply-editor', { theme: 'snow', modules: { toolbar: [['bold','italic','underline'],['link'],['clean']] } });
        },
        showCancelButton: true,
        preConfirm: () => window.replyQuill.root.innerHTML
    });
    if (value && value !== '<p><br></p>') {
        await DataService.addComment(forumId, { content: value, parentCommentId: parentId }, currentUser.uid, currentProfile);
        await loadComments(forumId);
    }
}

async function submitComment(forumId) {
    if (!currentUser) return Swal.fire('Error', 'Sign in first', 'error');
    const editorEl = document.querySelector(`#add-comment-${forumId}`);
    const quillInstance = Quill.find(editorEl);
    const content = quillInstance ? quillInstance.root.innerHTML : '';
    if (!content || content === '<p><br></p>') return;
    
    await DataService.addComment(forumId, { content }, currentUser.uid, currentProfile);
    if (quillInstance) quillInstance.root.innerHTML = '';
    await loadComments(forumId);
}

async function editComment(forumId, commentId, isAdminEdit) {
    const comments = await DataService.getComments(forumId);
    const comment = comments.find(c => c.id === commentId);
    const { value } = await Swal.fire({
        title: isAdminEdit ? 'Censor Comment' : 'Edit Comment',
        html: '<div id="edit-editor"></div>',
        didOpen: () => {
            window.editQuill = new Quill('#edit-editor', { theme: 'snow', modules: { toolbar: [['bold','italic','underline'],['link'],['clean']] } });
            window.editQuill.root.innerHTML = comment?.content || '';
        },
        showCancelButton: true,
        preConfirm: () => window.editQuill.root.innerHTML
    });
    if (value) {
        const updateData = { content: value };
        if (isAdminEdit) updateData.editedByAdmin = true;
        await DataService.updateComment(forumId, commentId, updateData);
        await loadComments(forumId);
    }
}

async function deleteComment(forumId, commentId) {
    const { isConfirmed } = await Swal.fire({ title: 'Delete comment?', icon: 'warning', showCancelButton: true });
    if (isConfirmed) {
        await DataService.deleteComment(forumId, commentId);
        await loadComments(forumId);
    }
}

async function loadConversations() {
    if (!currentUser) return;
    const convs = await DataService.getConversations(currentUser.uid);
    allConversations = convs;
    
    if (convs.length === 0) {
        document.getElementById('conversations-empty').classList.remove('d-none');
        document.getElementById('conversations-list').innerHTML = '';
        return;
    }
    
    document.getElementById('conversations-empty').classList.add('d-none');
    
    const convHtml = await Promise.all(convs.map(async c => {
        const isGroup = c.participants?.length > 2;
        const isSelfNotes = c.participants?.length === 1 || c.name === 'Notes';
        let displayName = c.name || 'Chat';
        let photoURL = './defaultuser.png';
        
        if (isSelfNotes) {
            displayName = 'Notes';
            const self = await getUserInfo(currentUser.uid);
            photoURL = self.photoURL || './defaultuser.png';
        } else if (!isGroup) {
            const otherParticipant = c.participants?.find(p => p !== currentUser.uid);
            if (otherParticipant) {
                const other = await getUserInfo(otherParticipant);
                displayName = other.displayName || 'Chat';
                photoURL = other.photoURL || './defaultuser.png';
            }
        }
        
        const desc = c.description ? `<br><small class="text-muted">${DOMPurify.sanitize(c.description.slice(0, 40))}</small>` : '';
        
        return `<a href="#" class="list-group-item list-group-item-action d-flex align-items-center gap-2" data-id="${c.id}">
            <img src="${photoURL}" class="profile-img-sm" alt="">
            <div class="flex-grow-1">
                <div>${displayName}${isGroup ? ' <span class="badge bg-secondary">Group</span>' : ''}</div>
                <small class="text-secondary">${c.lastMessage ? DOMPurify.sanitize(c.lastMessage.slice(0, 30)) + '...' : 'No messages'}${desc}</small>
            </div>
        </a>`;
    }));
    
    document.getElementById('conversations-list').innerHTML = convHtml.join('');
    
    document.querySelectorAll('#conversations-list a').forEach(el => {
        el.onclick = async (e) => {
            e.preventDefault();
            document.querySelectorAll('#conversations-list a').forEach(a => a.classList.remove('active'));
            el.classList.add('active');
            selectedConv = convs.find(c => c.id === el.dataset.id);
            document.getElementById('no-conv-selected').classList.add('d-none');
            document.getElementById('conv-selected').classList.remove('d-none');
            
            const isGroup = selectedConv.participants?.length > 2;
            const isSelfNotes = selectedConv.participants?.length === 1 || selectedConv.name === 'Notes';
            if (isSelfNotes) {
                document.getElementById('conv-title').textContent = 'Notes';
            } else if (isGroup) {
                document.getElementById('conv-title').textContent = selectedConv.name || `Group (${selectedConv.participants.length})`;
            } else {
                const other = await getUserInfo(selectedConv.participants?.find(p => p !== currentUser.uid));
                document.getElementById('conv-title').textContent = other.displayName || 'Chat';
            }
            
            await loadMessages();
        };
    });
}

async function loadMessages() {
    if (!selectedConv) return;
    const messages = await DataService.getMessages(selectedConv.id);
    const list = document.getElementById('messages-list');
    
    if (messages.length === 0) {
        list.innerHTML = '<p class="text-center text-secondary py-3">No messages yet</p>';
        return;
    }
    
    const msgsHtml = await Promise.all(messages.map(async m => {
        const senderUid = m.senderId || m.authorId || m.uid;
        const isMine = senderUid === currentUser?.uid;
        const sender = await getUserInfo(senderUid);
        const wasEdited = m.editedByAdmin ? '<span class="text-warning">[Admin]</span>' : '';
        
        return `
            <div class="mb-2 d-flex ${isMine ? 'justify-content-end' : 'justify-content-start'}" data-msg-id="${m.id}">
                ${!isMine ? `<img src="${sender.photoURL || './defaultuser.png'}" class="profile-img-sm me-2 align-self-end" alt="">` : ''}
                <div class="message-bubble p-2 rounded ${isMine ? 'bg-primary text-white' : 'bg-secondary'}">
                    ${!isMine ? `<small class="d-block fw-bold">${sender.displayName || 'Unknown'}</small>` : ''}
                    <div>${DOMPurify.sanitize(m.content || m.text || '')} ${wasEdited}</div>
                    <div class="d-flex justify-content-between align-items-center gap-2">
                        <small class="${isMine ? 'text-white-50' : 'text-muted'}">${formatDate(m.createdAt)}</small>
                        ${isMine ? `
                            <div>
                                <button class="btn btn-link btn-sm p-0 text-white-50 edit-msg-btn" data-id="${m.id}">Edit</button>
                                <button class="btn btn-link btn-sm p-0 text-white-50 delete-msg-btn" data-id="${m.id}">Delete</button>
                            </div>
                        ` : ''}
                        ${isAdmin && !isMine ? `
                            <div>
                                <button class="btn btn-link btn-sm p-0 text-warning admin-edit-msg-btn" data-id="${m.id}">Censor</button>
                                <button class="btn btn-link btn-sm p-0 text-danger admin-delete-msg-btn" data-id="${m.id}">Remove</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
                ${isMine ? `<img src="${currentProfile?.photoURL || './defaultuser.png'}" class="profile-img-sm ms-2 align-self-end" alt="">` : ''}
            </div>
        `;
    }));
    
    list.innerHTML = msgsHtml.join('');
    list.scrollTop = list.scrollHeight;
    
    list.querySelectorAll('.edit-msg-btn').forEach(btn => btn.onclick = () => editMessage(btn.dataset.id, false));
    list.querySelectorAll('.delete-msg-btn').forEach(btn => btn.onclick = () => deleteMessage(btn.dataset.id));
    list.querySelectorAll('.admin-edit-msg-btn').forEach(btn => btn.onclick = () => editMessage(btn.dataset.id, true));
    list.querySelectorAll('.admin-delete-msg-btn').forEach(btn => btn.onclick = () => deleteMessage(btn.dataset.id));
}

async function editMessage(msgId, isAdminEdit) {
    const { value } = await Swal.fire({ title: isAdminEdit ? 'Censor Message' : 'Edit Message', input: 'textarea', showCancelButton: true });
    if (value && selectedConv) {
        const updateData = { content: value };
        if (isAdminEdit) updateData.editedByAdmin = true;
        await DataService.updateMessage(selectedConv.id, msgId, updateData);
        await loadMessages();
    }
}

async function deleteMessage(msgId) {
    const { isConfirmed } = await Swal.fire({ title: 'Delete message?', icon: 'warning', showCancelButton: true });
    if (isConfirmed && selectedConv) {
        await DataService.deleteMessage(selectedConv.id, msgId);
        await loadMessages();
    }
}

async function showNewConvoModal() {
    if (!currentUser) return Swal.fire('Error', 'Sign in first', 'error');
    
    const allUsers = await DataService.getUsers();
    const otherUsers = allUsers.filter(u => u.id !== currentUser.uid);
    
    const userOptions = otherUsers.map(u => 
        `<div class="form-check">
            <input class="form-check-input" type="checkbox" value="${u.id}" id="user-${u.id}">
            <label class="form-check-label d-flex align-items-center gap-2" for="user-${u.id}">
                <img src="${u.photoURL || './defaultuser.png'}" class="profile-img-sm" alt="">
                ${u.displayName || 'Unknown'} <small class="text-muted">@${u.handle || 'no-handle'}</small>
            </label>
        </div>`
    ).join('');
    
    const { value: formValues } = await Swal.fire({
        title: 'New Conversation',
        html: `
            <div class="mb-3"><input id="conv-name" class="form-control" placeholder="Group name (optional)"></div>
            <div class="mb-3"><input id="conv-desc" class="form-control" placeholder="Description (optional)"></div>
            <div class="text-start"><label class="form-label">Select users:</label>${userOptions}</div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => {
            const selected = [...document.querySelectorAll('.swal2-popup input[type="checkbox"]:checked')].map(el => el.value);
            return {
                name: document.getElementById('conv-name').value || null,
                description: document.getElementById('conv-desc').value || null,
                users: selected
            };
        }
    });
    
    if (!formValues) return;
    
    if (formValues.users.length === 0) {
        await DataService.createConversation([currentUser.uid], 'Notes', formValues.description);
    } else {
        const participants = [currentUser.uid, ...formValues.users];
        await DataService.createConversation(participants, formValues.name, formValues.description);
    }
    
    await loadConversations();
    Swal.fire('Success', 'Conversation created', 'success');
}

async function showAddMemberModal() {
    if (!selectedConv || !currentUser) return;
    
    const allUsers = await DataService.getUsers();
    const availableUsers = allUsers.filter(u => !selectedConv.participants.includes(u.id));
    
    if (availableUsers.length === 0) {
        return Swal.fire('Info', 'All users are already in this conversation', 'info');
    }
    
    const userOptions = availableUsers.map(u => `<option value="${u.id}">${u.displayName || 'Unknown'} (@${u.handle || 'no-handle'})</option>`).join('');
    
    const { value: userId } = await Swal.fire({
        title: 'Add Member',
        input: 'select',
        inputOptions: Object.fromEntries(availableUsers.map(u => [u.id, `${u.displayName} (@${u.handle || 'no-handle'})`])),
        showCancelButton: true
    });
    
    if (!userId) return;
    
    const newParticipants = [...selectedConv.participants, userId];
    await DataService.updateConversation(selectedConv.id, { participants: newParticipants });
    await loadConversations();
    Swal.fire('Success', 'Member added', 'success');
}

async function sendMessage() {
    if (!selectedConv || !currentUser) return;
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;
    
    await DataService.sendMessage(selectedConv.id, content, currentUser.uid);
    input.value = '';
    await loadMessages();
}

async function init() {
    await initPage(AuthService);
    
    AuthService.onAuthChange(async ({ user, profile }) => {
        currentUser = user;
        currentProfile = profile;
        
        if (user) {
            isAdmin = await AuthService.isAdmin(user.uid);
            document.getElementById('create-thread-btn').classList.remove('d-none');
            document.getElementById('messages-auth').classList.add('d-none');
            document.getElementById('messages-content').classList.remove('d-none');
            await loadConversations();
        } else {
            isAdmin = false;
            document.getElementById('create-thread-btn').classList.add('d-none');
            document.getElementById('messages-auth').classList.remove('d-none');
            document.getElementById('messages-content').classList.add('d-none');
        }
    });
    
    await loadForums();
    
    document.getElementById('create-thread-btn').onclick = () => document.getElementById('create-form').classList.remove('d-none');
    document.getElementById('cancel-create').onclick = () => document.getElementById('create-form').classList.add('d-none');
    document.getElementById('new-conv-btn').onclick = showNewConvoModal;
    document.getElementById('add-member-btn').onclick = showAddMemberModal;
    document.getElementById('send-btn').onclick = sendMessage;
    document.getElementById('message-input').onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
    // Initialize Quill for thread description
    if (document.getElementById('thread-desc-editor')) {
        window.threadDescQuill = new Quill('#thread-desc-editor', { theme: 'snow', modules: { toolbar: [['bold','italic','underline'],['link'],['clean']] } });
    }
    
    document.getElementById('thread-form').onsubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) return Swal.fire('Error', 'Sign in first', 'error');
        try {
            const desc = window.threadDescQuill ? window.threadDescQuill.root.innerHTML : '';
            await DataService.createForum({
                title: document.getElementById('thread-title').value,
                description: desc,
                category: document.getElementById('thread-category').value,
                tags: document.getElementById('thread-tags').value.split(',').map(t => t.trim()).filter(Boolean)
            }, currentUser.uid);
            document.getElementById('create-form').classList.add('d-none');
            document.getElementById('thread-form').reset();
            if (window.threadDescQuill) window.threadDescQuill.root.innerHTML = '';
            await loadForums();
            Swal.fire('Success', 'Thread created', 'success');
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    };
}

init();
