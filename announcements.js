import {
    addDoc, collection, db, deleteDoc, doc,
    getCurrentUser, getUserProfileFromFirestore, onSnapshot, orderBy, query, serverTimestamp
} from "./firebase-init.js";
import {showCustomConfirm, showMessageBox} from "./utils.js";
import {HARD_CODED_ADMIN_UID} from "./constants.js";
import {parseEmojis, parseMentions} from "./index.js";

const getEl = id => document.getElementById(id);
const createSection = getEl("create-announcement-section");
const createForm = getEl("create-announcement-form");
const contentInput = getEl("announcement-content");
const listEl = getEl("announcements-list");
const noMsgEl = getEl("no-announcements-message");

let unsubscribe = null;

export async function postAnnouncement(content) {
    const user = getCurrentUser();
    if (user?.uid !== HARD_CODED_ADMIN_UID) return showMessageBox("No permission to post announcements.", true);
    if (!db) return showMessageBox("Database not initialized.", true);
    if (!content.trim()) return showMessageBox("Content cannot be empty.", true);

    try {
        await addDoc(collection(db, 'announcements'), {
            authorId: user.uid, authorHandle: user.handle, authorDisplayName: user.displayName,
            authorPhotoURL: user.photoURL || "https://placehold.co/32x32/1F2937/E5E7EB?text=AV",
            content, createdAt: serverTimestamp()
        });
        showMessageBox("Announcement posted!", false);
        createForm?.reset();
    } catch (e) {
        console.error("postAnnouncement:", e);
        showMessageBox(`Error: ${e.message}`, true);
    }
}

export async function deleteAnnouncement(id) {
    const user = getCurrentUser();
    if (user?.uid !== HARD_CODED_ADMIN_UID) return showMessageBox("No permission to delete.", true);
    if (!db) return showMessageBox("Database not initialized.", true);

    if (!await showCustomConfirm("Delete this announcement?", "This cannot be undone.")) {
        return showMessageBox("Cancelled.", false);
    }

    try {
        await deleteDoc(doc(db, 'announcements', id));
        showMessageBox("Deleted!", false);
    } catch (e) {
        console.error("deleteAnnouncement:", e);
        showMessageBox(`Error: ${e.message}`, true);
    }
}

export function renderAnnouncements() {
    unsubscribe?.();
    if (!db || !listEl) return console.error("DB or list not ready");

    const user = getCurrentUser();
    createSection?.classList.toggle("hidden", !user?.isAdmin);

    const q = query(collection(db, 'announcements'), orderBy("createdAt", "desc"));

    unsubscribe = onSnapshot(q, async snap => {
        listEl.innerHTML = "";
        noMsgEl && (noMsgEl.style.display = snap.empty ? "block" : "none");

        const profiles = new Map();
        for (const uid of new Set(snap.docs.map(d => d.data().authorId))) {
            const p = await getUserProfileFromFirestore(uid);
            if (p) profiles.set(uid, p);
        }

        for (const docSnap of snap.docs) {
            const data = docSnap.data();
            const profile = profiles.get(data.authorId) || {};
            const name = profile.displayName || data.authorDisplayName || "Admin";
            const handle = profile.handle || data.authorHandle || "N/A";
            const photo = profile.photoURL || "https://placehold.co/32x32/1F2937/E5E7EB?text=AV";
            const date = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString() : "N/A";

            const el = document.createElement("div");
            el.className = "bg-gray-800 p-4 rounded-lg shadow-md mb-4";
            el.innerHTML = `
                <div class="flex items-center mb-2">
                    <img src="${photo}" alt="Admin" class="w-8 h-8 rounded-full mr-3 object-cover">
                    <div>
                        <p class="font-semibold text-gray-200">${name} <span class="text-gray-400 text-xs">(@${handle})</span></p>
                        <p class="text-xs text-gray-500">${date}</p>
                    </div>
                </div>
                <p class="text-gray-300 mb-2">${parseMentions(parseEmojis(data.content))}</p>
                ${user?.isAdmin ? `<button class="delete-announcement-btn text-red-400 hover:text-red-500 float-right" data-id="${docSnap.id}"><i class="fas fa-trash-alt"></i> Delete</button>` : ""}
            `;
            listEl.appendChild(el);
        }

        listEl.querySelectorAll(".delete-announcement-btn").forEach(btn => {
            btn.onclick = e => deleteAnnouncement(e.currentTarget.dataset.id);
        });
    }, e => {
        console.error("renderAnnouncements:", e);
        if (listEl) listEl.innerHTML = `<p class="text-red-500 text-center">Error: ${e.message}</p>`;
        noMsgEl && (noMsgEl.style.display = "none");
    });
}

export function unsubscribeAnnouncementsListener() { unsubscribe?.(); unsubscribe = null; }

export async function handlePostAnnouncement(e) {
    e.preventDefault();
    const content = contentInput?.value.trim();
    if (!content) return showMessageBox("Enter content.", true);
    await postAnnouncement(content);
}

export function attachAnnouncementEventListeners() {
    createForm?.addEventListener("submit", handlePostAnnouncement);
}