

const messageQueue = [];
let messageTimeout = null;

export function showMessageBox(message, isError = false, duration = 3000) {
    messageQueue.push({message, isError, duration});
    if (!messageTimeout) processMessageQueue();
}

function processMessageQueue() {
    if (messageQueue.length === 0) {
        messageTimeout = null;
        return;
    }

    const {message, isError, duration} = messageQueue.shift();
    const messageBox = getOrCreateMessageBox();

    messageBox.textContent = message;
    messageBox.className = `message-box ${isError ? 'error' : 'success'}`;
    messageBox.style.display = 'block';

    messageTimeout = setTimeout(() => {
        messageBox.style.display = 'none';
        processMessageQueue();
    }, duration);
}

function getOrCreateMessageBox() {
    let messageBox = document.getElementById('message-box');
    if (!messageBox) {
        messageBox = document.createElement('div');
        messageBox.id = 'message-box';
        messageBox.className = 'message-box';
        document.body.appendChild(messageBox);

        if (!document.getElementById('message-box-styles')) {
            const style = document.createElement('style');
            style.id = 'message-box-styles';
            style.textContent = `
                .message-box {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 500;
                    z-index: 9999;
                    display: none;
                    animation: slide-down 0.3s ease;
                }
                .message-box.success {
                    background: #10B981;
                    color: white;
                }
                .message-box.error {
                    background: #EF4444;
                    color: white;
                }
                @keyframes slide-down {
                    from { transform: translate(-50%, -100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    return messageBox;
}

export function showCustomConfirm(message, description = '') {
    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'custom-confirm-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${message}</h3>
                ${description ? `<p>${description}</p>` : ''}
                <div class="button-group">
                    <button class="confirm-btn">Confirm</button>
                    <button class="cancel-btn">Cancel</button>
                </div>
            </div>
        `;

        if (!document.getElementById('confirm-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'confirm-modal-styles';
            style.textContent = `
                .custom-confirm-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                }
                .custom-confirm-modal .modal-content {
                    background: var(--color-bg-card, #fff);
                    padding: 24px;
                    border-radius: 12px;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                }
                .custom-confirm-modal h3 {
                    margin: 0 0 12px;
                    font-size: 1.25rem;
                    color: var(--color-text-header, #111);
                }
                .custom-confirm-modal p {
                    margin: 0 0 24px;
                    color: var(--color-text-secondary, #666);
                }
                .custom-confirm-modal .button-group {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                }
                .custom-confirm-modal button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .custom-confirm-modal .confirm-btn {
                    background: var(--color-button-red-bg, #EF4444);
                    color: white;
                }
                .custom-confirm-modal .cancel-btn {
                    background: var(--color-button-secondary-bg, #6B7280);
                    color: white;
                }
                .custom-confirm-modal button:hover {
                    transform: translateY(-1px);
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(modal);

        const cleanup = () => {
            modal.remove();
            document.removeEventListener('keydown', handleKeyPress);
        };

        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
            if (e.key === 'Enter') {
                cleanup();
                resolve(true);
            }
        };

        document.addEventListener('keydown', handleKeyPress);

        modal.querySelector('.confirm-btn').onclick = () => {
            cleanup();
            resolve(true);
        };

        modal.querySelector('.cancel-btn').onclick = () => {
            cleanup();
            resolve(false);
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(false);
            }
        };
    });
}

export function setupTabs(containerSelector, tabBtnSelector, tabContentSelector, onChange) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const tabButtons = container.querySelectorAll(tabBtnSelector);
    const tabContents = document.querySelectorAll(tabContentSelector);

    function setActiveTab(tabId) {
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });

        tabContents.forEach(content => {
            content.classList.toggle('active', content.getAttribute('data-tab') === tabId);
        });

        if (onChange) onChange(tabId);
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            setActiveTab(tabId);
        });
    });

    const initialTab = tabButtons[0]?.getAttribute('data-tab');
    if (initialTab) setActiveTab(initialTab);
}

export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Object) {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, deepClone(value)])
        );
    }
    return obj;
}

export function formatDate(date, format = 'full') {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';

    const options = {
        full: {dateStyle: 'full', timeStyle: 'long'},
        short: {dateStyle: 'short', timeStyle: 'short'},
        time: {timeStyle: 'short'}
    };

    try {
        return new Intl.DateTimeFormat(undefined, options[format]).format(d);
    } catch (error) {
        console.error('Date formatting error:', error);
        return d.toLocaleString();
    }
}

export function trimText(text, maxLength = 50) {
    if (text?.length > maxLength) {
        return text.substring(0, maxLength) + '...';
    }
    return text || '';
}

export function safeJSONParse(str, fallback = null) {
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function handleError(error, context = '') {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error);
    showMessageBox(error.message || 'An error occurred', true);
}

export function validateInput(value, {required = false, minLength, maxLength, pattern, type} = {}) {
    if (required && !value) return 'This field is required';
    if (minLength && value.length < minLength) return `Minimum length is ${minLength}`;
    if (maxLength && value.length > maxLength) return `Maximum length is ${maxLength}`;
    if (pattern && !pattern.test(value)) return 'Invalid format';
    if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email';
    return null;
}

export function createElementFromHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

export function showThemeModal() {

    const modal = document.getElementById('custom-theme-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        return;
    }
    showMessageBox('Theme editor is available in Settings → Themes', false);
}

Object.assign(window, {
    showMessageBox,
    showCustomConfirm,
    setupTabs,
    debounce,
    deepClone,
    formatDate,
    trimText,
    safeJSONParse,
    formatBytes,
    handleError,
    validateInput,
    createElementFromHTML,
    showThemeModal
});