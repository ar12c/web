import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const SPACE_ID = "ar12c/okemo2"; // Gradio Space for main chat
let gradioClient = null; 
let history = []; // array of [user, assistant] turns
const MAX_RETRIES = 3;
// --- Keys for Modals ---
const DISCLAIMER_KEY = 'okemoDisclaimerAccepted';
const NOTES_SEEN_KEY = 'okemo-notes-v0.2.1-seen'; // This key resets the modal for every new version!
// --- End Keys for Modals ---

// Set maximum visible height for the textarea in pixels (e.g., 3-4 lines)
const MAX_TEXTAREA_HEIGHT = 150; 

// --- New Token Limit Variable ---
const MAX_CHARS = 500;

// --- Tooltip State ---
let currentTooltip = null;
let hideTimeout = null; 
// --- End Tooltip State ---

// --- Element Selectors (Declared globally, initialized in DOMContentLoaded) ---
let textarea;
let disclaimerAgreeButton;
let disclaimerCheckbox;
let menuToggleButton;
let newChatLink1;
let newChatLink2;
let updateNotesLink; 
let okemoPlusButton;
let okemoSendButton;
let updateNotesCloseBtn; 
let updateNotesCheckbox; 

let dropdown;
let plusMenu;
let disclaimerModal;
let updateNotesModal; 
let plusIcon;
let menuIcon; // Single icon reference for the header dropdown
let updateBadge; 

let emptyChatPrompt;
let okemoChatBox;

// --- NEW FEEDBACK GLOBALS (will be null unless a response is rendered) ---
let goodFeedbackButton; 
let badFeedbackButton;
// --- END NEW FEEDBACK GLOBALS ---


function initializeElements() {
    // Selectors for elements used directly in logic
    textarea = document.getElementById('okemo-input');
    disclaimerAgreeButton = document.getElementById('disclaimer-agree');
    disclaimerCheckbox = document.getElementById('dont-show-again'); // Existing checkbox
    menuToggleButton = document.getElementById('menu-toggle');
    okemoSendButton = document.getElementById('okemo-send');

    // **UPDATE NOTES ELEMENTS**
    updateNotesModal = document.getElementById('update-notes-modal');
    updateNotesCloseBtn = document.getElementById('update-notes-close');
    updateNotesCheckbox = document.getElementById('notes-dont-show-again');
    updateBadge = document.getElementById('update-note-badge');
    
    // Selectors for container/menu elements
    dropdown = document.getElementById('okemo-dropdown');
    disclaimerModal = document.getElementById('disclaimer-modal');
    okemoChatBox = document.getElementById('okemo-chat'); // Selected the chatbox itself
    
    // Selectors for icons and links that need event listeners or state changes
    menuIcon = document.getElementById('menu-icon');
    
    // Links 
    newChatLink1 = document.getElementById('new-chat-dropdown-1');
    newChatLink2 = document.getElementById('new-chat-dropdown-2');
    updateNotesLink = document.getElementById('show-update-notes'); 
    
    // Placeholder and wrapper initialization
    emptyChatPrompt = document.getElementById('empty-chat-prompt'); // Selected the big prompt
}

// --- Core Functions ---

// --- Tooltip Functions (Unchanged for brevity) ---

/**
 * Creates, styles, and positions a custom tooltip div relative to the button's screen position.
 * The tooltip is appended to document.body and uses fixed positioning to avoid clipping.
 * @param {Event} event - The mouseover event.
 */
function showTooltip(event) {
    // Clear any pending hide operation immediately
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }

    const button = event.currentTarget;
    const content = button.getAttribute('data-tooltip-content');
    
    if (!content) return;

    // Remove existing tooltip immediately before creating a new one
    if (currentTooltip && currentTooltip.parentNode) {
        currentTooltip.parentNode.removeChild(currentTooltip);
        currentTooltip = null;
    }

    // Create the tooltip element
    const tooltip = document.createElement('div');
    tooltip.id = 'dynamic-tooltip';
    // *** FIX: Use 'fixed' positioning and a high z-index (z-[9999] in Tailwind) ***
    tooltip.className = 'fixed z-[9999] px-2 py-1 text-xs text-white bg-gray-800 rounded-lg shadow-xl opacity-0 transition-opacity duration-200 pointer-events-none whitespace-nowrap';
    tooltip.textContent = content;

    // *** FIX: Append to the document body to escape parent stacking contexts ***
    document.body.appendChild(tooltip); 
    currentTooltip = tooltip;

    // --- Positioning Logic Relative to the Button's Screen Position ---
    
    const buttonRect = button.getBoundingClientRect();

    // Must calculate size after appending to DOM (forces immediate rendering/measurement)
    void tooltip.offsetWidth; 
    const tooltipWidth = tooltip.offsetWidth; 
    
    // Position 8px below the button and centered horizontally, using screen coordinates (buttonRect)
    const top = buttonRect.bottom + 8; // Position 8px below the button bottom
    const left = buttonRect.left + (buttonRect.width / 2) - (tooltipWidth / 2);

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // Fade in
    setTimeout(() => {
        tooltip.classList.remove('opacity-0');
        tooltip.classList.add('opacity-100');
    }, 10);
}

