import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const SPACE_ID = "ar12c/okemo2";
let gradioClient = null;
let history = [];
const MAX_RETRIES = 3;
let retryCount = 0;

// Local storage keys
const DISCLAIMER_KEY = "okemoDisclaimerAccepted";
const NOTES_SEEN_KEY = "okemo-notes-v0.1.2-seen";

// UI constraints
const MAX_TEXTAREA_HEIGHT = 150;
const MAX_CHARS = 500;

// Global state for new features
let webSearchStatus = true; // RESTORED: Default to true to match app.py checkbox value=True
let currentFile = null;      

// Tooltip state
let currentTooltip = null;
let hideTimeout = null;

// UI Elements (Global Declarations)
let textarea;
let disclaimerAgreeButton;
let disclaimerCheckbox;
let menuToggleButton;
let newChatLink1;
let newChatLink2;
let updateNotesLink;
let okemoSendButton;
let updateNotesCloseBtn;
let updateNotesCheckbox;

let webSearchOption; // RESTORED
let filePreviewContainer;
let fileUploadInput;
let imageUploadInput;
let addImageOption;
let newFeatureOption;

let dropdown;
let disclaimerModal;
let updateNotesModal;
let menuIcon;
let updateBadge;

let emptyChatPrompt;
let okemoChatBox;

// Regex to extract the temporary object URL and file names injected into the user message for preview
const IMAGE_URL_REGEX = /\[IMAGE_PREVIEW_URL:(.*?)]/;
const FILE_ATTACHMENT_REGEX = /\(Attached: (.*?)\)/;


// =================================================================================
// 1. INITIALIZATION & ELEMENT SELECTION
// =================================================================================

function initializeElements() {
  textarea = document.getElementById("okemo-input");
  disclaimerAgreeButton = document.getElementById("disclaimer-agree");
  disclaimerCheckbox = document.getElementById("dont-show-again");
  menuToggleButton = document.getElementById("menu-toggle");
  okemoSendButton = document.getElementById("okemo-send");
  updateNotesModal = document.getElementById("update-notes-modal");
  updateNotesCloseBtn = document.getElementById("update-notes-close");
  updateNotesCheckbox = document.getElementById('notes-dont-show-again');
  updateBadge = document.getElementById("update-note-badge");
  
  // --- MODIFICATION START (from previous request) ---
  // Move the red dot (updateBadge) by 2 pixels. 
  // Applying a small horizontal transform for a slight shift.
  if (updateBadge) {
      updateBadge.style.transform = 'translateX(2px)';
  }
  // --- MODIFICATION END ---
  
  dropdown = document.getElementById("okemo-dropdown");
  disclaimerModal = document.getElementById("disclaimer-modal");
  okemoChatBox = document.getElementById("okemo-chat");
  menuIcon = document.getElementById("menu-icon");
  newChatLink1 = document.getElementById("new-chat-dropdown-1");
  newChatLink2 = document.getElementById("new-chat-dropdown-2");
  updateNotesLink = document.getElementById("show-update-notes");
  emptyChatPrompt = document.getElementById("empty-chat-prompt");

  // NEW FILE/WEB SEARCH ELEMENTS
  webSearchOption = document.getElementById("web-search-option"); // RESTORED
  filePreviewContainer = document.getElementById("file-preview-container");
  fileUploadInput = document.getElementById("file-upload-input");
  imageUploadInput = document.getElementById("image-upload-input");
  addImageOption = document.getElementById("add-image-option");
  newFeatureOption = document.getElementById("new-feature-option");
}

async function initOkemo() {
  try {
    if (typeof Client !== "undefined") {
      // Ensure Client is loaded, then connect
      gradioClient = await Client.connect(SPACE_ID);
      retryCount = 0;
      showStatus("Connected to OkemoLLM! ✨");
      setTimeout(() => showStatus(""), 1500);
    }
  } catch (err) {
    console.error("Failed to connect to OkemoLLM:", err);
    if (retryCount < MAX_RETRIES) {
      retryCount += 1;
      const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 15000);
      showStatus(`Failed to connect. Retrying in ${Math.round(delay / 1000)}s…`, true);
      setTimeout(() => initOkemo(), delay);
    } else {
      showStatus("Unable to connect to OkemoLLM after multiple attempts. 😭", true);
    }
  }
}


// =================================================================================
// 2. UI UTILITIES (Tooltips, Status, Modals, Dropdowns)
// =================================================================================

function showTooltip(event) {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  const button = event.currentTarget;
  const content = button.getAttribute("data-tooltip-content");
  if (!content) return;
  if (currentTooltip && currentTooltip.parentNode) {
    currentTooltip.parentNode.removeChild(currentTooltip);
    currentTooltip = null;
  }
  const tooltip = document.createElement("div");
  tooltip.id = "dynamic-tooltip";
  // MODIFICATION: Changed duration-200 to duration-300
  tooltip.className = "fixed z-[9999] px-2 py-1 text-xs text-white bg-neutral-800 rounded-lg shadow-xl opacity-0 transition-opacity duration-300 pointer-events-none whitespace-nowrap";
  tooltip.textContent = content;
  document.body.appendChild(tooltip);
  currentTooltip = tooltip;
  const rect = button.getBoundingClientRect();
  void tooltip.offsetWidth;
  const tw = tooltip.offsetWidth;
  const top = rect.bottom + 8;
  const left = rect.left + rect.width / 2 - tw / 2;
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  setTimeout(() => {
    tooltip.classList.remove("opacity-0");
    tooltip.classList.add("opacity-100");
  }, 10);
}

// MODIFICATION: Changed duration from 200 to 300
function hideTooltip(duration = 300) {
  if (hideTimeout) clearTimeout(hideTimeout);
  if (!currentTooltip) return;
  currentTooltip.classList.remove("opacity-100");
  currentTooltip.classList.add("opacity-0");
  hideTimeout = setTimeout(() => {
    if (currentTooltip && document.body.contains(currentTooltip)) {
      document.body.removeChild(currentTooltip);
    }
    currentTooltip = null;
    hideTimeout = null;
  }, duration);
}

