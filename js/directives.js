// Registered before Alpine.start() via alpine:init (auth.js controls start timing).

import { safePhoto } from './sanitize.js';

class UserAvatar extends HTMLElement {
  static observedAttributes = ['photo', 'name'];
  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }
  render() {
    const name = this.getAttribute('name') || '?';
    const photo = safePhoto(this.getAttribute('photo'));
    const hue = (name.charCodeAt(0) * 7) % 360;
    this.style.setProperty('--hue', hue);
    if (photo) {
      const img = document.createElement('img');
      img.src = photo;
      img.alt = '';
      img.addEventListener('error', () => {
        this.replaceChildren(Object.assign(document.createElement('span'), { textContent: name[0] }));
      }, { once: true });
      this.replaceChildren(img);
    } else {
      this.replaceChildren(Object.assign(document.createElement('span'), { textContent: name[0] }));
    }
  }
}
customElements.define('user-avatar', UserAvatar);

class ParsedEmoji extends HTMLElement {
  static observedAttributes = ['unified'];
  connectedCallback() { this.#render(); }
  attributeChangedCallback() { this.#render(); }
  #render() {
    const key = this.getAttribute('unified') || '';
    this.innerHTML = window.twemoji ? twemoji.parse(key) : key;
  }
}
customElements.define('parsed-emoji', ParsedEmoji);

document.addEventListener('alpine:init', () => {

  // x-view="expr" — reactively resolves a template ID, clones it into the host element,
  // initializes it, and re-renders when the expression changes.
  Alpine.directive('view', (el, { expression }, { effect, evaluateLater, cleanup }) => {
    const get = evaluateLater(expression);
    let mounted = [];
    let currentId = null;
    const unmount = () => {
      mounted.forEach(n => { Alpine.destroyTree(n); n.remove(); });
      mounted = [];
      currentId = null;
    };
    effect(() => get(id => {
      if (id === currentId) return;
      unmount();
      if (!id) return;
      const tmpl = document.getElementById(id.split(':')[0]);
      if (!tmpl) return;
      Alpine.mutateDom(() => {
        const frag = tmpl.content.cloneNode(true);
        mounted = [...frag.children];
        el.append(frag);
        mounted.forEach(c => Alpine.initTree(c));
      });
      currentId = id;
    }));
    cleanup(unmount);
  });

  // x-err="expr" — accessible inline error message.
  Alpine.directive('err', (el, { expression }, { effect, evaluateLater }) => {
    el.classList.add('err');
    el.setAttribute('role', 'alert');
    el.style.display = 'block';
    el.style.marginTop = '.5rem';
    el.hidden = true;
    const get = evaluateLater(expression);
    effect(() => get(v => {
      el.textContent = v || '';
      el.hidden = !v;
    }));
  });

  // x-tmpl="id" — clone a <template id="X"> into the host element and initialize it.
  // If the cloned content has its own x-data it creates a fresh scope; without x-data
  // it inherits the host element's scope via the DOM ancestry chain.
  Alpine.directive('tmpl', (el, { expression }) => {
    const tmpl = document.getElementById(expression);
    if (!tmpl) return;
    Alpine.mutateDom(() => {
      el.append(tmpl.content.cloneNode(true));
      Array.from(el.children).forEach(c => Alpine.initTree(c));
    });
  });

  // x-md="expr" — reactive markdown render with DOMPurify + broken-image fallback.
  Alpine.directive('md', (el, { expression }, { effect, evaluateLater }) => {
    const get = evaluateLater(expression);
    effect(() => get(v => {
      const body = v?.body !== undefined ? v.body : v;
      const isHTML = v?.bodyIsHTML ?? false;
      const key = (isHTML ? '1' : '0') + '\0' + body;
      if (el._md === key) return;
      el._md = key;
      el.innerHTML = md(body || '', { html: isHTML });
      if (window.twemoji) twemoji.parse(el);
      el.querySelectorAll('img').forEach(img => {
        if (!img._errWired) { img._errWired = true; img.onerror = () => img.replaceWith('[broken image]'); }
      });
      if (!el._spoilerWired) {
        el._spoilerWired = true;
        el.addEventListener('click', e => e.target.closest('.spoiler')?.classList.toggle('revealed'));
      }
    }));
  });

});

export { };