/**
 * Hides and removes the currently visible tooltip with a short delay corresponding to the CSS transition.
 * @param {number} duration - The transition duration in milliseconds. Defaults to 200ms.
 */
function hideTooltip(duration = 200) {
    if (hideTimeout) {
        clearTimeout(hideTimeout);
    }
    
    if (currentTooltip) {
        currentTooltip.classList.remove('opacity-100');
        currentTooltip.classList.add('opacity-0');
        
        // Remove after the CSS transition (duration)
        hideTimeout = setTimeout(() => {
            if (currentTooltip && document.body.contains(currentTooltip)) {
                // Ensure removal from document.body
                document.body.removeChild(currentTooltip); 
            }
            currentTooltip = null;
            hideTimeout = null; // Clear timeout reference
        }, duration);
    }
}
// --- End Tooltip Functions ---

/**
* Toggles the visibility of the large centered prompt.
*/
function updateEmptyChatPromptVisibility() {
    if (emptyChatPrompt) {
        // Show if history is empty
        if (history.length === 0) {
            // Ensure visibility for incoming display
            emptyChatPrompt.classList.remove('hidden');
            emptyChatPrompt.style.opacity = '1';
        } else {
            // HIDE: Apply fade-out and then hide completely
            emptyChatPrompt.style.opacity = '0';
            setTimeout(() => {
                emptyChatPrompt.classList.add('hidden');
            }, 300); // Matches the default transition duration
        }
    }
}


// ---------------------------------------------------------------------
// --- DISCLAIMER MODAL FUNCTIONS ---
// ---------------------------------------------------------------------
/**
 * Checks local storage and hides the modal if the user previously agreed not to see it.
 */
function checkDisclaimerStatus() {
    const accepted = localStorage.getItem(DISCLAIMER_KEY);
    
    if (disclaimerModal) {
        if (accepted !== 'true') {
            // Only show modal if preference NOT found
            disclaimerModal.classList.remove('hidden', 'opacity-0');
        }
    }
}

/**
 * Hides the disclaimer modal after the user clicks OK, saving preference if checked.
 */
function acceptDisclaimer() {
    if (disclaimerCheckbox && disclaimerCheckbox.checked) {
        localStorage.setItem(DISCLAIMER_KEY, 'true');
    }

    if (disclaimerModal) {
        disclaimerModal.classList.add('opacity-0');
        setTimeout(() => disclaimerModal.classList.add('hidden'), 300);
    }
    
    // IMPORTANT: Check the update notes status again in case the disclaimer was blocking it.
    checkUpdateNotesStatus();
}

// ---------------------------------------------------------------------
// --- UPDATE NOTES MODAL FUNCTIONS (MODIFIED) ---
// ---------------------------------------------------------------------

/**
 * Checks local storage and shows the update notes modal immediately if the user hasn't seen this version.
 */
function checkUpdateNotesStatus() {
    const seen = localStorage.getItem(NOTES_SEEN_KEY);
    
    if (updateNotesModal) {
        if (seen !== 'true') {
            // Show the badge next to the title
            if (updateBadge) {
                updateBadge.classList.remove('hidden');
            }

            // Show instantly if the disclaimer is already accepted/hidden
            // We check the hidden class state to see if the disclaimer is currently active.
            if (disclaimerModal.classList.contains('hidden')) {
                showUpdateNotes();
            }
        } else {
            // Hide the badge if the notes have been seen
            if (updateBadge) {
                updateBadge.classList.add('hidden');
            }
        }
    }
}

/**
 * Shows the update notes modal.
 */
