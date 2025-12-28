

let emojiData = [];
let filteredEmojis = [];
let currentCategory = 'all';
let EMOJI_MAP = {};
let EMOJI_MAP_LOADED = false;
let EMOJI_LOAD_PROMISE = null;


const EMOJI_CATEGORIES = [
  {key: 'smileys', label: 'Smileys'},
  {key: 'animals', label: 'Animals'},
  {key: 'food', label: 'Food'},
  {key: 'activities', label: 'Activities'},
  {key: 'travel', label: 'Travel'},
  {key: 'objects', label: 'Objects'},
  {key: 'symbols', label: 'Symbols'},
  {key: 'flags', label: 'Flags'},
  {key: 'other', label: 'Other'},
];


async function loadEmojis() {
    try {
        const response = await fetch('./emoji.json');
        emojiData = await response.json();
        return emojiData;
    } catch (error) {
        console.error('Failed to load emojis:', error);
        return [];
    }
}


function loadEmojiMap() {
    if (EMOJI_LOAD_PROMISE) return EMOJI_LOAD_PROMISE;
    EMOJI_LOAD_PROMISE = fetch("./emoji.json")
        .then((res) => res.json())
        .then((data) => {
            EMOJI_MAP = {};
            data.forEach((emoji) => {
                EMOJI_MAP[emoji.shortcode] = emoji;
            });
            EMOJI_MAP_LOADED = true;
        })
        .catch((error) => {
            console.error("Failed to load emoji map:", error);
            EMOJI_MAP_LOADED = true;
        });
    return EMOJI_LOAD_PROMISE;
}


export function toggleEmojiPicker(pickerId = "emoji-picker") {
  const picker = document.getElementById(pickerId);
  if (picker.classList.contains("hidden")) {
    showEmojiPicker(pickerId);
  } else {
    hideEmojiPicker(pickerId);
  }
}


export function showEmojiPicker(pickerId = "emoji-picker") {
  const picker = document.getElementById(pickerId);
  if (!picker) {
    console.error("Emoji picker element not found:", pickerId);
    return;
  }
  picker.classList.remove("hidden");
  if (emojiData.length === 0) {
    loadEmojiData().then(() => {
      filteredEmojis = emojiData;
      renderEmojis(filteredEmojis, pickerId);
      renderEmojiTabs(pickerId);
      positionEmojiPicker(pickerId);
    });
  } else {
    filteredEmojis = emojiData;
    renderEmojis(filteredEmojis, pickerId);
    renderEmojiTabs(pickerId);
    positionEmojiPicker(pickerId);
  }
  setTimeout(() => {
    const searchInput = picker.querySelector(".emoji-search");
    if (searchInput) searchInput.focus();
  }, 100);
}


function positionEmojiPicker(pickerId = "emoji-picker") {
  const picker = document.getElementById(pickerId);
  const container = picker?.closest(".emoji-input-container");

  if (!picker || !container) return;


  picker.classList.remove("position-above", "position-left", "position-right");


  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const containerRect = container.getBoundingClientRect();


  const wasHidden = picker.classList.contains("hidden");
  if (wasHidden) {
    picker.classList.remove("hidden");
    picker.style.visibility = "hidden";
  }

  const pickerRect = picker.getBoundingClientRect();
  const pickerHeight = pickerRect.height;
  const pickerWidth = pickerRect.width;


  if (wasHidden) {
    picker.classList.add("hidden");
    picker.style.visibility = "";
  }


  const spaceBelow = viewportHeight - containerRect.bottom;
  const spaceAbove = containerRect.top;


  if (spaceBelow < pickerHeight && spaceAbove > pickerHeight) {
    picker.classList.add("position-above");
  }


  if (containerRect.left + pickerWidth > viewportWidth) {
    picker.classList.add("position-right");
  } else if (containerRect.right - pickerWidth < 0) {
    picker.classList.add("position-left");
  }
}


export function hideEmojiPicker(pickerId = "emoji-picker") {
  const picker = document.getElementById(pickerId);
  if (picker) {
    picker.classList.add("hidden");
  }
}