function updateEmptyChatPromptVisibility() {
  if (!emptyChatPrompt) return;
  if (history.length === 0) {
    emptyChatPrompt.classList.remove("hidden");
    emptyChatPrompt.style.opacity = "1";
  } else {
    emptyChatPrompt.style.opacity = "0";
    // MODIFICATION: Changed timeout from 300 to 300 (0.3s)
    setTimeout(() => {
      emptyChatPrompt.classList.add("hidden");
    }, 300);
  }
}

function showStatus(msg, isError = false, targetElementId = "okemo-status") {
  const el = document.getElementById(targetElementId);
  if (!el) return;
  const errorColorClass = "text-red-500";
  const statusColorClass = "text-neutral-500 dark:text-neutral-400";
  el.textContent = msg;
  el.className = `min-h-5 text-sm ${isError ? errorColorClass : statusColorClass} mb-1`;
}

function checkDisclaimerStatus() {
  const accepted = localStorage.getItem(DISCLAIMER_KEY);
  if (!disclaimerModal) return;
  if (accepted !== "true") {
    disclaimerModal.classList.remove("hidden", "opacity-0");
  }
}

function acceptDisclaimer() {
  if (disclaimerCheckbox && disclaimerCheckbox.checked) {
    localStorage.setItem(DISCLAIMER_KEY, "true");
  }
  if (disclaimerModal) {
    disclaimerModal.classList.add("opacity-0");
    // MODIFICATION: Changed timeout from 300 to 300 (0.3s)
    setTimeout(() => disclaimerModal.classList.add("hidden"), 300);
  }
  checkUpdateNotesStatus();
}

function checkUpdateNotesStatus() {
  const seen = localStorage.getItem(NOTES_SEEN_KEY);
  if (!updateNotesModal) return;
  const disclaimerHidden = !disclaimerModal || disclaimerModal.classList.contains("hidden") || disclaimerModal.style.display === "none";
  if (seen !== "true") {
    if (updateBadge) updateBadge.classList.remove("hidden");
    if (disclaimerHidden) {
      showUpdateNotes();
    }
  } else {
    if (updateBadge) updateBadge.classList.add("hidden");
  }
}

function showUpdateNotes() {
  if (updateNotesModal) {
    updateNotesModal.classList.remove("hidden");
    setTimeout(() => {
      updateNotesModal.classList.remove("opacity-0");
      updateNotesModal.classList.add("opacity-100");
    }, 10);
  }
  if (updateBadge) updateBadge.classList.add("hidden");
}

function closeUpdateNotes() {
  if (updateNotesCheckbox && updateNotesCheckbox.checked) {
      localStorage.setItem(NOTES_SEEN_KEY, 'true');
  } else {
      if (updateBadge) updateBadge.classList.remove("hidden");
  }

  if (updateNotesModal) updateNotesModal.classList.add("hidden");
}

function toggleDropdown() {
  if (!dropdown) return;
  if (dropdown.classList.contains("hidden")) {
    dropdown.classList.remove("hidden");
    if (menuToggleButton) menuToggleButton.classList.add("active");
    if (menuIcon) menuIcon.classList.remove("rotate-180");
    void dropdown.offsetWidth;
    dropdown.classList.remove("opacity-0", "scale-y-0");
    dropdown.classList.add("opacity-100", "scale-y-100");
  } else {
    closeDropdown();
  }
}

function closeDropdown() {
  if (!dropdown || dropdown.classList.contains("hidden")) return;
  if (menuToggleButton) menuToggleButton.classList.remove("active");
  if (menuIcon) menuIcon.classList.remove("rotate-180");
  dropdown.classList.remove("opacity-100", "scale-y-100");
  dropdown.classList.add("opacity-0", "scale-y-0");
  // MODIFICATION: Changed timeout from 200 to 300 (0.3s)
  setTimeout(() => {
    dropdown.classList.add("hidden");
  }, 300);
}

function newChat(e) {
  if (e) e.preventDefault();
  history = [];
  renderChat();
  closeDropdown();
  clearFileAttachment(); 
  // When starting a new chat, we reset the search status to the default of the app.py (True in this case)
  updateWebSearchUI(true, false); 
  showStatus("New chat started.");
  if (textarea) textarea.focus();
  updateEmptyChatPromptVisibility();
}


// =================================================================================
// 3. FILE AND WEB SEARCH UTILITIES
// =================================================================================

// RESTORED: Function to update the search status UI and flag
function updateWebSearchUI(isEnabled, showStatusMsg = false) {
    webSearchStatus = isEnabled;
    if (!webSearchOption) return;
    
    const icon = webSearchOption.querySelector("i");
    
    webSearchOption.classList.toggle("bg-neutral-100", isEnabled);
    webSearchOption.classList.toggle("dark:bg-neutral-700", isEnabled);

    icon.classList.toggle("text-sky-700", isEnabled);
    icon.classList.toggle("dark:text-sky-300", isEnabled);

    if (showStatusMsg) {
        showStatus(isEnabled ? "Web search enabled. 🌐" : "Web search disabled.");
    }
}


/**
 * Renders the file attachment preview or clears it. Displays image thumbnail if applicable.
 */