function showUpdateNotes() {
    if (updateNotesModal) {
        // Remove hidden and instantly set to visible
        updateNotesModal.classList.remove('hidden'); 
        // Use a short delay to apply opacity transition for fade-in effect
        setTimeout(() => {
             updateNotesModal.classList.remove('opacity-0');
             updateNotesModal.classList.add('opacity-100');
        }, 10);
       
    }
    if (updateBadge) {
        // Hide badge when modal is opened
        updateBadge.classList.add('hidden'); 
    }
}

/**
 * Hides the update notes modal and marks them as seen immediately.
 */
function closeUpdateNotes() {
    // Mark as seen immediately regardless of checkbox state when the 'Got It!' button is clicked.
    localStorage.setItem(NOTES_SEEN_KEY, 'true');

    if (updateNotesModal) {
        // Instant hide (removes backdrop/modal instantly)
        updateNotesModal.classList.add('hidden');
    }
}

// ---------------------------------------------------------------------
// --- DROPDOWN/CHAT FUNCTIONS (Unchanged for brevity) ---
// ---------------------------------------------------------------------
/**
* Toggles the visibility of the OkemoLLM dropdown menu with transitions.
*/
function toggleDropdown() {
    if (dropdown.classList.contains('hidden')) {
        // OPENING
        dropdown.classList.remove('hidden');
        if (menuToggleButton) menuToggleButton.classList.add('active'); 
        if (menuIcon) menuIcon.classList.add('rotate-180'); // ADD ROTATION
        
        void dropdown.offsetWidth; // Force reflow
        
        dropdown.classList.remove('opacity-0', 'scale-y-0'); 
        dropdown.classList.add('opacity-100', 'scale-y-100');
        
    } else {
        // CLOSING
        closeDropdown();
    }
}

function closeDropdown() {
      if (dropdown && !dropdown.classList.contains('hidden')) {
        if (menuToggleButton) menuToggleButton.classList.remove('active');
        if (menuIcon) menuIcon.classList.remove('rotate-180'); 
        dropdown.classList.remove('opacity-100', 'scale-y-100');
        dropdown.classList.add('opacity-0', 'scale-y-0');
        setTimeout(() => {
            dropdown.classList.add('hidden');
        }, 200);
      }
}


/**
 * Clears history and starts a new chat.
 */
function newChat(e) {
    if (e) e.preventDefault();
    history = [];
    renderChat();
    closeDropdown(); // Use the dedicated close function
    showStatus("New chat started.");
    if (textarea) textarea.focus();
    updateEmptyChatPromptVisibility(); // Update visibility after clearing history
}


/**
* Connects to the Hugging Face Gradio Space.
*/
async function initOkemo() {
    try {
        // Using a check for existence before using the global variable
        if (typeof Client !== 'undefined') {
            gradioClient = await Client.connect(SPACE_ID);
            showStatus("Connected to OkemoLLM!");
            setTimeout(() => showStatus(""), 1500);
        }
    } catch (err) {
        console.error("Failed to connect to OkemoLLM:", err);
        showStatus("Failed to connect to OkemoLLM. Retrying…", true);
        setTimeout(() => initOkemo(), 2000);
    }
}

/**
* Updates the status message at the bottom of the chat.
*/
function showStatus(msg, isError = false, targetElementId = "okemo-status") {
    const el = document.getElementById(targetElementId);
    if (!el) return;
    el.textContent = msg;
    el.className = `min-h-5 text-sm ${isError ? "text-red-600" : "text-gray-500"}`;
}

