import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const SPACE_ID = "ar12c/okemo2"; // Gradio Space for main chat
let gradioClient = null; 
let history = []; // array of [user, assistant] turns
const MAX_RETRIES = 3;
const DISCLAIMER_KEY = 'okemoDisclaimerAccepted';
// Set maximum visible height for the textarea in pixels (e.g., 3-4 lines)
const MAX_TEXTAREA_HEIGHT = 150; 

// --- New Token Limit Variable ---
const MAX_CHARS = 500;

// --- Element Selectors (Declared globally, initialized in DOMContentLoaded) ---
let textarea;
let disclaimerAgreeButton;
let menuToggleButton;
let newChatLink1;
let newChatLink2;
let okemoPlusButton;
let okemoSendButton;
let thinkLongerLink;
let betterResponseLink;

let dropdown;
let plusMenu;
let disclaimerModal;
let plusIcon;
let menuIcon; // Single icon reference for the header dropdown

let emptyChatPrompt;
let okemoChatBox;


function initializeElements() {
    // Selectors for elements used directly in logic
    textarea = document.getElementById('okemo-input');
    disclaimerAgreeButton = document.getElementById('disclaimer-agree');
    menuToggleButton = document.getElementById('menu-toggle');
    okemoSendButton = document.getElementById('okemo-send');

    // Selectors for container/menu elements
    dropdown = document.getElementById('okemo-dropdown');
    disclaimerModal = document.getElementById('disclaimer-modal');
    okemoChatBox = document.getElementById('okemo-chat'); // Selected the chatbox itself
    
    // Selectors for icons and links that need event listeners or state changes
    menuIcon = document.getElementById('menu-icon');
    
    // Links (Note: Plus Menu elements are dynamically added for simplicity)
    newChatLink1 = document.getElementById('new-chat-dropdown-1');
    newChatLink2 = document.getElementById('new-chat-dropdown-2');
    
    // NEW: Placeholder and wrapper initialization
    emptyChatPrompt = document.getElementById('empty-chat-prompt'); // Selected the big prompt
}

// --- Core Functions ---

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


/**
* Checks local storage and hides the modal if the user previously agreed not to see it.
*/
function checkDisclaimerStatus() {
    const accepted = localStorage.getItem(DISCLAIMER_KEY);
    const modal = disclaimerModal;

    if (modal) {
        if (accepted !== 'true') {
            // Only show modal if preference NOT found
            modal.classList.remove('hidden', 'opacity-0');
        }
    }
}