export function renderEmojis(emojis, pickerId = "emoji-picker") {
  const picker = document.getElementById(pickerId);
  const emojiList = picker?.querySelector(".emoji-list");
  if (!emojiList) {
    console.error("Emoji list element not found in picker:", pickerId);
    return;
  }
  const filtered = (filteredEmojis.length ? filteredEmojis : emojiData).filter(e => (e.category || 'other') === currentCategory);
  const cols = 8;
  let html = '<table class="emoji-table"><tbody>';
  for (let i = 0; i < filtered.length; i += cols) {
    html += '<tr>';
    for (let j = 0; j < cols; j++) {
      const emoji = filtered[i + j];
        emoji.emoji = undefined;
      if (emoji) {
        html += `<td class="emoji-item" title="${emoji.name}" onclick="insertEmoji(':${emoji.name}:', '${pickerId}')">${emoji.emoji}</td>`;
      } else {
        html += '<td></td>';
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  emojiList.innerHTML = html;
}


export function insertEmoji(
  emojiCode,
  pickerId = "emoji-picker",
  targetId = null,
) {

  let targetElement = null;

  if (targetId) {
    targetElement = document.getElementById(targetId);
  } else {

    const picker = document.getElementById(pickerId);
    if (picker) {
      const container = picker.closest(".emoji-input-container");
      if (container) {
        targetElement = container.querySelector('textarea, input[type="text"]');
      }
    }
  }

  if (!targetElement) {
    console.error("Target input/textarea not found for emoji insertion");
    return;
  }

  const start = targetElement.selectionStart;
  const end = targetElement.selectionEnd;
  const text = targetElement.value;


  targetElement.value = text.substring(0, start) + emojiCode + text.substring(end);


  const newCursorPos = start + emojiCode.length;
  targetElement.setSelectionRange(newCursorPos, newCursorPos);


  targetElement.focus();


  targetElement.dispatchEvent(new Event("input", {bubbles: true}));


  hideEmojiPicker(pickerId);
}


export function filterEmojis(searchTerm, pickerId = "emoji-picker") {
  if (!searchTerm.trim()) {
    filteredEmojis = emojiData;
  } else {
    filteredEmojis = emojiData.filter((emoji) =>
      emoji.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  renderEmojis(filteredEmojis, pickerId);
  renderEmojiTabs(pickerId);
}


export function createEmojiPickerHTML(pickerId = "emoji-picker") {
  return `
    <div id="${pickerId}" class="emoji-picker hidden">
      <div class="emoji-picker-header">
        <input type="text" id="${pickerId}-search" placeholder="Search emojis..." class="emoji-search">
      </div>
      <div class="emoji-tabs"></div>
      <div id="emoji-list" class="emoji-list"></div>

      <!-- Media Picker Section -->
      <div class="media-picker">
        <div class="media-picker-tabs">
          <button class="media-tab active" data-tab="gif">🎬 GIF</button>
          <button class="media-tab" data-tab="url">🔗 URL</button>
          <button class="media-tab" data-tab="youtube">📺 YouTube</button>
        </div>

        <!-- GIF Tab -->
        <div id="gif-tab" class="media-tab-content active">
          <div class="gif-search-container">
            <input type="text" class="gif-search-input" placeholder="Search GIFs..." id="gif-search-input">
          </div>
          <div class="gif-results" id="gif-results">
            <div class="media-loading">Search for GIFs...</div>
          </div>
        </div>

        <!-- URL Tab -->
        <div id="url-tab" class="media-tab-content">
          <div class="url-input-container">
            <input type="url" class="url-input" placeholder="Enter media URL (image, video, audio)..." id="media-url-input">
            <div class="url-preview" id="url-preview"></div>
            <div class="media-preview" id="media-preview"></div>
          </div>
          <button class="media-insert-btn" id="insert-media-btn" disabled>Insert Media</button>
        </div>

        <!-- YouTube Tab -->
        <div id="youtube-tab" class="media-tab-content">
          <div class="url-input-container">
            <input type="url" class="url-input" placeholder="Enter YouTube URL..." id="youtube-url-input">
            <div class="url-preview" id="youtube-preview"></div>
            <div class="youtube-preview" id="youtube-embed-preview"></div>
          </div>
          <button class="media-insert-btn" id="insert-youtube-btn" disabled>Insert YouTube Video</button>
        </div>
      </div>
    </div>
  `;
}


export function createEmojiInputContainer(
  inputId,
  pickerId = "emoji-picker",
  inputType = "textarea",
  placeholder = "",
  className = "",
) {
  const inputTag = inputType === "textarea" ? "textarea" : "input";
  const inputAttributes = inputType === "textarea" ? 'rows="4"' : 'type="text"';

  return `
    <div class="emoji-input-container">
      <${inputTag}
        id="${inputId}"
        ${inputAttributes}
        placeholder="${placeholder}"
        class="${className}"
        required
      ></${inputTag}>
      <button type="button" class="emoji-picker-btn" onclick="toggleEmojiPicker('${pickerId}')" title="Add emoji">
        😊
      </button>
      ${createEmojiPickerHTML(pickerId)}
    </div>
  `;
}


export function initEmojiPicker() {}


function initMediaPicker(pickerId) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;


  setupMediaPickerEventListeners(pickerId);


  initGifSearch(pickerId);


  initUrlValidation(pickerId);


  initYouTubeValidation(pickerId);
}


function initGifSearch(pickerId) {
  const searchInput = document.getElementById(`${pickerId}-gif-search`);
  const searchBtn = document.getElementById(`${pickerId}-gif-search-btn`);

  if (!searchInput || !searchBtn) return;

  let lastQuery = '';


  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (q && q !== lastQuery) {
      lastQuery = q;
      searchGifs(q, pickerId);
    }
  });


  searchBtn.addEventListener('click', () => {
    const q = searchInput.value.trim();
    if (q) {
      lastQuery = q;
      searchGifs(q, pickerId);
    }
  });


  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (q) {
        lastQuery = q;
        searchGifs(q, pickerId);
      }
    }
  });
}