/**
* Escapes HTML to prevent injection in chat bubbles.
*/
function escapeHTML(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// Function to create the reusable button container HTML
function createButtonContainerHTML(isLastResponse, turnId) {
    // Only the last AI response gets the feedback buttons, but ALL messages get Copy/Export/Regenerate
    const feedbackButtons = isLastResponse ? `
        <button 
            id="good-response-feedback-${turnId}"
            class="text-sm font-medium px-2 py-1 rounded hover:bg-gray-300 transition duration-150"
            data-tooltip-content="Good Response"
        >
            <i class="fa-regular fa-thumbs-up" style="color: #696969ff;"></i>
        </button>
        <button 
            id="bad-response-feedback-${turnId}"
            class="text-sm font-medium px-2 py-1 rounded hover:bg-gray-300 transition duration-150"
            data-tooltip-content="Bad Response"
        >
            <i class="fa-regular fa-thumbs-down" style="color: #696969ff;"></i>
        </button>
    ` : '';
    
    // Add 'always-visible' class if it's the last response
    const visibilityClass = isLastResponse ? 'opacity-100 pointer-events-auto always-visible' : 'opacity-0 pointer-events-none';

    return `
        <div class="flex justify-start items-center transition-opacity duration-300 chat-toolbox ${visibilityClass}" id="regenerate-container-${turnId}">
            ${feedbackButtons}
            <button 
                id="copy-button-${turnId}"
                class="text-sm font-medium px-2 py-1 rounded hover:bg-gray-300 transition duration-150"
                data-tooltip-content="Copy"
            >
                <i class="fa-regular fa-copy" style="color: #696969ff;"></i>
            </button>
            <button 
                id="export-chat-button-${turnId}"
                class="text-sm font-medium px-2 py-1 rounded hover:bg-gray-300 transition duration-150"
                data-tooltip-content="Export as .txt"
            >
                <i class="fa-solid fa-file-export" style="color: #696969ff;"></i>
            </button>
            <button 
                id="regenerate-button-${turnId}"
                class="text-sm font-medium px-2 py-1 rounded hover:bg-gray-300 transition duration-150"
                data-tooltip-content="Regenerate"
            >
                <i class="fas fa-redo-alt" style="color: #696969ff;"></i>
            </button>
        </div>
    `;
}

// Function to attach hover listeners and handle click events for a given turn
function attachToolboxListeners(wrapperEl, index) {
    const turnId = index;
    const toolbox = wrapperEl.querySelector(`#regenerate-container-${turnId}`);
    const isLastTurn = index === history.length - 1;

    if (!toolbox) return;

    // 1. Hover/Visibility Logic (Only attach for non-last turns)
    if (!isLastTurn) {
        wrapperEl.addEventListener('mouseover', () => {
            toolbox.classList.remove('opacity-0', 'pointer-events-none');
            toolbox.classList.add('opacity-100', 'pointer-events-auto');
        });
        wrapperEl.addEventListener('mouseout', () => {
            toolbox.classList.remove('opacity-100', 'pointer-events-auto');
            toolbox.classList.add('opacity-0', 'pointer-events-none');
            hideTooltip(); // Ensure tooltip hides on mouse out
        });
    }

    // 2. Button Click/Tooltip Logic
    const copyButton = toolbox.querySelector(`#copy-button-${turnId}`);
    const exportChatButton = toolbox.querySelector(`#export-chat-button-${turnId}`);
    const regenerateButton = toolbox.querySelector(`#regenerate-button-${turnId}`);
    
    // Feedback buttons are only for the last AI response
    const goodFeedbackButton = toolbox.querySelector(`#good-response-feedback-${turnId}`);
    const badFeedbackButton = toolbox.querySelector(`#bad-response-feedback-${turnId}`);

    if (copyButton) {
        copyButton.addEventListener('click', (e) => {
            e.preventDefault();
            copyResponseByTurnIndex(copyButton, index); 
        });
        copyButton.addEventListener('mouseover', showTooltip);
        copyButton.addEventListener('mouseout', () => hideTooltip());
    }
    
    if (exportChatButton) {
        exportChatButton.addEventListener('click', (e) => {
            e.preventDefault();
            exportChatHistory(exportChatButton);
        });
        exportChatButton.addEventListener('mouseover', showTooltip);
        exportChatButton.addEventListener('mouseout', () => hideTooltip());
    }

    if (regenerateButton) {
        if (isLastTurn) {
            regenerateButton.addEventListener('click', (e) => {
                e.preventDefault();
                sendOkemoMessage(false, e.currentTarget); 
            });
        } else {
             // Disable regeneration for old turns visually and functionally
             regenerateButton.style.opacity = '0.5';
             regenerateButton.style.cursor = 'not-allowed';
             regenerateButton.setAttribute('data-tooltip-content', 'Regeneration only available for the latest turn.');
        }
        regenerateButton.addEventListener('mouseover', showTooltip);
        regenerateButton.addEventListener('mouseout', () => hideTooltip());
    }
    
    // Feedback Listeners (Only exist on the last turn)
    if (goodFeedbackButton) {
        goodFeedbackButton.addEventListener('click', (e) => {
            e.preventDefault();
            sendFeedback("Good Response", true, goodFeedbackButton, badFeedbackButton); 
        });
        goodFeedbackButton.addEventListener('mouseover', showTooltip);
        goodFeedbackButton.addEventListener('mouseout', () => hideTooltip());
    }
    if (badFeedbackButton) {
        badFeedbackButton.addEventListener('click', (e) => {
            e.preventDefault();
            log_only_feedback("Bad Response", goodFeedbackButton, badFeedbackButton); 
        });
        badFeedbackButton.addEventListener('mouseover', showTooltip);
        badFeedbackButton.addEventListener('mouseout', () => hideTooltip());
    }
}


/**
* Renders all chat bubbles from the current history.
*/
function renderChat() {
    const box = okemoChatBox;
    if (!box) return;
    box.innerHTML = "";
    
    // Use a temporary array to store HTML strings
    let htmlContent = [];
    
    for (let i = 0; i < history.length; i++) {
        const [u, a] = history[i];
        const isLastTurn = i === history.length - 1;
        const wrapperId = `chat-turn-${i}`;

        // ----------------------- START TURN WRAPPER -----------------------
        htmlContent.push(`<div id="${wrapperId}" class="chat-turn-wrapper">`);

        // ----------------------- USER MESSAGE -----------------------
        if (u) {
            htmlContent.push(`
                    <div class="user-message-row mb-3 flex justify-end">
                        <div class="inline-block max-w-[85%] rounded-2xl px-4 py-2 bg-neutral-200 transform transition duration-150 ease-out">
                            ${escapeHTML(u)}
                        </div>
                    </div>`);
        }
        
        // ----------------------- ASSISTANT MESSAGE -----------------------
        if (a) {
            htmlContent.push(`
                <div class="ai-message-row mb-1 flex items-start gap-2 mt-7"> 
                    <img src="/src/Vailailogo.svg" alt="AI logo" class="w-8 h-8 rounded-full mt-1"/> 
                    <div class="max-w-[85%] text-gray-900 pt-1"> 
                        ${escapeHTML(a)}
                    </div>
                </div>
                <div class="mb-4 flex justify-start pl-9 relative chat-turn-buttons">
                    ${createButtonContainerHTML(isLastTurn, i)}
                </div>`);
        } else if (u && !a) {
             // If user message is last and waiting for response, it still needs its wrapper closed.
        }
        
        // ----------------------- END TURN WRAPPER -----------------------
        htmlContent.push(`</div>`);
    }
    
    // Write all content to the DOM once
    box.innerHTML = htmlContent.join('');
    
    // --- Attach Listeners to EVERY Turn Wrapper ---
    for (let i = 0; i < history.length; i++) {
        const turnWrapper = document.getElementById(`chat-turn-${i}`);
        if (turnWrapper) {
            attachToolboxListeners(turnWrapper, i);
        }
    }
    
    updateEmptyChatPromptVisibility(); // Check and hide/show the big prompt
    box.scrollTop = box.scrollHeight; // Scroll to the latest message
}


/**
 * Copies the text of a specific response (User or AI) to the clipboard.
 * @param {HTMLElement} btn - The button element to visually update.
 * @param {number} turnIndex - The index in the history array to copy from.
 */
function copyResponseByTurnIndex(btn, turnIndex) {
    if (turnIndex < 0 || turnIndex >= history.length) {
        showStatus("Invalid message index.", true);
        return;
    }

    const [userMsg, aiMsg] = history[turnIndex];
    
    // If the button is in an AI message context (meaning aiMsg exists), copy the AI text.
    // If the button is in a User-only context (only userMsg exists), copy the user text.
    const textToCopy = aiMsg || userMsg; 
    
    if (!textToCopy) {
        showStatus("Nothing to copy.", true);
        return;
    }

    // Standard copy logic implementation
    const originalIconClass = 'fa-regular fa-copy';
    const successIconClass = 'fa-solid fa-check';
    const originalIconColor = '#696969ff';
    const successIconColor = '#16a34a';

    // Create a temporary textarea element to hold the text
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = textToCopy;
    
    tempTextarea.style.position = 'fixed';
    tempTextarea.style.top = 0;
    tempTextarea.style.left = 0;
    tempTextarea.style.opacity = 0;
    document.body.appendChild(tempTextarea);
    
    tempTextarea.select();
    tempTextarea.setSelectionRange(0, 99999); 
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showStatus("Response copied to clipboard! ✅");
            
            // Visual feedback on the button
            if (btn) {
                btn.innerHTML = `<i class="${successIconClass}" style="color: ${successIconColor};"></i>`;
                setTimeout(() => {
                    btn.innerHTML = `<i class="${originalIconClass}" style="color: ${originalIconColor};"></i>`;
                }, 1500);
            }
        } else {
            throw new Error("Copy command failed.");
        }
    } catch (err) {
        console.error('Copy failed:', err);
        showStatus("Failed to copy. Please try manually.", true);
    } finally {
        document.body.removeChild(tempTextarea);
    }
}


