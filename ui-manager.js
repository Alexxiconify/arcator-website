import {showMessageBox} from './utils.js';

class UIManager {
    constructor() {
        this.currentSection = null;
        this.sections = new Map();
        this.loadingElement = null;
    }

    registerSection(id, element, title, subtitle) {
        this.sections.set(id, {
            element,
            title,
            subtitle
        });
    }

    setLoadingElement(element) {
        this.loadingElement = element;
    }

    showLoading() {
        if (this.loadingElement) {
            this.loadingElement.style.display = 'flex';
            this.sections.forEach(({element}) => {
                if (element !== this.loadingElement) {
                    element.style.display = 'none';
                }
            });
        }
    }

    hideLoading() {
        if (this.loadingElement) {
            this.loadingElement.style.display = 'none';
        }
    }

    showSection(sectionId) {
        const section = this.sections.get(sectionId);
        if (!section) {
            console.error(`Section ${sectionId} not found`);
            return;
        }

        this.sections.forEach(({element}) => {
            element.style.display = 'none';
        });

        section.element.style.display = 'block';
        this.currentSection = sectionId;


        const heroTitle = document.getElementById('hero-title');
        const heroSubtitle = document.getElementById('hero-subtitle');

        if (heroTitle && heroSubtitle) {
            heroTitle.textContent = section.title;
            heroSubtitle.textContent = section.subtitle;
        }
    }

    getCurrentSection() {
        return this.currentSection;
    }

    updateElement(elementId, value, attribute = 'textContent') {
        const element = document.getElementById(elementId);
        if (element) {
            if (attribute === 'src' || attribute === 'href') {
                element[attribute] = value;
            } else {
                element.textContent = value;
            }
        }
    }

    showMessage(message, isError = false, duration = 2000) {
        showMessageBox(message, isError);
        if (duration > 0) {
            setTimeout(() => {
                const messageBox = document.getElementById('message-box');
                if (messageBox) {
                    messageBox.style.display = 'none';
                }
            }, duration);
        }
    }
}

export const uiManager = new UIManager();