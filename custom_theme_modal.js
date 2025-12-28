import {applyTheme, deleteCustomTheme, getAvailableThemes, saveCustomTheme} from "./themes.js";

export function setupCustomThemeManagement(
  db,
  auth,
  appId,
  showMessageBox,
  populateThemeSelect,
  userThemeSelect,
  defaultThemeName,
  currentUser,
  showCustomConfirm,
) {
  userThemeSelect.value = undefined;
  let currentCustomThemeId = null;

  const customThemeModal =
    document.getElementById("custom-theme-modal") || createCustomThemeModal();

  const closeButton = customThemeModal.querySelector(".close-button");
  const customThemeForm = document.getElementById("custom-theme-form");
  const themeNameInput = document.getElementById("custom-theme-name");
  const colorInputsContainer = document.getElementById("custom-theme-color-inputs");
  const backgroundPatternSelect = document.getElementById(
    "custom-theme-background-pattern",
  );
  const saveCustomThemeBtn = document.getElementById("save-custom-theme-btn");
  const customThemeList = document.getElementById("custom-theme-list");

  const createCustomThemeBtn = document.getElementById(
    "create-custom-theme-btn",
  );
  if (createCustomThemeBtn) {
    createCustomThemeBtn.addEventListener("click", async () => {
      await openCustomThemeModal();
      await renderCustomThemeList(); // Ensure the list is fresh when opening
    });
  }

  customThemeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const themeName = themeNameInput.value.trim();
    if (!themeName) {
      showMessageBox(
        "Theme name is required. Please enter a name for your custom theme.",
        true,
      );
      themeNameInput.focus();
      return;
    }

    if (themeName.length < 3) {
      showMessageBox("Theme name must be at least 3 characters long.", true);
      themeNameInput.focus();
      return;
    }

    if (themeName.length > 50) {
      showMessageBox("Theme name must be less than 50 characters long.", true);
      themeNameInput.focus();
      return;
    }

    const variables = {};
    const inputs = colorInputsContainer.querySelectorAll('input[type="text"]');
    inputs.forEach((input) => {
      const varName = `--${input.id}`; // Reconstruct the CSS variable name
      variables[varName] = input.value.trim();
    });

    if (variables["--color-bg-navbar"]) {
      const hex = variables["--color-bg-navbar"].replace("#", "");
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      variables["--color-bg-navbar-rgb"] = `${r},${g},${b}`;
    }

    if (userThemeSelect && userThemeSelect.value) {
      variables["--font-family-body"] = userThemeSelect.value;
    }

    const newTheme = {
      id: currentCustomThemeId, // Will be null for new themes, or existing ID for updates
      name: themeName,
      variables: variables,
      backgroundPattern: backgroundPatternSelect.value,
      isCustom: true, // Flag this as a custom theme
    };

    try {

      const saveBtn = document.getElementById("save-custom-theme-btn");
      const originalText = saveBtn.textContent;
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;

      console.log("DEBUG: Attempting to save custom theme:", newTheme);
      const result = await saveCustomTheme(newTheme);
      console.log("DEBUG: saveCustomTheme result:", result);

      if (result) {

        const savedThemeId = result;
        showMessageBox(`Theme "${newTheme.name}" saved successfully!`, false);
        customThemeModal.style.display = "none"; // Close modal

        await renderCustomThemeList();

        if (populateThemeSelect) {
          await populateThemeSelect(savedThemeId);
        }

        if (userThemeSelect) {
          userThemeSelect.value = savedThemeId;
        }

        const allThemes = await getAvailableThemes(true); // Force refresh to get the new theme
        const savedTheme = allThemes.find((t) => t.id === savedThemeId);
        if (savedTheme) {
          applyTheme(savedThemeId, savedTheme);
        } else {
          console.error(
            "DEBUG: Could not find saved theme in available themes",
          );
        }

        customThemeForm.reset();
        currentCustomThemeId = null;
      } else {
        showMessageBox(
          "Failed to save theme. Please check your connection and try again.",
          true,
        );
      }
    } catch (error) {
      console.error("Error saving custom theme:", error);
      showMessageBox(`Error saving theme: ${error.message}`, true);
    } finally {

      const saveBtn = document.getElementById("save-custom-theme-btn");
      saveBtn.textContent = "Save Custom Theme";
      saveBtn.disabled = false;
    }
  });

  closeButton.addEventListener(
    "click",
    () => (customThemeModal.style.display = "none"),
  );
  window.addEventListener("click", (e) => {
    if (e.target === customThemeModal) {
      customThemeModal.style.display = "none";
    }
  });

  function createCustomThemeModal() {
    const colorFields = [
      { label: 'Body BG', id: 'theme-body-bg' },
      { label: 'Card BG', id: 'theme-card-bg' },
      { label: 'Navbar BG', id: 'theme-navbar-bg' },
      { label: 'Content Section BG', id: 'theme-content-section-bg' },
      { label: 'Heading Main', id: 'theme-heading-main' },
      { label: 'Heading Card', id: 'theme-heading-card' },
      { label: 'Text Primary', id: 'theme-text-primary' },
      { label: 'Text Secondary', id: 'theme-text-secondary' },
      { label: 'Link', id: 'theme-link' },
      { label: 'Button Blue', id: 'theme-button-blue-bg' },
      { label: 'Button Green', id: 'theme-button-green-bg' },
      { label: 'Button Red', id: 'theme-button-red-bg' },
      { label: 'Button Purple', id: 'theme-button-purple-bg' },
      { label: 'Button Yellow', id: 'theme-button-yellow-bg' },
      { label: 'Button Indigo', id: 'theme-button-indigo-bg' },
      { label: 'Button Text', id: 'theme-button-text' },
      { label: 'Input BG', id: 'theme-input-bg' },
      { label: 'Input Border', id: 'theme-input-border' },
      { label: 'Input Text', id: 'theme-input-text' },
      { label: 'Table TH BG', id: 'theme-table-th-bg' },
      { label: 'Table TH Text', id: 'theme-table-th-text' },
      { label: 'Table TD Border', id: 'theme-table-td-border' },
      { label: 'Table Row Even BG', id: 'theme-table-row-even-bg' },
    ];
    const colorInputsHtml = colorFields.map(f => `
      <div class="input-field flex items-center gap-2">
        <label style="min-width:90px">${f.label}</label>
        <input type="color" id="${f.id}-color" data-target="${f.id}-text" />
        <input type="text" id="${f.id}-text" maxlength="9" style="width:80px" />
      </div>
    `).join("");
    const modalHtml = `
      <div id="custom-theme-modal" class="modal" style="display:none;align-items:center;justify-content:center;">
        <div class="modal-content" style="width:98vw;max-width:900px;padding:1.5rem 1rem;box-sizing:border-box;">
          <span class="close-button">&times;</span>
          <h3 id="custom-theme-modal-title" class="text-2xl font-bold mb-3 text-heading-card">Create Custom Theme</h3>
          <form id="custom-theme-form" class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div class="input-field mb-2 col-span-2">
              <label for="custom-theme-name" class="block mb-1">Theme Name:</label>
              <input id="custom-theme-name" class="form-input w-full" maxlength="32" required />
            </div>
            <div id="custom-theme-color-inputs" class="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              ${colorInputsHtml}
            </div>
            <div class="input-field col-span-2 text-right">
              <button type="submit" class="btn-primary btn-blue">Save Theme</button>
            </div>
          </form>
          <ul id="custom-theme-list" class="mt-4"></ul>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    const modal = document.getElementById("custom-theme-modal");

    colorFields.forEach(f => {
      const colorInput = modal.querySelector(`#${f.id}-color`);
      const textInput = modal.querySelector(`#${f.id}-text`);
      if (colorInput && textInput) {
        colorInput.addEventListener("input", () => {
          textInput.value = colorInput.value;
        });
        textInput.addEventListener("input", () => {
          if (/^#([0-9a-fA-F]{3}){1,2}$/.test(textInput.value)) {
            colorInput.value = textInput.value;
          }
        });
      }
    });
    return modal;
  }

  async function renderCustomThemeList() {
    if (!auth.currentUser) {
      customThemeList.innerHTML =
        "<li>Please log in to manage custom themes.</li>";
      return;
    }

    customThemeList.innerHTML = "<li>Loading custom themes...</li>";
    const availableThemes = await getAvailableThemes();
    const userCustomThemes = availableThemes.filter(
      (theme) => theme.isCustom && theme.id !== defaultThemeName,
    ); // Exclude default themes

    if (userCustomThemes.length === 0) {
      customThemeList.innerHTML = "<li>No custom themes created yet.</li>";
      return;
    }

    customThemeList.innerHTML = ""; // Clear loading message
    userCustomThemes.forEach((theme) => {
      theme.authorEmail = undefined;
      theme.authorEmail = undefined;
      const li = document.createElement("li");
      li.classList.add(
        "flex",
        "flex-col",
        "md:flex-row",
        "md:items-center",
        "justify-between",
        "p-3",
        "rounded-md",
        "mb-2",
      );
      li.style.backgroundColor = "var(--color-bg-card)"; // Apply card background color
      li.style.color = "var(--color-text-primary)"; // Apply primary text color

      const createdDate = theme.createdAt
        ? new Date(
            theme.createdAt.toDate ? theme.createdAt.toDate() : theme.createdAt,
          ).toLocaleDateString()
        : "Unknown";
      const authorName =
          theme.authorDisplayName || theme.authorEmail || "Unknown User";

      li.innerHTML = `
        <div class="flex-1">
          <div class="font-semibold text-lg mb-1">${theme.name}</div>
          <div class="text-sm text-gray-400">
            <span>Created by: ${authorName}</span>
            <span class="mx-2">•</span>
            <span>Created: ${createdDate}</span>
            ${theme.updatedAt ? `<span class="mx-2">•</span><span>Updated: ${new Date(theme.updatedAt.toDate ? theme.updatedAt.toDate() : theme.updatedAt).toLocaleDateString()}</span>` : ""}
          </div>
        </div>
        <div class="mt-2 md:mt-0 md:ml-4 flex gap-2">
          <button class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm edit-custom-theme-btn" data-theme-id="${theme.id}">
            <svg class="w-4 h-4 inline mr-1" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
            Edit
          </button>
          <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm delete-custom-theme-btn" data-theme-id="${theme.id}">
            <svg class="w-4 h-4 inline mr-1" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            Delete
          </button>
        </div>
      `;
      customThemeList.appendChild(li);
    });

    document.querySelectorAll(".edit-custom-theme-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const themeId = e.target.closest("button").dataset.themeId;
        loadCustomThemeForEditing(themeId);
      });
    });

    document.querySelectorAll(".delete-custom-theme-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const themeId = e.target.closest("button").dataset.themeId;
        console.log("DEBUG: Delete button clicked for theme ID:", themeId);

        const allThemes = await getAvailableThemes();
        console.log(
          "DEBUG: All available themes:",
          allThemes.map((t) => ({
            id: t.id,
            name: t.name,
            isCustom: t.isCustom,
          })),
        );

        const themeToDelete = allThemes.find((t) => t.id === themeId);
        console.log("DEBUG: Theme to delete found:", themeToDelete);

        if (!themeToDelete) {
          console.error(`Theme not found for deletion: ${themeId}`);
          showMessageBox("Error: Theme not found for deletion.", true);
          return;
        }

        const themeName =
          themeToDelete.name || themeToDelete.id || "Unknown Theme";
        console.log("DEBUG: Theme name for confirmation:", themeName);

        console.log(
          "DEBUG: About to show custom confirm for theme:",
          themeName,
        );
        const confirmation = await showCustomConfirm(
          `Are you sure you want to delete theme "${themeName}"?`,
          "This action cannot be undone.",
        );
        console.log("DEBUG: Custom confirm result:", confirmation);

        if (confirmation) {
          console.log(
            "DEBUG: User confirmed deletion, calling deleteCustomTheme",
          );
          if (await deleteCustomTheme(themeId)) {
            showMessageBox("Custom theme deleted successfully!", false);

            await populateThemeSelect(defaultThemeName); // Re-populate and select default
            userThemeSelect.value = defaultThemeName; // Update main dropdown
            applyTheme(defaultThemeName); // Apply the default theme
            await renderCustomThemeList(); // Re-render the list
          } else {
            showMessageBox("Error deleting theme. Please try again.", true);
          }
        } else {
          showMessageBox("Theme deletion cancelled.", false);
        }
      });
    });
  }

  async function openCustomThemeModal(themeId = null) {
    currentCustomThemeId = themeId;
    if (themeId) {
      await loadCustomThemeForEditing(themeId);
      themeNameInput.focus(); // Focus on name input for convenience
    } else {

      customThemeForm.reset();
      themeNameInput.value = "";

      colorInputsContainer
        .querySelectorAll('input[type="text"]')
        .forEach((input) => {
          const varName = `--${input.id}`;

          const computedValue = getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
            .trim();
          input.value = computedValue || "#000000"; // Fallback to black if empty
          input.nextElementSibling.value = computedValue || "#000000"; // Also update color picker
        });
      backgroundPatternSelect.value = "none"; // Default to no pattern for new theme
      themeNameInput.focus();
    }
    customThemeModal.style.display = "flex";
  }

  async function loadCustomThemeForEditing(themeId) {
    const allThemes = await getAvailableThemes();
    const themeToEdit = allThemes.find(
      (theme) => theme.id === themeId && theme.isCustom,
    );

    if (!themeToEdit) {
      console.error("Custom theme not found for editing:", themeId);
      showMessageBox("Error: Custom theme not found.", true);
      return;
    }

    currentCustomThemeId = themeId;
    themeNameInput.value = themeToEdit.name;
    backgroundPatternSelect.value = themeToEdit.backgroundPattern || "none";

    for (const [key, value] of Object.entries(themeToEdit.variables)) {
      const inputId = key.replace("--", ""); // Convert CSS var name back to input ID
      const textInput = document.getElementById(inputId);
      if (textInput) {
        textInput.value = value;
        textInput.nextElementSibling.value = value; // Update associated color picker
      }
    }

    Object.entries(themeToEdit).forEach(([key, value]) => {
      const el = customThemeModal.querySelector(`[name="${key}"]`);
      if (el) {
        el.value = value;
      } // else: field missing, skip
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("create-custom-theme-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        let modal = document.getElementById("custom-theme-modal");
        if (!modal) {
          modal = createCustomThemeModal();
        }
        modal.style.display = "flex";
      });
    }
  });
}