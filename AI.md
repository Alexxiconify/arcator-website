### Project Constraints & Architectural Strategy

**Scale:** ~100 users, ~500 documents. Never over-engineer for growth that won't happen.

**Invariants:**
- No build tools (Webpack/Vite), no server-side code
- Single `app.js` using ES modules in-browser — keep it monolithic
- Plain HTML pages for routing — no client-side router

**Core directive:** Prefer native browser APIs and existing libraries over custom code. Before writing logic, ask whether Firebase, Alpine.js, or another loaded library already does it. If a feature requires more than ~20 lines of custom code, reconsider whether a loaded library handles it instead.

**Data:**
- Fetching full collections on load is intentional — O(N) reads are acceptable at this scale, do not add pagination
- Client-side joins (fetch thread → fetch author) are preferred over denormalization
- Use `writeBatch` for multi-document writes; `onSnapshot` for live admin views

**Stack:**
- **Firebase** — Auth (Google, GitHub, email/password, Discord) + Firestore
- **Alpine.js** — reactive UI state, modals, tabs, data binding
- **PicoCSS v2** — base styles; `styles.css` adds a Bootstrap-compatible utility layer on top
- **Bootstrap Icons** — icon library
- **Quill.js** — rich text editor for forums
- **SweetAlert2** — modal dialogs and prompts
- **DOMPurify** — HTML sanitization for user-generated content
- **Marked** — markdown-to-HTML for wiki/pages content