function renderFilePreview(file) {
    currentFile = file;
    if (!filePreviewContainer) return;

    // Revoke previous object URL to prevent memory leaks
    if (filePreviewContainer.dataset.objectUrl) {
        URL.revokeObjectURL(filePreviewContainer.dataset.objectUrl);
        filePreviewContainer.removeAttribute('data-object-url');
    }

    if (file) {
        let isImage = file.type.startsWith("image");
        let objectUrl = URL.createObjectURL(file);
        filePreviewContainer.dataset.objectUrl = objectUrl; // Store URL for later revocation

        let previewHtml;

        if (isImage) {
            const fileName = file.name;
            // MODIFICATION: Changed duration-150 to duration-300 (0.3s) in button class
            previewHtml = `
                <div class="relative w-20 h-20 mt-4 mb-2 rounded-xl overflow-hidden shadow-lg border border-neutral-300 dark:border-neutral-600">
                    <img src="${objectUrl}" alt="Attached image preview" class="w-full h-full object-cover"/>
                    <button id="remove-file-button"
                            class="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white w-5 h-5 flex items-center justify-center rounded-full shadow-md transition duration-300 z-10"
                            aria-label="Remove attached image: ${fileName}">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            `;
        } else {
            let iconClass = "fa-file";
            if (file.name.endsWith(".pdf")) iconClass = "fa-file-pdf";
            else if (file.name.endsWith(".doc") || file.name.endsWith(".docx")) iconClass = "fa-file-word";
            const iconHtml = `<i class="fa-solid ${iconClass} mr-2 text-base text-neutral-500"></i>`;
            const fileName = file.name;

            // MODIFICATION: Changed duration-150 to duration-300 (0.3s) in button class
            previewHtml = `
                <div class="flex items-center justify-between p-2 mt-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-sm font-medium rounded-xl">
                    <div class="flex items-center truncate max-w-[85%]">
                        ${iconHtml}
                        <span class="truncate">${fileName}</span>
                    </div>
                    <button id="remove-file-button" class="text-neutral-500 hover:text-red-500 p-1 rounded-full transition duration-300" aria-label="Remove attached file">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
            `;
        }

        filePreviewContainer.innerHTML = previewHtml;
        filePreviewContainer.classList.remove("hidden");

        if (okemoChatBox) okemoChatBox.scrollTop = okemoChatBox.scrollHeight;

        document.getElementById("remove-file-button").addEventListener('click', clearFileAttachment);

    } else {
        filePreviewContainer.classList.add("hidden");
        filePreviewContainer.innerHTML = "";
    }
}

function clearFileAttachment() {
    // Revoke object URL before clearing preview if one exists
    if (filePreviewContainer && filePreviewContainer.dataset.objectUrl) {
        URL.revokeObjectURL(filePreviewContainer.dataset.objectUrl);
    }
    renderFilePreview(null);
    if (fileUploadInput) fileUploadInput.value = "";
    if (imageUploadInput) imageUploadInput.value = "";
    
    if(textarea) textarea.dispatchEvent(new Event('input'));
}


// =================================================================================
// 4. CHAT RENDERING AND TOOLBOX
// =================================================================================

function escapeHTML(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function createButtonContainerHTML(isLastResponse, turnId) {
  // FIX: Set light mode color to BLACK (#000000) for high contrast
  const lightIconColor = "color: #000000;"; // Black for clear visibility on light mode
  const darkIconColor = "color: #ffffff;";   // White for dark mode (Unchanged)
  const iconStyleAttributes = `data-light-style="${lightIconColor}" data-dark-style="${darkIconColor}"`; // Use data attributes
  const hoverBg = "hover:bg-neutral-300 dark:hover:bg-neutral-700";
  
  // MODIFICATION: Changed duration-150 to duration-300 (0.3s) in feedback and other buttons
  const feedbackButtons = isLastResponse
    ? `
        <button id="good-response-feedback-${turnId}" class="text-sm font-medium px-2 py-1 rounded transition duration-300 ${hoverBg}" data-tooltip-content="Good Response">
          <i class="fa-regular fa-thumbs-up" ${iconStyleAttributes}></i>
        </button>
        <button id="bad-response-feedback-${turnId}" class="text-sm font-medium px-2 py-1 rounded transition duration-300 ${hoverBg}" data-tooltip-content="Bad Response">
          <i class="fa-regular fa-thumbs-down" ${iconStyleAttributes}></i>
        </button>
      `
    : "";
  const visibilityClass = isLastResponse ? "opacity-100 pointer-events-auto always-visible" : "opacity-0 pointer-events-none";
  // MODIFICATION: Changed duration-300 to duration-300 in the toolbox container
  return `
    <div class="flex justify-start items-center transition-opacity duration-300 chat-toolbox ${visibilityClass}" id="regenerate-container-${turnId}">
      ${feedbackButtons}
      <button id="copy-button-${turnId}" class="text-sm font-medium px-2 py-1 rounded transition duration-300 ${hoverBg}" data-tooltip-content="Copy">
        <i class="fa-regular fa-copy" ${iconStyleAttributes}></i>
      </button>
      <button id="export-chat-button-${turnId}" class="text-sm font-medium px-2 py-1 rounded transition duration-300 ${hoverBg}" data-tooltip-content="Export as .txt">
        <i class="fa-solid fa-file-export" ${iconStyleAttributes}></i>
      </button>
      <button id="regenerate-button-${turnId}" class="text-sm font-medium px-2 py-1 rounded transition duration-300 ${hoverBg}" data-tooltip-content="Regenerate">
        <i class="fas fa-redo-alt" ${iconStyleAttributes}></i>
      </button>
    </div>
  `;
}

function attachToolboxListeners(wrapperEl, index) {
  const turnId = index;
  const toolbox = wrapperEl.querySelector(`#regenerate-container-${turnId}`);
  const isLastTurn = index === history.length - 1;
  if (!toolbox) return;
  
  const updateIconColors = () => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    toolbox.querySelectorAll("i").forEach((icon) => {
      const darkStyle = icon.getAttribute("data-dark-style");
      const lightStyle = icon.getAttribute("data-light-style");
      
      if (isDarkMode && darkStyle) {
        icon.setAttribute("style", darkStyle);
      } else if (lightStyle) {
        icon.setAttribute("style", lightStyle);
      }
    });
  };
  
  updateIconColors();
  document.removeEventListener('themeLoaded', updateIconColors);
  document.addEventListener('themeLoaded', updateIconColors);

  if (!isLastTurn) {
    wrapperEl.addEventListener("mouseover", () => {
      toolbox.classList.remove("opacity-0", "pointer-events-none");
      toolbox.classList.add("opacity-100", "pointer-events-auto");
    });
    wrapperEl.addEventListener("mouseout", () => {
      toolbox.classList.remove("opacity-100", "pointer-events-auto");
      toolbox.classList.add("opacity-0", "pointer-events-none");
      hideTooltip();
    });
  }
  
  const copyButton = toolbox.querySelector(`#copy-button-${turnId}`);
  const exportChatButton = toolbox.querySelector(`#export-chat-button-${turnId}`);
  const regenerateButton = toolbox.querySelector(`#regenerate-button-${turnId}`);
  const goodFeedbackButton = toolbox.querySelector(`#good-response-feedback-${turnId}`);
  const badFeedbackButton = toolbox.querySelector(`#bad-response-feedback-${turnId}`);
  
  if (copyButton) {
    copyButton.addEventListener("click", (e) => {
      e.preventDefault();
      copyResponseByTurnIndex(copyButton, index); 
    });
    copyButton.addEventListener("mouseover", showTooltip);
    copyButton.addEventListener("mouseout", () => hideTooltip());
  }
  if (exportChatButton) {
    exportChatButton.addEventListener("click", (e) => {
      e.preventDefault();
      exportChatHistory(exportChatButton);
    });
    exportChatButton.addEventListener("mouseover", showTooltip);
    exportChatButton.addEventListener("mouseout", () => hideTooltip());
  }
  if (regenerateButton) {
    if (isLastTurn) {
      regenerateButton.addEventListener("click", (e) => {
        e.preventDefault();
        // Pass the button element to disable it during regeneration
        sendOkemoMessage(false, e.currentTarget); 
      });
    } else {
      regenerateButton.style.opacity = "0.5";
      regenerateButton.style.cursor = "not-allowed";
      regenerateButton.setAttribute("data-tooltip-content", "Regeneration only available for the latest turn.");
    }
    regenerateButton.addEventListener("mouseover", showTooltip);
    regenerateButton.addEventListener("mouseout", () => hideTooltip());
  }
  if (goodFeedbackButton) {
    goodFeedbackButton.addEventListener("click", (e) => {
      e.preventDefault();
      // Pass both buttons to disable them after feedback
      sendFeedback("Good Response", true, goodFeedbackButton, badFeedbackButton); 
    });
    goodFeedbackButton.addEventListener("mouseover", showTooltip);
    goodFeedbackButton.addEventListener("mouseout", () => hideTooltip());
  }
  
  // --- FIX START: Ensure old turns just log bad response, and the last turn uses the modal ---
  if (badFeedbackButton) {
    if (!isLastTurn) {
        // For previous turns, still allow a simple bad response log if the user attempts to rate old content
        badFeedbackButton.addEventListener("click", (e) => {
             e.preventDefault();
             sendFeedback("Bad Response", false, goodFeedbackButton, badFeedbackButton); 
        });
    }
    badFeedbackButton.addEventListener("mouseover", showTooltip);
    badFeedbackButton.addEventListener("mouseout", () => hideTooltip());
  }
  // --- FIX END ---
}