/**
* Hides the disclaimer modal after the user clicks OK, saving preference if checked.
*/
function acceptDisclaimer() {
    const checkbox = document.getElementById('dont-show-again');
    
    if (checkbox && checkbox.checked) {
        localStorage.setItem(DISCLAIMER_KEY, 'true');
    }

    if (disclaimerModal) {
        disclaimerModal.classList.add('opacity-0');
        setTimeout(() => disclaimerModal.classList.add('hidden'), 300);
    }
}


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
        if (menuToggleButton) menuToggleButton.classList.remove('active');
        if (menuIcon) menuIcon.classList.remove('rotate-180'); // REMOVE ROTATION
        
        dropdown.classList.remove('opacity-100', 'scale-y-100');
        dropdown.classList.add('opacity-0', 'scale-y-0');
        
        setTimeout(() => {
            dropdown.classList.add('hidden');
        }, 200);
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
    toggleDropdown();
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
        
        if (u) {
            // User message
            htmlContent.push(`
                <div class="mb-3 flex justify-end">
                    <div class="inline-block max-w-[85%] rounded-2xl px-4 py-2 bg-neutral-200 transform transition duration-150 ease-out">
                        ${escapeHTML(u)}
                    </div>
                </div>`);
        }
        
        if (a) {
            // Assistant message
            htmlContent.push(`
                <div class="mb-1 flex items-start gap-2"> 
                    <img src="/src/Vailailogo.svg" alt="AI logo" class="w-8 h-8 rounded-full mt-1"/> 
                    <div class="max-w-[85%] text-gray-900 pt-1"> 
                        ${escapeHTML(a)}
                    </div>
                </div>`);
        }
        
        // If this is the very last response by the AI, add the regeneration buttons container
        if (i === history.length - 1 && a) {
            htmlContent.push(`
                <div class="mb-4 flex justify-start pl-9 gap-5" id="regenerate-container">
                    <button 
                        id="regenerate-button"
                        class="text-sm font-medium rounded-full hover:bg-gray-300 transition duration-150"
                    >
                        <i class="fas fa-redo-alt px-1" style="color: #000000;"></i>
                    </button>
                    <button 
                        id="think-longer-button"
                        class="text-sm font-medium px-1 rounded-full hover:bg-gray-300 transition duration-150"
                    >
                        <i class="fa-solid fa-hourglass" style="color: #000000;"></i>                    </button>
                    <button 
                        id="better-response-button"
                        class="text-sm font-medium px-1 rounded-full hover:bg-gray-300 transition duration-150"
                    >
                        <i class="fa-solid fa-brain" style="color: #000000;"></i>                    </button>
                </div>`);
        }
    }
    
    // Write all content to the DOM once
    box.innerHTML = htmlContent.join('');
    
    // Attach event listeners to the dynamically created buttons
    const regenerateButton = document.getElementById('regenerate-button');
    const thinkLongerButton = document.getElementById('think-longer-button');
    const betterResponseButton = document.getElementById('better-response-button');

    if (regenerateButton) {
        regenerateButton.addEventListener('click', (e) => {
             e.preventDefault();
            // Flag regeneration as true (isPlusMenuAction=false, handled by isRegenerate logic)
            sendOkemoMessage(false, e.currentTarget); 
        });
    }
    if (thinkLongerButton) {
        // Flag as Plus Menu Action (isPlusMenuAction=true)
        thinkLongerButton.addEventListener('click', (e) => {
            e.preventDefault();
            sendOkemoMessage(true, e.currentTarget);
        });
    }
     if (betterResponseButton) {
        // Flag as Plus Menu Action (isPlusMenuAction=true)
        betterResponseButton.addEventListener('click', (e) => {
            e.preventDefault();
            sendOkemoMessage(true, e.currentTarget);
        });
    }


    // Scroll to the latest message
    box.scrollTop = box.scrollHeight;
    
    updateEmptyChatPromptVisibility(); // Check and hide/show the big prompt
}

/**
 * Sends a message to the OkemoLLM model (Gradio).
 * This function is also used by the "Better Response" button and Regenerate button.
 * The logic uses the 'element' parameter to distinguish between standard, plus menu, and regenerate requests.
 */