let g;
g.images.fixed_height = undefined;

g.images.fixed_height = undefined;


async function searchGifs(query, pickerId) {
  const resultsEl = document.getElementById(`${pickerId}-gif-results`);
  if (!resultsEl) return;


  resultsEl.innerHTML = '<div style="text-align: center; padding: 1rem;">Searching...</div>';

  try {

    const config = await import('./sensitive/api-keys.js');
    const apiKey = config.default.GIPHY_API_KEY;

    const url = `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&api_key=${apiKey}&limit=20&rating=pg`;

    const response = await fetch(url);
      if (!response.ok) {
          new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      const gifs = data.data.map(g => ({
        url: g.images.fixed_height.url,
        original: g.images.original.url,
        title: g.title || 'GIF'
      }));
      renderGifResults(gifs, pickerId);
    } else {
      resultsEl.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--color-text-secondary);">No GIFs found</div>';
    }
  } catch (error) {
    console.error('Error searching GIFs:', error);
    resultsEl.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--color-text-secondary);">Error loading GIFs</div>';
  }
}


window.insertGif = function (gifUrl, pickerId) {
  const container = document
    .querySelector(`#${pickerId}`)
    .closest(".emoji-input-container");
  const targetInput = container.querySelector("textarea, input");

  if (targetInput) {
    const markdown = `![GIF](${gifUrl})`;
    insertAtCursor(targetInput, markdown);
    hideEmojiPicker(pickerId);
  }
};


function initUrlValidation(pickerId) {
  const urlInput = document.getElementById(`${pickerId}-url-input`);
  const urlPreview = document.getElementById(`${pickerId}-url-preview`);
  const mediaPreview = document.getElementById(`${pickerId}-media-preview`);
  const insertBtn = document.getElementById(`${pickerId}-insert-media-btn`);

  if (!urlInput || !urlPreview || !mediaPreview || !insertBtn) return;

  let validationTimeout;

  urlInput.addEventListener("input", (e) => {
    clearTimeout(validationTimeout);
    const url = e.target.value.trim();

    if (!url) {
      urlPreview.innerHTML = "";
      mediaPreview.innerHTML = "";
      insertBtn.disabled = true;
      return;
    }

    urlPreview.innerHTML = "Validating...";
    urlPreview.className = "url-preview";
    mediaPreview.innerHTML = "";
    insertBtn.disabled = true;

    validationTimeout = setTimeout(() => {
      validateMediaUrl(url, pickerId);
    }, 500);
  });

  insertBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (url) {
      insertMediaUrl(url, pickerId);
    }
  });


  urlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const url = urlInput.value.trim();
      if (url && !insertBtn.disabled) {
        insertMediaUrl(url, pickerId);
      }
    }
  });
}