/**
 * Exports the entire chat history to a downloadable .txt file.
 * @param {HTMLElement} btn - The button element to visually update.
 */
function exportChatHistory(btn) {
    if (history.length === 0) {
        showStatus("No conversation to export. Start chatting first! 📝", true);
        return;
    }

    // 1. Format the conversation for export
    let fileContent = `OkemoLLM Chat Export - ${new Date().toLocaleString()}\n`;
    fileContent += "---------------------------------------\n\n";

    history.forEach(([user, assistant]) => {
        // Only include turns where there was a user message
        if (user) {
            fileContent += `USER: ${user}\n`;
        }
        if (assistant) {
            fileContent += `OKEMO: ${assistant}\n\n`;
        }
    });

    // 2. Create a Blob and a download link
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Set filename
    a.download = `okemo_chat_export_${new Date().toISOString().slice(0, 10)}.txt`;
    a.href = url;
    
    // 3. Programmatically click the link to trigger the download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // 4. Clean up the URL object
    URL.revokeObjectURL(url);

    // 5. Provide visual feedback
    showStatus("Chat exported successfully! 📤");
    
    // Visual feedback on the button itself 
    if (btn) {
        const originalIcon = '<i class="fa-solid fa-file-export" style="color: #696969ff;"></i>';
        const successIcon = '<i class="fa-solid fa-check" style="color: #16a34a;"></i>';

        btn.innerHTML = successIcon;
        setTimeout(() => {
            // Revert icon back to export
            btn.innerHTML = originalIcon;
        }, 1500);
    }
    
    setTimeout(() => showStatus(""), 2000); 
}