// Function that handles the Bad Response feedback modal (previously uncalled)
function setupBadFeedbackPopup(badFeedbackButton) {
  if (!badFeedbackButton) return;
  
  // Important: Remove any previous click listeners to prevent duplicates
  badFeedbackButton.removeEventListener("click", badFeedbackButton.clickHandler);

  // Use a unique click handler to ensure it only runs once per click
  const clickHandler = (e) => {
    e.preventDefault();

    const modal = document.getElementById("bad-feedback-modal");
    const textarea = document.getElementById("bad-feedback-input");
    
    if (!modal || !textarea) {
      // Fallback if modal elements don't exist
      sendFeedback("Bad Response", false, null, null);
      return;
    }

    textarea.value = "";
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.remove("opacity-0"), 10);
    textarea.focus();

    const submitBtn = document.getElementById("submit-bad-feedback");
    const cancelBtn = document.getElementById("cancel-bad-feedback");

    // Clear previous listeners for submit/cancel to prevent duplicates
    const oldSubmitHandler = submitBtn.clickHandler;
    const oldCancelHandler = cancelBtn.clickHandler;
    if (oldSubmitHandler) submitBtn.removeEventListener("click", oldSubmitHandler);
    if (oldCancelHandler) cancelBtn.removeEventListener("click", oldCancelHandler);

    const closeModal = () => {
      modal.classList.add("opacity-0");
      setTimeout(() => modal.classList.add("hidden"), 300);
    };

    const handleSubmit = async () => {
      const newPrompt = textarea.value.trim();
      if (!newPrompt) {
        alert("Please enter a suggested prompt before submitting.");
        return;
      }
      
      // Disable buttons in the chat box while feedback is sent
      badFeedbackButton.disabled = true;
      const goodBtn = document.getElementById(`good-response-feedback-${history.length - 1}`);
      if (goodBtn) goodBtn.disabled = true;

      closeModal();
      showStatus("Submitting detailed feedback...");

      try {
        if (!gradioClient) await initOkemo();
        const inputs = [history, newPrompt];
        // API endpoint for bad feedback with prompt
        const result = await gradioClient.predict("/feedback_bad_with_prompt", inputs); 
        const feedbackMessage = result?.data?.[1] || "Feedback received. Thank you!";
        showStatus(feedbackMessage);
      } catch (err) {
        console.error("Error sending feedback prompt:", err);
        showStatus("Failed to send feedback. Check console.", true);
      } finally {
        // Re-enable buttons, even if the feedback was unsuccessful, to allow a retry or standard bad log
        badFeedbackButton.disabled = false;
        if (goodBtn) goodBtn.disabled = false;
        // Timeout for status cleanup
        setTimeout(() => showStatus(""), 1500); 
      }
    };

    const handleCancel = () => {
      closeModal();
      // Log a simple 'Bad Response' entry if the user cancels
      sendFeedback("Bad Response", false, null, null); 
    };
    
    // Store handlers and add listeners
    submitBtn.clickHandler = handleSubmit;
    cancelBtn.clickHandler = handleCancel;
    submitBtn.addEventListener("click", handleSubmit);
    cancelBtn.addEventListener("click", handleCancel);
  };
  
  badFeedbackButton.clickHandler = clickHandler;
  badFeedbackButton.addEventListener("click", clickHandler);
}