async function validateMediaUrl(url, pickerId) {
  const urlPreview = document.getElementById(`${pickerId}-url-preview`);
  const mediaPreview = document.getElementById(`${pickerId}-media-preview`);
  const insertBtn = document.getElementById(`${pickerId}-insert-media-btn`);

  try {

    const urlObj = new URL(url);
    const extension = urlObj.pathname.split(".").pop()?.toLowerCase();


    const mediaExtensions = [
      "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico",
      "mp4", "webm", "ogg", "avi", "mov", "wmv", "flv",
      "mp3", "wav", "aac", "ogg", "flac", "m4a"
    ];

    if (!mediaExtensions.includes(extension)) {
      urlPreview.innerHTML = "Invalid media file format";
      urlPreview.className = "url-preview error";
      insertBtn.disabled = true;
      return;
    }


    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal
    });

    clearTimeout(timeoutId);

      if (!response.ok) {
          new Error("URL not accessible");
    }

    urlPreview.innerHTML = "Valid media URL";
    urlPreview.className = "url-preview success";
    insertBtn.disabled = false;


    showMediaPreview(url, extension, pickerId);
  } catch (error) {
    console.warn("URL validation error:", error);
    urlPreview.innerHTML = "Invalid or inaccessible URL";
    urlPreview.className = "url-preview error";
    insertBtn.disabled = true;
    mediaPreview.innerHTML = "";
  }
}


function showMediaPreview(url, extension, pickerId) {
  const mediaPreview = document.getElementById(`${pickerId}-media-preview`);

  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"];
  const videoExtensions = ["mp4", "webm", "ogg", "avi", "mov", "wmv", "flv"];
  const audioExtensions = ["mp3", "wav", "aac", "ogg", "flac", "m4a"];

  if (imageExtensions.includes(extension)) {
      mediaPreview.innerHTML = `<img src="${url}" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 0.375rem;">`;
  } else if (videoExtensions.includes(extension)) {
    mediaPreview.innerHTML = `<video controls style="max-width: 200px; max-height: 200px; border-radius: 0.375rem;"><source src="${url}" type="video/${extension}">Your browser does not support the video tag.</video>`;
  } else if (audioExtensions.includes(extension)) {
    mediaPreview.innerHTML = `<audio controls style="width: 100%;"><source src="${url}" type="audio/${extension}">Your browser does not support the audio tag.</audio>`;
  }
}


function insertMediaUrl(url, pickerId) {
  const container = document
    .querySelector(`#${pickerId}`)
    .closest(".emoji-input-container");
  const targetInput = container.querySelector("textarea, input");

  if (targetInput) {
    const extension = url.split(".").pop()?.toLowerCase();
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
    const videoExtensions = ["mp4", "webm", "ogg", "avi", "mov", "mkv"];
    const audioExtensions = ["mp3", "wav", "aac", "ogg", "flac"];

    let markdown;
    if (imageExtensions.includes(extension)) {
      markdown = `![Image](${url})`;
    } else if (videoExtensions.includes(extension)) {
      markdown = `![Video](${url})`;
    } else if (audioExtensions.includes(extension)) {
      markdown = `![Audio](${url})`;
    } else {

      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = extractYouTubeVideoId(url);
        if (videoId) {
          markdown = `![YouTube Video](https://www.youtube.com/watch?v=${videoId})`;
        } else {
          markdown = url;
        }
      } else if (url.includes('giphy.com') || url.includes('tenor.com')) {
        markdown = `![GIF](${url})`;
      } else {
        markdown = url;
      }
    }

    insertAtCursor(targetInput, markdown);
    hideEmojiPicker(pickerId);
  }
}