async function sendOkemoMessage(isPlusMenuAction = false, element = null) {

    // Use pre-selected global elements
    const inputEl = textarea;
    const btnEl = okemoSendButton;
    // NOTE: okemoPlusButton is gone, but we retain reference for completeness if logic needed it
    const plusBtnEl = document.getElementById('okemo-plus-button'); 
    const loadingBar = document.getElementById("okemo-loading-bar"); 
    
    if (!inputEl || !btnEl || !loadingBar) return; 

    // Use the value from the textarea
    let userMsg = inputEl.value.trim(); 

    // Determine the type of action
    const isRegenerate = element && element.id === 'regenerate-button';
    const isStandardSend = !isPlusMenuAction && !isRegenerate;

    // --- CHARACTER LIMIT CHECK ---
    if (isStandardSend && userMsg.length > MAX_CHARS) {
        showStatus(`Message exceeds maximum limit of ${MAX_CHARS} characters.`, true);
        return;
    }
    
    // A variable to hold the final message sent to Gradio (which might include the instruction prefix)
    let messageToSendToAPI = userMsg;
    
    // --- Message Logic Setup ---
    let cleanUserMessageForHistory = userMsg; // Store the original text for history purposes

    if (isPlusMenuAction || isRegenerate) {
        if (history.length === 0) {
            showStatus("Please type a message before requesting an action.", true);
            return;
        }
        
        // 1. Get the CLEAN user message from the last turn in history
        const lastUserMessage = history[history.length - 1][0];
        if (!lastUserMessage) {
             showStatus("Cannot perform action: last user message was empty.", true);
             return;
        }

        let requestType = "";
        
        // --- START CONSTRUCTING API INSTRUCTION (FOR API CALL ONLY) ---
        if (isRegenerate) {
            requestType = "Please generate a completely new and distinct response for the following prompt";
        } else {
            // Handle Think Longer / Better Response logic from the inline buttons
            const buttonText = element ? element.textContent : "";
            requestType = buttonText.includes("Think longer") ? 
                          "Provide a much more detailed, expansive, and deeper analysis of the last question" : 
                          "Provide a different, more creative, or alternative version of the last response";
        }

        // 2. Prepend the instruction to the original user prompt for the API call only
        messageToSendToAPI = `${requestType}: "${lastUserMessage}"`;
        
        // 3. Optimistically clear the last AI response (the one we are replacing/regenerating)
        if (history.length > 0) {
             history[history.length - 1][1] = null;
        }
        
        // 4. Ensure the clean original message is used for the history update later
        cleanUserMessageForHistory = lastUserMessage;
        
    } else {
        if (!userMsg) return; // If standard send and message is empty
    }
    // --- End Message Logic Setup ---


    // Prepare UI for sending: Disable button, show status, show loading bar
    btnEl.disabled = true;
    
    btnEl.classList.add("opacity-50", "cursor-not-allowed");
    loadingBar.classList.remove('hidden');
    showStatus("OkemoLLM Thinking...");
    
    // 1. Prepare history for server
    const historyToSend = [...history]; 
    
    // Optimistic Update: Add new user message locally if it was a new send
    if (isStandardSend) {
        // IMPORTANT: Save ONLY the clean user message to history.
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
            // Reset height after sending a new message
            inputEl.style.height = '48px'; // Set back to 48px min-height
        }

        // 2. Use the messageToSendToAPI variable for the API call
        const result = await gradioClient.predict("/on_submit", [messageToSendToAPI, historyToSend]); 
        const updatedHistoryFromServer = result?.data?.[0];

        if (Array.isArray(updatedHistoryFromServer)) {
            // CRITICAL FIX: Overwrite the potentially prefixed message returned by the server 
            // with the clean user message (cleanUserMessageForHistory) BEFORE saving to history.
            const lastTurnIndex = updatedHistoryFromServer.length - 1;
            if (lastTurnIndex >= 0) {
                 // **ALWAYS** overwrite the user message in the last turn with the clean local text, 
                 // regardless of the action type.
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
        renderChat(); 
        okemoSendButton.disabled = false;
        okemoSendButton.classList.remove("opacity-50", "cursor-not-allowed");
        
        // Re-enable dynamically created buttons
        const regenerateButton = document.getElementById('regenerate-button');
        const thinkLongerButton = document.getElementById('think-longer-button');
        const betterResponseButton = document.getElementById('better-response-button');
        
        if (regenerateButton) regenerateButton.disabled = false;
        if (thinkLongerButton) thinkLongerButton.disabled = false;
        if (betterResponseButton) betterResponseButton.disabled = false;

        setTimeout(() => showStatus(""), 1500); 
    }
}

/**
 * Wrapper function for the "Better Response" option.
 */
window.requestBetterResponse = function(e) {
    // Flag as Plus Menu Action (isPlusMenuAction=true)
    sendOkemoMessage(true, e.currentTarget);
}

/**
 * Wrapper function for the "Thinking Longer" option.
 */
window.sendThinkingLonger = function(e) {
    // Flag as Plus Menu Action (isPlusMenuAction=true)
    sendOkemoMessage(true, e.currentTarget);
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

// Final DOM Content Loaded setup
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize global element references
    initializeElements(); 

    // 2. --- Hook up Event Listeners ---
    
    // Disclaimer
    if (disclaimerAgreeButton) disclaimerAgreeButton.addEventListener('click', acceptDisclaimer);
    
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
    updateEmptyChatPromptVisibility(); // Initial check to display if history is empty
});