function renderChat() {
  const box = okemoChatBox;
  if (!box) return;
  box.innerHTML = "";
  const htmlContent = [];
  
  for (let i = 0; i < history.length; i++) {
    const [u, a] = history[i];
    const isLastTurn = i === history.length - 1;
    const wrapperId = `chat-turn-${i}`;
    htmlContent.push(`<div id="${wrapperId}" class="chat-turn-wrapper">`);
    
    // User Message
    if (u) {
      // 1. Check for attached file markers
      const imageUrlMatch = u.match(IMAGE_URL_REGEX);
      const attachmentMatch = u.match(FILE_ATTACHMENT_REGEX);
      
      let userDisplayContent = escapeHTML(u);
      let mediaHtml = '';
      
      if (imageUrlMatch) {
          const imageUrl = imageUrlMatch[1];
          // Remove the URL marker from the displayed text
          userDisplayContent = userDisplayContent.replace(escapeHTML(imageUrlMatch[0]), '').trim();
          
          // Generate the image HTML for chat bubble
          mediaHtml = `
              <div class="mt-2 mb-2">
                  <img src="${imageUrl}" class="max-w-full h-auto rounded-xl shadow-lg" style="max-height: 250px; object-fit: cover; border: 1px solid rgba(0,0,0,0.1);" alt="Attached Image"/>
              </div>
          `;
      } else if (attachmentMatch) {
          userDisplayContent = userDisplayContent.replace(escapeHTML(attachmentMatch[0]), '').trim();
          mediaHtml = `<div class="mt-2 mb-2 text-sm text-neutral-400 dark:text-neutral-500">${escapeHTML(attachmentMatch[0])}</div>`;
      }

      // If text remains, wrap it in a div
      const textHtml = userDisplayContent ? `<div class="mb-1">${userDisplayContent}</div>` : '';


      // MODIFICATION: Changed duration-150 to duration-300 (0.3s) in chat bubble
      // NOTE: The structure below is what creates the "bubble" effect by limiting the width 
      // of the inner `div` using `inline-block` within the `flex justify-end` container.
      htmlContent.push(`
        <div class="user-message-row mb-3 flex justify-end">
          <div class="inline-block max-w-[85%] rounded-2xl px-4 py-2 bg-neutral-200 dark:bg-neutral-800 dark:text-white transform transition duration-300 ease-out">
            ${textHtml}
            ${mediaHtml}
          </div>
        </div>`);
    }
    
    // AI Message
    if (a) {
      // If response (a) is present, display it
      htmlContent.push(`
        <div class="ai-message-row mb-1 flex items-start gap-2 mt-7">
          <img src="/src/Vailailogo.svg" alt="AI logo" class="w-8 h-8 rounded-full mt-1 dark:invert"/>
          <div class="max-w-[85%] text-neutral-900 dark:text-white pt-1">
            ${escapeHTML(a)}
          </div>
        </div>
        <div class="mb-4 flex justify-start pl-9 relative chat-turn-buttons">
          ${createButtonContainerHTML(isLastTurn, i)}
        </div>`);
    }
    htmlContent.push(`</div>`);
  }
  box.innerHTML = htmlContent.join("");
  
  // Re-attach listeners for all turns
  for (let i = 0; i < history.length; i++) {
    const turnWrapper = document.getElementById(`chat-turn-${i}`);
    if (turnWrapper) attachToolboxListeners(turnWrapper, i);
  }
  
  updateEmptyChatPromptVisibility();
  box.scrollTop = box.scrollHeight;
  
  // FIX: Re-attach the special logic for the last turn's bad feedback button after re-rendering
  if (history.length > 0) {
      const lastTurnId = history.length - 1;
      const lastTurnWrapper = document.getElementById(`chat-turn-${lastTurnId}`);
      if (lastTurnWrapper) {
          const badFeedbackButton = lastTurnWrapper.querySelector(`#bad-response-feedback-${lastTurnId}`);
          // This ensures the modal logic is only attached to the latest turn's bad feedback button
          setupBadFeedbackPopup(badFeedbackButton); 
      }
  }
}

// =================================================================================
// 5. API INTERACTION (Send Message and Feedback)
// =================================================================================

async function sendFeedback(rating, triggerLearning, goodBtn, badBtn) {
  if (history.length === 0) {
    showStatus("No message to rate. Start a conversation first! 🤷‍♀️", true);
    return;
  }
  // Only disable buttons if provided (i.e., for the latest turn)
  if (goodBtn) goodBtn.disabled = true;
  if (badBtn) badBtn.disabled = true;
  
  const loadingBar = document.getElementById("okemo-loading-bar");
  if (loadingBar) loadingBar.classList.remove("hidden");
  showStatus(`Sending feedback: ${rating}...`);

  try {
    if (!gradioClient) await initOkemo();
    if (!gradioClient) throw new Error("No connection to OkemoLLM.");

    const endpoint = triggerLearning ? "/feedback_good" : "/feedback_bad";
    const inputs = [history]; 
    
    const result = await gradioClient.predict(endpoint, inputs);
    
    const updatedHistoryFromServer = result?.data?.[0];
    if (Array.isArray(updatedHistoryFromServer)) {
        history = updatedHistoryFromServer;
    }
    
    const feedbackMessage = result?.data?.[1] || `${rating} logged successfully.`;
    showStatus(feedbackMessage);
    renderChat();
    
  } catch (err) {
    console.error("Feedback submission error:", err);
    showStatus(`Error submitting feedback. Please check the console.`, true);
  } finally {
    if (loadingBar) loadingBar.classList.add("hidden");
    // MODIFICATION: Set timeout to 1500 (1.5s) to be consistent with other status messages
    setTimeout(() => showStatus(""), 1500);
  }
}