function initYouTubeValidation(pickerId) {
  const youtubeInput = document.getElementById(`${pickerId}-youtube-input`);
  const youtubePreview = document.getElementById(`${pickerId}-youtube-preview`);
  const youtubeEmbedPreview = document.getElementById(`${pickerId}-youtube-embed-preview`);
  const insertBtn = document.getElementById(`${pickerId}-insert-youtube-btn`);

  if (!youtubeInput || !youtubePreview || !youtubeEmbedPreview || !insertBtn) return;

  let validationTimeout;

  youtubeInput.addEventListener("input", (e) => {
    clearTimeout(validationTimeout);
    const url = e.target.value.trim();

    if (!url) {
      youtubePreview.innerHTML = "";
      youtubeEmbedPreview.innerHTML = "";
      insertBtn.disabled = true;
      return;
    }

    youtubePreview.innerHTML = "Validating YouTube URL...";
    youtubePreview.className = "url-preview";
    youtubeEmbedPreview.innerHTML = "";
    insertBtn.disabled = true;

    validationTimeout = setTimeout(() => {
      validateYouTubeUrl(url, pickerId);
    }, 500);
  });

  insertBtn.addEventListener("click", () => {
    const url = youtubeInput.value.trim();
    if (url) {
      insertYouTubeUrl(url, pickerId);
    }
  });


  youtubeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const url = youtubeInput.value.trim();
      if (url && !insertBtn.disabled) {
        insertYouTubeUrl(url, pickerId);
      }
    }
  });
}


function validateYouTubeUrl(url, pickerId) {
  const urlPreview = document.querySelector(`#${pickerId} #youtube-preview`);
  const embedPreview = document.querySelector(
    `#${pickerId} #youtube-embed-preview`,
  );
  const insertBtn = document.querySelector(`#${pickerId} #insert-youtube-btn`);

  try {
    const videoId = extractYouTubeVideoId(url);

    if (!videoId) {
      urlPreview.innerHTML = "Invalid YouTube URL";
      urlPreview.className = "url-preview error";
      insertBtn.disabled = true;
      return;
    }

    urlPreview.innerHTML = "Valid YouTube URL";
    urlPreview.className = "url-preview success";
    insertBtn.disabled = false;


    embedPreview.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
  } catch (error) {
    urlPreview.innerHTML = "Invalid YouTube URL";
    urlPreview.className = "url-preview error";
    insertBtn.disabled = true;
  }
}


function insertYouTubeUrl(url, pickerId) {
  const container = document
    .querySelector(`#${pickerId}`)
    .closest(".emoji-input-container");
  const targetInput = container.querySelector("textarea, input");

  if (targetInput) {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      const markdown = `![YouTube Video](https://www.youtube.com/watch?v=${videoId})`;
      insertAtCursor(targetInput, markdown);
      hideEmojiPicker(pickerId);
    }
  }
}


function setupMediaPickerEventListeners(pickerId) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;


  const tabs = picker.querySelectorAll(".media-tab");
  const tabContents = picker.querySelectorAll(".media-tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetTab = tab.dataset.tab;


      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");


      tabContents.forEach((content) => {
        content.classList.remove("active");
        if (content.id === `${pickerId}-${targetTab}-tab`) {
          content.classList.add("active");
        }
      });
    });
  });


  initUrlValidation(pickerId);


  initGifSearch(pickerId);


  initYouTubeValidation(pickerId);
}


function insertAtCursor(input, text) {
    input.value = undefined;
    input.selectionEnd = undefined;
    input.selectionStart = undefined;
    const start = input.selectionStart;
  const end = input.selectionEnd;
  const value = input.value;

  input.value = value.substring(0, start) + text + value.substring(end);
  input.selectionStart = input.selectionEnd = start + text.length;


  input.dispatchEvent(new Event("input", {bubbles: true}));
}


function setupEmojiPickerEventListeners(pickerId) {

  const emojiSearch = document.getElementById(`${pickerId}-search`);
  if (emojiSearch) {
    emojiSearch.classList.add('form-input', 'bg-card', 'text-text-primary', 'border-none', 'rounded', 'w-full');
    emojiSearch.addEventListener("input", (e) => {
      filterEmojis(e.target.value, pickerId);
    });
  }

  document.addEventListener("click", (e) => {
    const picker = document.getElementById(pickerId);
    const pickerBtn = document.querySelector(`.emoji-picker-btn[onclick*='${pickerId}']`);
    if (
      picker &&
      !picker.classList.contains("hidden") &&
      !picker.contains(e.target) &&
      !pickerBtn?.contains(e.target)
    ) {
      hideEmojiPicker(pickerId);
    }
  });
}


