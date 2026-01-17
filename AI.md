### Project Constraints & Architectural Strategy

**1. Core Philosophy: "Native Simplicity"**

* **Constraint:** ~100 users maximum; ~500 documents maximum.
* **Goal:** Maximize Firebase features to minimize custom code.
* **Invariant:** No build tools (Webpack/Vite) or server-side scaffolding.

**2. Architecture: "Thick Client"**

* 
**Structure:** The application relies on standard ES modules directly in the browser.


* 
**Routing:** Simple HTML pages (`index.html`, `forms.html`) are used instead of complex client-side routing logic, keeping navigation native and simple.


* 
**State:** Alpine.js stores handle ephemeral state (`auth`, `users`) without the need for complex state management libraries like Redux.



**3. Security Model: "Rule-Based Logic"**

* 
**Authentication:** Rely entirely on Firebase Auth providers (Google, Discord, etc.).


**4. Data Strategy: "Atomic & Real-Time"**

* 
**Integrity:** Use Firestore **Batched Writes** (`writeBatch`) for multi-document updates (e.g., creating a post + incrementing a counter) to ensure data consistency without backend code.


* **Fetching:**
* 
*Accepted Pattern:* Fetching entire collections (e.g., all users, all threads) is acceptable at this scale and simplifies logic by removing pagination.


* 
*Accepted Pattern:* Client-side joins (fetching a thread, then fetching the author) are preferred over data denormalization to keep write logic simple.


* 
**Updates:** Leverage `onSnapshot` for "mission control" views (like the Admin Dashboard) to provide real-time updates with zero extra code overhead.



**5. Accepted Trade-offs**

* **Efficiency vs. Simplicity:** We accept O(N) read costs (reading all documents on load) because N is small (<100). This avoids overcomplexity.

**6. Libraries & Tools**

The following external libraries and services are utilized to minimize custom implementation and leverage robust, existing solutions:

* **Firebase SDK (v10.7.0):**
* **Auth:** Handles authentication flows including email/password, Google, GitHub, Twitter, and Apple sign-ins.
* **Firestore:** Provides the NoSQL database for real-time data synchronization and persistence.

* **Alpine.js (v3.13.3):** A lightweight reactive framework used for managing UI state and interactions (e.g., modals, tabs, data binding) directly in the markup.
* **Bootstrap 5 (v5.3.3):** A CSS framework providing responsive layout grids, pre-styled components (buttons, navbars, cards), and utility classes.
* **Bootstrap Icons (v1.11.3):** A comprehensive icon library used for UI elements throughout the application.
* **Quill.js (v2.0.2):** A rich text editor used for composing forum threads and comments, ensuring consistent content formatting.
* **SweetAlert2 (v11):** A library for creating responsive, customizable replacement popups for standard JavaScript alerts, confirms, and prompts.
* **Day.js (v1+):** A minimalist JavaScript library for parsing, validating, manipulating, and formatting dates and times.
* **DOMPurify (v3.0.8):** A sanitizer library used to clean HTML content (e.g., in forum posts) to prevent Cross-Site Scripting (XSS) attacks.
* **Marked (via CDN):** A markdown parser used to convert markdown text into HTML for rendering page content.