async function sendOkemoMessage(isPlusMenuAction = false, element = null) {
  const inputEl = textarea;
  const btnEl = okemoSendButton;
  const loadingBar = document.getElementById("okemo-loading-bar");
  
  if (!inputEl || !btnEl || !loadingBar) return;

  let userMsg = inputEl.value.trim();
  const isRegenerate = element && element.id.includes("regenerate-button");
  const isStandardSend = !isRegenerate;
  
  if (isStandardSend && userMsg.length > MAX_CHARS) {
    showStatus(`Message exceeds maximum limit of ${MAX_CHARS} characters.`, true);
    return;
  }
  if (isStandardSend && !userMsg && !currentFile) {
    showStatus(`Please enter a message or attach a file.`, true);
    return;
  }

  let messageToSendToAPI;
  let cleanUserMessageForHistory;
  
  // *** NEW: Variable to hold the local image marker before API call ***
  let imageMarker = ''; 
  // -------------------------------------------------------------------

  // --- 1. Determine Prompt and History state ---
  if (isRegenerate) {
      if (history.length === 0) {
          showStatus("Please type a message before requesting regeneration.", true);
          return;
      }
      // Get the original user message from the last turn
      const lastUserMessage = history[history.length - 1][0]; 
      if (!lastUserMessage) {
          showStatus("Cannot regenerate: last user message was empty.", true);
          return;
      }
      
      // *** NEW: Extract existing marker if regenerating a previous image prompt ***
      const existingMatch = lastUserMessage.match(IMAGE_URL_REGEX);
      if (existingMatch) {
          imageMarker = existingMatch[0];
      }
      // -------------------------------------------------------------------------
      
      // Remove the incomplete last turn from history array
      history.pop();
      
      // Clean the message for the API prompt
      cleanUserMessageForHistory = lastUserMessage.replace(IMAGE_URL_REGEX, '').replace(FILE_ATTACHMENT_REGEX, '').trim();
      // Send the instruction with the original user message content
      messageToSendToAPI = `Please generate a completely new and distinct response for the following: "${cleanUserMessageForHistory}"`; 
  } else {
      // Standard send
      messageToSendToAPI = userMsg;
      cleanUserMessageForHistory = userMsg;
  }
  
  // --- 2. Grab current state for Gradio API ---
  const isWebSearchOn = webSearchStatus; // RESTORED
  
  // --- 3. Disable UI and Show Loading ---
  const toolbox = document.querySelector(".chat-toolbox.always-visible");
  if (toolbox) {
      toolbox.querySelectorAll("button").forEach((b) => (b.disabled = true));
  }
  btnEl.disabled = true;
  btnEl.classList.add("opacity-50", "cursor-not-allowed");
  loadingBar.classList.remove("hidden"); 
  showStatus("OkemoLLM Thinking...");

  const historyToSend = [...history]; // Send current, complete history (excluding the new turn)

  // **OPTIMISTIC UPDATE:** Display the user message immediately.
  if (isStandardSend || isRegenerate) {
      let historyMessage = cleanUserMessageForHistory;
      if (currentFile) {
          if (currentFile.type.startsWith("image")) {
              // Inject object URL marker for chat rendering and store it in imageMarker
              imageMarker = ` [IMAGE_PREVIEW_URL:${filePreviewContainer.dataset.objectUrl}]`;
              historyMessage += imageMarker;
          } else {
              historyMessage += ` (Attached: ${currentFile.name})`;
          }
          // CRITICAL: If this is a standard send, the currentFile is attached to the new message, 
          // but for a regenerate action, currentFile is null, and we rely on imageMarker from step 1.
      } else if (isRegenerate && imageMarker) {
          // If regenerating an image-based prompt, re-inject the existing marker
          historyMessage += imageMarker; 
      }
      history.push([historyMessage, null]);
  }
  renderChat(); 

  try {
      if (!gradioClient) {
          showStatus("Connecting to OkemoLLM…", true);
          await initOkemo();
          if (!gradioClient) throw new Error("Failed to connect to OkemoLLM.");
      }

      if (isStandardSend) {
          inputEl.value = "";
          inputEl.style.height = "48px";
      }

      // CRITICAL: Align inputs to the Gradio API /on_submit (4 inputs)
      const inputs = [
          messageToSendToAPI, 
          historyToSend,      
          currentFile,        
          isWebSearchOn       // RESTORED
      ];
      
      const result = await gradioClient.predict("/on_submit", inputs);
      
      let updatedHistoryFromServer = result?.data?.[0];
      const statusMessage = result?.data?.[1];

      if (Array.isArray(updatedHistoryFromServer)) {
          // *** CRITICAL FIX: Re-inject the local image marker into the server's history ***
          // The server doesn't know the local object URL, so we must add it back to the history
          // received from the server so the next render can display the image.
          if (imageMarker && updatedHistoryFromServer.length > 0) {
              const lastTurnIndex = updatedHistoryFromServer.length - 1;
              const lastUserMsg = updatedHistoryFromServer[lastTurnIndex][0];
              
              // Only append the marker if the user message exists and doesn't already contain it
              // (It shouldn't, as the server cleans it, but this is an extra check)
              if (lastUserMsg && !lastUserMsg.includes(imageMarker)) {
                  updatedHistoryFromServer[lastTurnIndex][0] = lastUserMsg + imageMarker;
              }
          }
          // --------------------------------------------------------------------------------

          history = updatedHistoryFromServer;
          showStatus(statusMessage || "Received response from OkemoLLM.");
      } else {
          // Failure: Rollback the optimistic update
          history.pop();
          showStatus("Error: Invalid response from server.", true);
          throw new Error("Invalid response from OkemoLLM.");
      }
      
  } catch (err) {
      console.error("Prediction error:", err);
      showStatus(`Error: ${err.message || "Unknown error."}`, true);
      
      // Preserve user message on error
      if (history.length > 0 && history[history.length - 1][1] === null) {
           // Update the AI response field with an error message
           history[history.length - 1][1] = "Error: Could not get response.";
      }
      
  } finally {
      loadingBar.classList.add("hidden");
      renderChat(); 
      okemoSendButton.disabled = false;
      okemoSendButton.classList.remove("opacity-50", "cursor-not-allowed");
      // MODIFICATION: Set timeout to 1500 (1.5s) to be consistent with other status messages
      setTimeout(() => showStatus(""), 1500); 
      
      // Re-enable the toolbox buttons
      const lastTurnToolbox = document.querySelector(`#regenerate-container-${history.length - 1}`);
      if (lastTurnToolbox) {
         lastTurnToolbox.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }

      // Final cleanup: clear the file attachment state only for standard sends
      if (isStandardSend) clearFileAttachment();
  }
}