/**
 * Sends feedback (Good/Bad) to the Gradio space.
 * @param {string} rating - "Good Response" or "Bad Response".
 * @param {boolean} triggerLearning - Whether to trigger the online update hook on the server.
 * @param {HTMLElement} goodBtn - The Good Response button element.
 * @param {HTMLElement} badBtn - The Bad Response button element.
 */
async function sendFeedback(rating, triggerLearning, goodBtn, badBtn) {
    if (history.length === 0) {
        showStatus("No message to rate. Start a conversation first! 🤷‍♀️", true);
        return;
    }
    
    // Only disable the feedback buttons
    if (goodBtn) goodBtn.disabled = true;
    if (badBtn) badBtn.disabled = true;
    
    const loadingBar = document.getElementById("okemo-loading-bar");
    if (loadingBar) loadingBar.classList.remove('hidden');
    
    showStatus(`Sending feedback: ${rating}...`);

    try {
        if (!gradioClient) await initOkemo();

        const endpoint = triggerLearning ? "/feedback_good" : "/feedback_bad";
        const result = await gradioClient.predict(endpoint, [history, rating]);

        const feedbackMessage = result?.data?.[1] || `${rating} logged successfully.`;
        
        showStatus(feedbackMessage);

        // Re-render is fine, but we need to ensure the other buttons (Copy/Export/Regen) remain active.
        renderChat(); 

    } catch (err) {
        console.error("Feedback submission error:", err);
        showStatus(`Error submitting feedback. Please check the console.`, true);
    } finally {
        if (loadingBar) loadingBar.classList.add('hidden');
        // If the re-render failed, we still ensure the feedback buttons are disabled to prevent duplicate ratings.
        if (goodBtn) goodBtn.disabled = true;
        if (badBtn) badBtn.disabled = true;
        
        setTimeout(() => showStatus(""), 2000); 
    }
}

/**
 * Logs negative feedback locally without a Gradio API call for instant response.
 * @param {string} rating - The rating string.
 * @param {HTMLElement} goodBtn - The Good Response button element.
 * @param {HTMLElement} badBtn - The Bad Response button element.
 */
