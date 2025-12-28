import {showMessageBox} from './utils.js';

class UIManager {
    currentSection = null;
    sections = new Map();
    loadingElement = null;

    registerSection(id, element, title, subtitle) {
        this.sections.set(id, {element, title, subtitle});
    }

    setLoadingElement(element) { this.loadingElement = element; }

    showLoading() {
        if (!this.loadingElement) return;
        this.loadingElement.style.display = 'flex';
        this.sections.forEach(({element}) => {
            if (element !== this.loadingElement) element.style.display = 'none';
        });
    }

    hideLoading() {
        if (this.loadingElement) this.loadingElement.style.display = 'none';
    }

    showSection(sectionId) {
        const section = this.sections.get(sectionId);
        if (!section) return console.error(`Section ${sectionId} not found`);

        this.sections.forEach(({element}) => element.style.display = 'none');
        section.element.style.display = 'block';
        this.currentSection = sectionId;

        const heroTitle = document.getElementById('hero-title');
        const heroSubtitle = document.getElementById('hero-subtitle');
        if (heroTitle) heroTitle.textContent = section.title;
        if (heroSubtitle) heroSubtitle.textContent = section.subtitle;
    }

    getCurrentSection() { return this.currentSection; }

    updateElement(id, value, attr = 'textContent') {
        const el = document.getElementById(id);
        if (el) el[attr === 'src' || attr === 'href' ? attr : 'textContent'] = value;
    }

    showMessage(msg, isError = false) { showMessageBox(msg, isError); }
}

export const uiManager = new UIManager();