// =================================================================================
// 6. UTILITY ACTIONS (Copy, Export)
// =================================================================================

async function copyResponseByTurnIndex(btn, turnIndex) {
  if (turnIndex < 0 || turnIndex >= history.length) {
    showStatus("Invalid message index.", true);
    return;
  }
  const [userMsg, aiMsg] = history[turnIndex];
  
  // Clean user message of preview markers before copying
  const cleanUserMsg = userMsg 
    ? userMsg.replace(IMAGE_URL_REGEX, '').replace(FILE_ATTACHMENT_REGEX, '').trim() 
    : '';

  const textToCopy = aiMsg || cleanUserMsg;

  if (!textToCopy) {
    showStatus("Nothing to copy.", true);
    return;
  }
  const originalIconClass = "fa-regular fa-copy";
  const successIconClass = "fa-solid fa-check";
  const successIconColor = "#000000";
  const iconEl = btn.querySelector("i");
  // Retrieve styles from data attributes instead of inline style
  const darkStyle = iconEl.getAttribute('data-dark-style');
  const lightStyle = iconEl.getAttribute('data-light-style');
  const currentIconStyle = iconEl.getAttribute("style");

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(textToCopy);
    } else {
      const tempTextarea = document.createElement("textarea");
      tempTextarea.value = textToCopy;
      tempTextarea.style.position = "fixed";
      tempTextarea.style.top = "0";
      tempTextarea.style.left = "0";
      tempTextarea.style.opacity = "0";
      document.body.appendChild(tempTextarea);
      tempTextarea.select();
      tempTextarea.setSelectionRange(0, 99999);
      const successful = document.execCommand("copy");
      document.body.removeChild(tempTextarea);
      if (!successful) throw new Error("Copy command failed.");
    }
    showStatus("Response copied to clipboard! ✅");
    if (btn) {
      // MODIFICATION: Changed timeout from 1500 to 300 (0.3s) for smoother transition
      // Set temp icon and color
      btn.innerHTML = `<i class="${successIconClass}" style="color: ${successIconColor};" data-dark-style="${darkStyle}" data-light-style="${lightStyle}"></i>`;
      setTimeout(() => {
        // Restore original icon and color
        btn.innerHTML = `<i class="${originalIconClass}" style="${currentIconStyle}" data-dark-style="${darkStyle}" data-light-style="${lightStyle}"></i>`;
      }, 300);
    }
  } catch (err) {
    console.error("Copy failed:", err);
    showStatus("Failed to copy. Please try manually.", true);
  }
}

function exportChatHistory(btn) {
  if (history.length === 0) {
    showStatus("No conversation to export. Start chatting first! 📝", true);
    return;
  }
  const originalIconClass = "fa-solid fa-file-export";
  const successIconClass = "fa-solid fa-check";
  const successIconColor = "#000000";
  const iconEl = btn.querySelector("i");
  const currentIconStyle = iconEl.getAttribute("style");
  
  let fileContent = `OkemoLLM Chat Export - ${new Date().toLocaleString()}\n`;
  fileContent += "---------------------------------------\n\n";
  
  history.forEach(([user, assistant]) => {
    // Clean user message of preview markers before exporting
    const cleanUser = user 
        // Replace the preview marker with a generic placeholder for the file
        ? user.replace(IMAGE_URL_REGEX, ' [Attached Image]').replace(FILE_ATTACHMENT_REGEX, ' [Attached File]').trim() 
        : '';
        
    if (cleanUser) fileContent += `USER: ${cleanUser}\n`;
    if (assistant) fileContent += `OKEMO: ${assistant}\n\n`;
  });
  
  const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = `okemo_chat_export_${new Date().toISOString().slice(0, 10)}.txt`;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showStatus("Chat exported successfully! 📤");
  if (btn) {
    // MODIFICATION: Changed timeout from 1500 to 300 (0.3s) for smoother transition
    btn.innerHTML = `<i class="${successIconClass}" style="color: ${successIconColor};"></i>`;
    setTimeout(() => {
      btn.innerHTML = `<i class="${originalIconClass}" style="${currentIconStyle}"></i>`;
    }, 300);
  }
  // MODIFICATION: Changed timeout from 2000 to 1500 (to match status message decay)
  setTimeout(() => showStatus(""), 1500); 
}


// =================================================================================
// 7. INPUT BINDINGS & LISTENERS
// =================================================================================