function log_only_feedback(rating, goodBtn, badBtn) {
    if (history.length === 0) {
        showStatus("No message to rate. Start a conversation first! 🤷‍♀️", true);
        return;
    }

    // Only disable the feedback buttons
    if (goodBtn) goodBtn.disabled = true;
    if (badBtn) badBtn.disabled = true;

    const lastTurn = history[history.length - 1];
    const lastUserMessage = lastTurn ? lastTurn[0] : "N/A";
    const lastAiResponse = lastTurn ? lastTurn[1] : "N/A";

    console.warn(`\n--- LOCAL NEGATIVE FEEDBACK LOGGED ---`);
    console.warn(`Rating: ${rating}`);
    console.warn(`User Prompt: '${lastUserMessage}'`);
    console.warn(`AI Response: '${lastAiResponse}'`);
    console.warn(`----------------------------------------\n`);

    const feedbackMessage = `Thanks for the feedback! You rated the last response as ${rating}.`;
    showStatus(feedbackMessage);
    
    // We can re-render the chat here to ensure the buttons are disabled visually.
    renderChat(); 
    
    setTimeout(() => showStatus(""), 2000); 
}
// --- END NEW FEEDBACK FUNCTION ---

/**
 * Sends a message to the OkemoLLM model (Gradio).
 * This function is also used by the Regenerate button.
 */
async function sendOkemoMessage(isPlusMenuAction = false, element = null) {

    // Use pre-selected global elements
    const inputEl = textarea;
    const btnEl = okemoSendButton;
    const loadingBar = document.getElementById("okemo-loading-bar"); 
    
    if (!inputEl || !btnEl || !loadingBar) return; 

    // Use the value from the textarea
    let userMsg = inputEl.value.trim(); 

    // Determine the type of action
    const isRegenerate = element && element.id.includes('regenerate-button');
    const isStandardSend = !isRegenerate; 

    // --- CHARACTER LIMIT CHECK ---
    if (isStandardSend && userMsg.length > MAX_CHARS) {
        showStatus(`Message exceeds maximum limit of ${MAX_CHARS} characters.`, true);
        return;
    }
    
    let messageToSendToAPI = userMsg;
    let cleanUserMessageForHistory = userMsg; 

    if (isRegenerate) {
        if (history.length === 0) {
            showStatus("Please type a message before requesting regeneration.", true);
            return;
        }
        
        const lastUserMessage = history[history.length - 1][0];
        if (!lastUserMessage) {
             showStatus("Cannot regenerate: last user message was empty.", true);
             return;
        }

        const requestType = "Please generate a completely new and distinct response for the following";
        messageToSendToAPI = `${requestType}: "${lastUserMessage}"`;
        
        if (history.length > 0) {
             history[history.length - 1][1] = null;
        }
        
        cleanUserMessageForHistory = lastUserMessage;
        
    } else {
        if (!userMsg) return; // If standard send and message is empty
    }
    
    // Disable all buttons in the last toolbox during API call
    const toolbox = document.querySelector('.chat-toolbox.always-visible');
    if (toolbox) {
        toolbox.querySelectorAll('button').forEach(button => button.disabled = true);
    }


    // Prepare UI for sending: Disable button, show status, show loading bar
    btnEl.disabled = true;
    btnEl.classList.add("opacity-50", "cursor-not-allowed");
    loadingBar.classList.remove('hidden');
    showStatus("OkemoLLM Thinking...");
    
    // 1. Prepare history for server
    const historyToSend = [...history]; 
    
    // Optimistic Update: Add new user message locally if it was a new send
    if (isStandardSend) {
        history.push([cleanUserMessageForHistory, null]); 
    }
    renderChat();

    try {
        if (!gradioClient) {
            showStatus("Connecting to OkemoLLM…", true);
            await initOkemo();
            if (!gradioClient) {
                throw new Error("Failed to connect to OkemoLLM.");
            }
        }
        
        if (isStandardSend) {
            inputEl.value = ""; 
            inputEl.style.height = '48px'; 
        }

        const result = await gradioClient.predict("/on_submit", [messageToSendToAPI, historyToSend]); 
        const updatedHistoryFromServer = result?.data?.[0];

        if (Array.isArray(updatedHistoryFromServer)) {
            const lastTurnIndex = updatedHistoryFromServer.length - 1;
            if (lastTurnIndex >= 0) {
                 updatedHistoryFromServer[lastTurnIndex][0] = cleanUserMessageForHistory; 
            }
            
            history = updatedHistoryFromServer; 
            showStatus("Received response from OkemoLLM.");
        } else {
            console.warn("OkemoLLM response did not contain a valid history array.");
            throw new Error("Invalid response from OkemoLLM.");
        }
        
    } catch (err) {
        console.error("Prediction error:", err);
        showStatus(`Error: ${err.message || "Unknown error."}`, true);
        if (history.length > 0 && history[history.length - 1][1] === null) {
             history[history.length - 1][1] = "Error: Could not get response.";
        }
    } finally {
        loadingBar.classList.add('hidden');
        renderChat(); // Re-render to show new history and re-enable buttons
        okemoSendButton.disabled = false;
        okemoSendButton.classList.remove("opacity-50", "cursor-not-allowed");
        
        setTimeout(() => showStatus(""), 1500); 
    }
}