export function markdownToHtml(markdown, replaceEmojis = null) {
  if (!markdown) return "";

  try {

    let processedText = markdown;
    if (replaceEmojis && typeof replaceEmojis === "function") {
      processedText = replaceEmojis(markdown);
    }


    let marked;
      if (typeof marked !== "undefined") {
      marked.setOptions({
        breaks: true, // Convert line breaks to <br>
        gfm: true, // GitHub Flavored Markdown
        sanitize: false, // We'll handle sanitization ourselves
        smartLists: true,
        smartypants: true,
      });


        const html = marked.parse(processedText);


        const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;


        const scripts = tempDiv.querySelectorAll(
        "script, iframe, object, embed, form, input, button, select, textarea",
      );
      scripts.forEach((el) => el.remove());


        const allElements = tempDiv.querySelectorAll("*");
      allElements.forEach((el) => {
        const attrs = el.attributes;
        for (let i = attrs.length - 1; i >= 0; i--) {
          const attr = attrs[i];
          if (
            attr.name.startsWith("on") ||
            attr.name.startsWith("javascript:")
          ) {
            el.removeAttribute(attr.name);
          }
        }
      });

      return tempDiv.innerHTML;
    } else {

        return processedText.replace(/[&<>"']/g, function (match) {
        const escape = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        };
        return escape[match];
      });
    }
  } catch (error) {
    console.error("Error converting markdown to HTML:", error);

    return markdown.replace(/[&<>"']/g, function (match) {
      const escape = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return escape[match];
    });
  }
}


window.toggleEmojiPicker = toggleEmojiPicker;
window.insertEmoji = insertEmoji;
window.filterEmojis = filterEmojis;
window.createEmojiPickerHTML = createEmojiPickerHTML;
window.createEmojiInputContainer = createEmojiInputContainer;
window.initEmojiPicker = initEmojiPicker;
window.markdownToHtml = markdownToHtml;
window.hideEmojiPicker = hideEmojiPicker;


export function createEmojiMediaInputContainer(
  inputId,
  emojiPickerId,
  mediaPickerId,
  inputType = "textarea",
  placeholder = "",
  className = "",
) {
  const inputTag = inputType === "textarea" ? "textarea" : "input";
  const inputAttrs = inputType === "textarea" ? 'rows="4"' : 'type="text"';
  return `
    <div class="emoji-input-container" style="gap:0;">
      <${inputTag} id="${inputId}" ${inputAttrs} placeholder="${placeholder}" class="${className}" required></${inputTag}>
      <div style="display:flex;flex-direction:column;gap:0;">
        <button type="button" class="emoji-picker-btn" style="border-radius:0.375rem 0 0 0.375rem;" onclick="toggleEmojiPicker('${emojiPickerId}','emoji')" title="Add emoji">😊</button>
        <button type="button" class="emoji-picker-btn" style="border-radius:0 0 0.375rem 0.375rem;" onclick="toggleEmojiPicker('${mediaPickerId}','media')" title="Add media">🎬</button>
      </div>
      ${createSimpleEmojiPickerHTML(emojiPickerId)}
      ${createMediaPickerHTML(mediaPickerId)}
    </div>
  `;
}


export function createSimpleEmojiPickerHTML(pickerId = "emoji-picker") {
  return `
    <div id="${pickerId}" class="emoji-picker hidden">
      <div class="emoji-picker-header">
        <input type="text" id="${pickerId}-search" placeholder="Search emojis..." class="emoji-search">
        <button type="button" class="close-button" onclick="hideEmojiPicker('${pickerId}')" title="Close">×</button>
      </div>
      <div class="emoji-list"></div>
    </div>
  `;
}