function bindInput() {
  if (!textarea) return;
  
  textarea.addEventListener("input", function () {
    this.style.height = "auto";
    const minHeight = 48;
    const newHeight = Math.min(this.scrollHeight, MAX_TEXTAREA_HEIGHT);
    
    this.style.height = `${newHeight}px`;

    // Empty chat prompt visibility
    if (emptyChatPrompt) {
      if (this.value.trim().length > 0) {
        emptyChatPrompt.style.opacity = "0";
        // MODIFICATION: Changed timeout from 300 to 300 (0.3s)
        setTimeout(() => emptyChatPrompt.classList.add("hidden"), 300);
      } else if (history.length === 0) {
        emptyChatPrompt.classList.remove("hidden");
        setTimeout(() => emptyChatPrompt.style.opacity = "1", 10); 
      }
    }
    
    // Fix: Explicitly enable/disable the Send button based on content OR file
    const hasText = this.value.trim().length > 0;
    
    if (okemoSendButton) {
        // 1. Set the disabled state based on 'hasText' OR 'currentFile'
        okemoSendButton.disabled = !(hasText || currentFile);

        // 2. Always update the visual state
        if (hasText || currentFile) {
            okemoSendButton.classList.remove("opacity-50", "cursor-not-allowed");
        } else {
            if (!okemoSendButton.classList.contains('opacity-50')) {
                okemoSendButton.classList.add("opacity-50", "cursor-not-allowed");
            }
        }
    }
  });

  // Handle Enter key for sending
  textarea.addEventListener("keydown", function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); 
      if (okemoSendButton && !okemoSendButton.disabled) {
        sendOkemoMessage();
      }
    }
  });
}

function initListeners() {
  initializeElements();
  
  // --- Modals and Toggles ---
  if (disclaimerAgreeButton) disclaimerAgreeButton.addEventListener("click", acceptDisclaimer);
  if (menuToggleButton) menuToggleButton.addEventListener("click", toggleDropdown);
  if (updateNotesLink) updateNotesLink.addEventListener("click", (e) => { e.preventDefault(); showUpdateNotes(); closeDropdown(); });
  if (updateNotesCloseBtn) updateNotesCloseBtn.addEventListener("click", closeUpdateNotes);
  
  if (newChatLink1) newChatLink1.addEventListener("click", newChat);
  if (newChatLink2) newChatLink2.addEventListener("click", newChat);
  
  document.addEventListener("click", (e) => {
    const plusMenuToggle = document.getElementById("plus-menu-toggle");
    const inputDropdown = document.getElementById("input-dropdown");

    // Close header dropdown
    if (dropdown && !menuToggleButton.contains(e.target) && !dropdown.contains(e.target)) {
      closeDropdown();
    }
    // Close plus menu dropdown
    if (inputDropdown && plusMenuToggle && !plusMenuToggle.contains(e.target) && !inputDropdown.contains(e.target)) {
        inputDropdown.classList.remove("opacity-100", "scale-y-100");
        inputDropdown.classList.add("opacity-0", "scale-y-0");
        plusMenuToggle.classList.remove("active");
        // MODIFICATION: Changed timeout from 200 to 300 (0.3s)
        setTimeout(() => {
            inputDropdown.classList.add("hidden");
        }, 300);
    }

  });

  // --- Main Action Buttons ---
  if (okemoSendButton) {
    const initiallyDisabled = !textarea || (textarea.value.trim().length === 0 && !currentFile);
    okemoSendButton.disabled = initiallyDisabled;
    if (initiallyDisabled) {
        okemoSendButton.classList.add("opacity-50", "cursor-not-allowed");
    }
    okemoSendButton.addEventListener("click", () => sendOkemoMessage());
  }
  
  // --- Plus Menu Toggle ---
  const plusMenuToggle = document.getElementById("plus-menu-toggle");
  const inputDropdown = document.getElementById("input-dropdown");
  if (plusMenuToggle && inputDropdown) {
      plusMenuToggle.addEventListener("click", () => {
          if (inputDropdown.classList.contains("hidden")) {
              inputDropdown.classList.remove("hidden");
              plusMenuToggle.classList.add("active");
              void inputDropdown.offsetWidth;
              inputDropdown.classList.remove("opacity-0", "scale-y-0");
              inputDropdown.classList.add("opacity-100", "scale-y-100");
          } else {
              inputDropdown.classList.remove("opacity-100", "scale-y-100");
              inputDropdown.classList.add("opacity-0", "scale-y-0");
              plusMenuToggle.classList.remove("active");
              // MODIFICATION: Changed timeout from 200 to 300 (0.3s)
              setTimeout(() => {
                  inputDropdown.classList.add("hidden");
              }, 300);
          }
      });
  }
  
  // --- Web Search Toggle (RESTORED) ---
  if (webSearchOption) {
      // Set initial state visually
      updateWebSearchUI(webSearchStatus);
      
      webSearchOption.addEventListener("click", (e) => {
          e.preventDefault();
          // Toggle the status flag and update UI
          updateWebSearchUI(!webSearchStatus, true);
          if (inputDropdown) inputDropdown.classList.add("hidden");
          if (plusMenuToggle) plusMenuToggle.classList.remove("active");
      });
  }

  // Bind "Upload Photo" button to hidden image input
  if (addImageOption && imageUploadInput) {
      addImageOption.addEventListener("click", () => {
          imageUploadInput.click();
      });
  }

  // Bind "Attach File" button to hidden general file input
  if (newFeatureOption && fileUploadInput) {
      newFeatureOption.addEventListener("click", () => {
          fileUploadInput.click();
      });
  }

  // Handle file selection change for ALL file inputs
  [fileUploadInput, imageUploadInput].forEach(input => {
    if (input) {
      input.addEventListener('change', (e) => {
        const otherInput = (input === fileUploadInput) ? imageUploadInput : fileUploadInput;
        if (otherInput) otherInput.value = ""; 
        
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          renderFilePreview(file);
          if (textarea) textarea.focus();
        } else {
          renderFilePreview(null);
        }
        if (inputDropdown) inputDropdown.classList.add("hidden");
        if (plusMenuToggle) plusMenuToggle.classList.remove("active");
        
        if(textarea) textarea.dispatchEvent(new Event('input'));
      });
    }
  });

  bindInput();
}


// =================================================================================
// 8. DOCUMENT READY
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
  initListeners();
  checkDisclaimerStatus();
  checkUpdateNotesStatus();
  initOkemo(); 
});