// --- Input and Event Binding ---

function bindInput() {
    // Event listener for auto-resizing the textarea
    if (textarea) {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            const minHeight = 48; // Updated min-height in JS
            const MAX_HEIGHT_PIXELS = MAX_TEXTAREA_HEIGHT; // Use variable
            const newHeight = Math.min(this.scrollHeight, MAX_TEXTAREA_HEIGHT); 

            // --- Show/Hide Prompt Logic (Typing) ---
            if (emptyChatPrompt) {
                 if (this.value.trim().length > 0) {
                    // Start fade out animation immediately on typing
                    emptyChatPrompt.style.opacity = '0';
                    setTimeout(() => emptyChatPrompt.classList.add('hidden'), 300);
                 } else {
                    // Only show if history is empty (checked by renderChat)
                    updateEmptyChatPromptVisibility(); 
                 }
            }
            // --- END Prompt Logic ---

            // --- TOKEN LIMIT CHECK IN UI ---
            if (this.value.length > MAX_CHARS) {
                this.value = this.value.substring(0, MAX_CHARS);
                // Optionally visually indicate that the limit was reached
            }
            // --- END TOKEN LIMIT CHECK ---

            this.style.height = Math.max(minHeight, newHeight) + 'px';
        });
        
        // Handle Focus/Blur to hide/show prompt even when text is empty
        if (emptyChatPrompt) {
            textarea.addEventListener('focus', () => {
                 // Start fade out animation immediately on focus
                emptyChatPrompt.style.opacity = '0';
                setTimeout(() => emptyChatPrompt.classList.add('hidden'), 300);
            });
            
            textarea.addEventListener('blur', () => {
                if (textarea.value.trim().length === 0) {
                    // Use a slight delay to allow UI state to update before checking history
                    setTimeout(() => {
                        updateEmptyChatPromptVisibility();
                    }, 50);
                }
            });
        }

        // Event listener for Enter/Shift+Enter behavior
        textarea.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendOkemoMessage(false);
            }
        });
    }
}

// --- Wrapper Functions for HTML Onclick ---
window.toggleDropdown = toggleDropdown;
window.newChat = newChat;
window.acceptDisclaimer = acceptDisclaimer;
window.sendOkemoMessage = sendOkemoMessage;
window.exportChatHistory = exportChatHistory; 
window.showUpdateNotes = showUpdateNotes; 

// Final DOM Content Loaded setup
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize global element references
    initializeElements(); 

    // 2. --- Hook up Event Listeners ---
    
    // Disclaimer
    if (disclaimerAgreeButton) disclaimerAgreeButton.addEventListener('click', acceptDisclaimer);
    
    // Update Notes 
    if (updateNotesCloseBtn) updateNotesCloseBtn.addEventListener('click', closeUpdateNotes);
    if (updateNotesLink) {
        updateNotesLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeDropdown();
            showUpdateNotes();
        });
    }

    // Header Menu
    if (menuToggleButton) menuToggleButton.addEventListener('click', toggleDropdown);

    // Input Bar Actions
    if (okemoSendButton) okemoSendButton.addEventListener('click', () => sendOkemoMessage(false));
    
    // Dropdown link handlers
    if (newChatLink1) newChatLink1.addEventListener('click', newChat);
    if (newChatLink2) newChatLink2.addEventListener('click', newChat);

    // --- Initial setup ---
    initOkemo();
    bindInput();
    checkDisclaimerStatus();
    checkUpdateNotesStatus(); // This will handle showing the modal or badge
    updateEmptyChatPromptVisibility(); // Initial check to display if history is empty
});