export function createMediaPickerHTML(pickerId = "media-picker") {
  return `
    <div id="${pickerId}" class="emoji-picker hidden">
      <div class="media-picker-header">
        <span class="media-picker-title">Insert Media</span>
        <button type="button" class="close-button" onclick="hideEmojiPicker('${pickerId}')" title="Close">×</button>
      </div>
      <div class="media-picker-tabs">
        <button class="media-tab" data-tab="gif">🎬 GIF Search</button>
        <button class="media-tab active" data-tab="url">🔗 URL Paste</button>
        <button class="media-tab" data-tab="youtube">📺 YouTube</button>
      </div>

      <div id="${pickerId}-gif-tab" class="media-tab-content">
        <div class="gif-search-container">
          <input type="text" id="${pickerId}-gif-search" class="gif-search-input" placeholder="Search GIFs on Giphy..." />
          <button type="button" id="${pickerId}-gif-search-btn" class="btn-primary btn-blue" style="margin-top: 0.5rem;">Search</button>
        </div>
        <div class="gif-results" id="${pickerId}-gif-results"></div>
      </div>

      <div id="${pickerId}-url-tab" class="media-tab-content active">
        <div class="url-input-container">
          <input type="url" id="${pickerId}-url-input" class="url-input" placeholder="Paste any media URL (image, video, audio, GIF)..." />
          <div id="${pickerId}-url-preview" class="url-preview"></div>
          <div id="${pickerId}-media-preview" class="media-preview"></div>
          <button type="button" id="${pickerId}-insert-media-btn" class="btn-primary btn-blue" disabled>Insert Media</button>
        </div>
      </div>

      <div id="${pickerId}-youtube-tab" class="media-tab-content">
        <div class="youtube-input-container">
          <input type="url" id="${pickerId}-youtube-input" class="url-input" placeholder="Paste YouTube URL..." />
          <div id="${pickerId}-youtube-preview" class="url-preview"></div>
          <div id="${pickerId}-youtube-embed-preview" class="youtube-preview"></div>
          <button type="button" id="${pickerId}-insert-youtube-btn" class="btn-primary btn-blue" disabled>Insert YouTube</button>
        </div>
      </div>
    </div>
  `;
}


window.toggleEmojiPicker = function (pickerId, type) {

  const picker = document.getElementById(pickerId);
  if (!picker) return;

  document.querySelectorAll(".emoji-picker").forEach((p) => {
    if (p !== picker) p.classList.add("hidden");
  });
  picker.classList.toggle("hidden");
  if (!picker.classList.contains("hidden")) {
    if (type === "emoji") {
      if (emojiData.length === 0)
        loadEmojiData().then(() => renderEmojis(emojiData, pickerId));
      else renderEmojis(emojiData, pickerId);
      setTimeout(() => {
        const s = document.getElementById(`${pickerId}-search`);
        if (s) s.focus();
      }, 100);
    } else if (type === "media") {

      setupMediaPickerEventListeners(pickerId);
    }
  }
};


function renderGifResults(gifs, pickerId) {
  const resultsEl = document.getElementById(`${pickerId}-gif-results`);
  if (!resultsEl) return;

  if (gifs.length === 0) {
    resultsEl.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--color-text-secondary);">No GIFs found</div>';
    return;
  }

  resultsEl.innerHTML = gifs.map(gif => `
    <div class="gif-item" style="display: inline-block; margin: 0.25rem; cursor: pointer; border-radius: 0.375rem; overflow: hidden; border: 2px solid transparent; transition: border-color 0.2s;"
         onmouseover="this.style.borderColor='var(--color-link)'"
         onmouseout="this.style.borderColor='transparent'"
         onclick="insertGif('${gif.original}', '${pickerId}')"
         title="${gif.title}">
      <img src="${gif.url}" alt="${gif.title}" style="max-width: 120px; max-height: 120px; display: block;" />
    </div>
  `).join('');
}


function renderEmojiTabs(pickerId) {
  const picker = document.getElementById(pickerId);
  const tabsContainer = picker?.querySelector('.emoji-tabs');
  if (!tabsContainer) return;
  tabsContainer.innerHTML = EMOJI_CATEGORIES.map(cat =>
    `<button class="emoji-tab${cat.key === currentCategory ? ' active' : ''}" data-category="${cat.key}">${cat.label}</button>`
  ).join('');
  tabsContainer.querySelectorAll('.emoji-tab').forEach(btn => {
    btn.onclick = () => {
      currentCategory = btn.dataset.category;
      renderEmojis(filteredEmojis.length ? filteredEmojis : emojiData, pickerId);
      renderEmojiTabs(pickerId);
    };
  });
}