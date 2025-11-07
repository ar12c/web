// chat.js — OkemoLLM frontend integrator for Hugging Face Space "ar12c/okemo2"
// Complete script: dropdowns, disclaimer/update modals, file/image attachments,
// ChatGPT-like toolbox, streaming via Gradio Client, whitespace-normalized AI rendering.

import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

// --- MODEL CONFIGURATION ---
const MODEL_CONFIG = {
    BASE: {
        id: "ar12c/okemo2",
        name: "OLM 0.5"
    },
    PRO: {
        // Using all-lowercase ID for reliable URL construction
        id: "ar12c/okemollm", 
        name: "OLM 0.5 Pro"
    }
};

let currentSpaceId = MODEL_CONFIG.BASE.id; 
let gradioClient = null;
// ----------------------------

// Local chat state
let history = []; // [[userMsg, aiMsg], ...]
let currentFile = null;
const MAX_TEXTAREA_HEIGHT = 300;
const MAX_CHARS = 1024;

// Persisted flags
const DISCLAIMER_AGREED_KEY = "okemo_disclaimer_agreed";
const UPDATE_NOTES_KEY = "okemo_update_v0.2.0"; // bump this when you ship new notes

// UI elements
let textarea, sendButton, chatBox, loadingBar, fileUploadInput, imageUploadInput, filePreviewContainer, emptyChatPrompt, statusEl, modelTitleEl;
let menuToggle, okemoDropdown, plusMenuToggle, inputDropdown;
let disclaimerModal, updateNotesModal, badFeedbackModal, badInput;
let modelSelectBase, modelSelectPro; // NEW UI elements for model selection

// --- CRITICAL CONSTANT ---
const WEB_TOKEN = "<WEB>";
const WEB_ICON = "🌐"; // Globe icon for display

// --- NEW CoT CONSTANT ---
// Marker to find and extract the Chain-of-Thought reasoning (Backend must use this format)
const THOUGHT_MARKER_RE = /\[THOUGHT\](.*?)\[\/THOUGHT\]/gs; 
// -------------------------

// Variable to hold the timeout ID for auto-clearing the status message
let statusTimeout = null;

// ------------------------------------------------
// Helpers
// ------------------------------------------------
function escapeHTML(s) {
    if (s === null || s === undefined) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showStatus(msg = "", isError = false) {
    if (!statusEl) return;
    
    // Clear any existing timeout to prevent premature clearing of a new message
    if (statusTimeout) {
        clearTimeout(statusTimeout);
        statusTimeout = null;
    }
    
    statusEl.textContent = msg;
    statusEl.className = isError ? "text-red-500 text-sm mb-1" : "text-neutral-500 dark:text-neutral-400 text-sm mb-1";
    
    // Automatically clear the status bar after 3 seconds
    if (msg) {
        statusTimeout = setTimeout(() => {
            statusEl.textContent = "";
            statusTimeout = null;
        }, 3000); 
    }
}

function ensureHistoryArray(h) {
    if (!Array.isArray(h)) return [];
    if (h.length === 0) return [];
    if (Array.isArray(h[0])) return h; // already [[u,a], ...]
    if (h[0] && typeof h[0] === "object" && h[0].content !== undefined) {
        const asPairs = [];
        for (let i = 0; i < h.length; i += 2) {
            const u = (h[i] && (h[i].content || "")) || "";
            const a = (h[i + 1] && (h[i + 1].content || "")) || null;
            asPairs.push([u, a]);
        }
        return asPairs;
    }
    return [];
}

/**
 * Starts the blinking cursor in the last AI message.
 */
function startCursor() {
    // Select the direct container of the AI's generated text, which is the <div> right after the image
    const lastAiTextContainer = chatBox.querySelector('.ai-message-row:last-child > div:nth-child(2)');
    
    if (lastAiTextContainer) {
        // 1. Stop any existing cursor
        stopCursor(); 
        
        // 2. Create the cursor element
        let cursor = document.createElement('span');
        cursor.classList.add('blinking-cursor');
        // Using the Unicode Block character
        cursor.innerHTML = '&#9608;'; 
        
        // 3. Append the cursor to the text container
        lastAiTextContainer.appendChild(cursor);
        
        // 4. Ensure scroll is maintained
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

/**
 * Stops and removes the blinking cursor.
 */
function stopCursor() {
    // Select the cursor inside the last message row
    const cursor = chatBox.querySelector('.ai-message-row:last-child .blinking-cursor');
    if (cursor && cursor.parentNode) {
        cursor.parentNode.removeChild(cursor);
    }
}

/**
 * Collapse excessive whitespace/newlines, clean up punctuation spacing, and extract CoT.
 * @param {string} text 
 * @returns {string} Formatted HTML.
 */
function formatAiHtml(text) {
    if (!text) return "";

    let thoughtHTML = "";
    let finalAnswer = text;

    // 1. Extract CoT (Chain-of-Thought)
    const match = finalAnswer.match(THOUGHT_MARKER_RE);
    if (match) {
        // Extract the content and remove the marker and thought from the final answer text
        const thoughtContent = match[0].replace(/\[THOUGHT\]|\[\/THOUGHT\]/g, "").trim();
        finalAnswer = finalAnswer.replace(THOUGHT_MARKER_RE, "").trim();

        // Format the thought content
        let t = thoughtContent.replace(/\r/g, "");
        t = t.replace(/[ \t]+/g, " ");
        t = t.replace(/\n{3,}/g, "\n\n");
        t = t.replace(/\s+([,.!?;:"])/g, "$1");
        t = t.replace(/'\s+/g, "'");
        t = t.trim();
        const paragraphs = t.split(/\n{2}/).map(p => escapeHTML(p).replace(/\n/g, "<br/>"));
        const thoughtBodyHTML = paragraphs.map(p => `<p class="text-xs">${p}</p>`).join("");

        // Wrap the thought in a collapsible details tag
        thoughtHTML = `
            <details class="text-xs text-neutral-600 dark:text-neutral-500 my-2 pt-2 border-t border-neutral-300 dark:border-neutral-700">
                <summary class="cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-400">
                    <i class="fa-solid fa-brain mr-1"></i>Internal Reasoning (CoT)
                </summary>
                <div class="mt-2 ml-1 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                    ${thoughtBodyHTML}
                </div>
            </details>
        `;
    }


    // 2. Format Final Answer
    let t = finalAnswer.replace(/\r/g, "");
    t = t.replace(/[ \t]+/g, " "); 
    t = t.replace(/\n{3,}/g, "\n\n"); 
    t = t.replace(/\s+([,.!?;:"])/g, "$1"); 
    t = t.replace(/'\s+/g, "'"); 
    t = t.trim();
    const answerParagraphs = t.split(/\n{2}/).map(p => escapeHTML(p).replace(/\n/g, "<br/>"));
    const answerHTML = answerParagraphs.map(p => `<p>${p}</p>`).join("");
    
    // 3. Combine Thought and Answer
    return answerHTML + thoughtHTML; // Display answer first, then the collapsible thought
}

// Modal helpers
function showModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.remove("opacity-0"), 10);
}

function hideModal(modal) {
    if (!modal) return;
    modal.classList.add("opacity-0");
    setTimeout(() => modal.classList.add("hidden"), 300);
}

// ------------------------------------------------
// ⭐ NEW SELF-CONTAINED Dropdown Logic (Recode)
// ------------------------------------------------

/** Closes a specific dropdown element */
function closeSingleDropdown(toggleEl, dropdownEl) {
    if (!dropdownEl.classList.contains("opacity-100")) return; // Only close if open
    
    // Start transition to close
    dropdownEl.classList.remove("opacity-100");
    dropdownEl.classList.add("opacity-0", "scale-y-0");
    
    toggleEl.classList.remove("active");
    
    // Wait for transition (200ms) then set display to none
    setTimeout(() => {
        dropdownEl.classList.add("hidden");
    }, 200); 
}

/** Opens a specific dropdown element */
function openSingleDropdown(toggleEl, dropdownEl) {
    // 1. Prepare for transition
    dropdownEl.classList.remove("hidden");
    dropdownEl.classList.add("opacity-0", "scale-y-0"); // Ensure initial closed state for transition
    
    // 2. Start transition after a tiny delay
    setTimeout(() => {
        dropdownEl.classList.remove("opacity-0", "scale-y-0");
        dropdownEl.classList.add("opacity-100");
        toggleEl.classList.add("active");
    }, 10);
}

/** Closes all dropdowns */
function closeAllDropdowns() {
    closeSingleDropdown(menuToggle, okemoDropdown);
    closeSingleDropdown(plusMenuToggle, inputDropdown);
}


// ------------------------------------------------
// Model Switching Logic
// ------------------------------------------------
async function switchModel(newSpaceId, newModelName) {
    if (newSpaceId === currentSpaceId) {
        showStatus(`${newModelName} is already active.`);
        return;
    }

    currentSpaceId = newSpaceId;
    gradioClient = null; // Force a new connection

    // Update UI title and status
    document.getElementById("okemo-title").textContent = newModelName.split(' ')[0]; // Use short name (e.g., OLM)
    document.title = `Chat ${newModelName}`; // Update HTML title

    // Clear history to reflect the model change
    history = [];
    renderChat();
    
    showStatus(`Switching to ${newModelName}...`);
    
    // Find all model links and update their styles to reflect the current selection
    [modelSelectBase, modelSelectPro].forEach(link => {
        if (!link) return;
        const linkModelId = link.dataset.modelId;
        if (linkModelId === newSpaceId) {
            link.classList.add("bg-neutral-100", "dark:bg-neutral-700", "font-semibold");
        } else {
            link.classList.remove("bg-neutral-100", "dark:bg-neutral-700", "font-semibold");
        }
    });

    try {
        await initGradioClient();
        showStatus(`${newModelName} is ready ✨`);
    } catch (e) {
        showStatus(`Failed to connect to ${newModelName} Space.`, true);
    }
}

// ------------------------------------------------
// Toolbox actions (Copy, Regenerate, Good/Bad feedback, <WEB> next)
// ------------------------------------------------
async function ensureClient() {
    if (!gradioClient) {
        // Connects to the currentSpaceId
        gradioClient = await Client.connect(currentSpaceId);
    }
    return gradioClient;
}

async function regenerateTurn(turnIndex) {
    try {
        await ensureClient();
        const [userMsg] = history[turnIndex] || ["", ""];
        // CRITICAL: Ensure we remove the WEB_TOKEN and file attachment info before sending to model
        const cleanUserMsg = (userMsg || "")
            .replace(/\s*\(Attached:.*?\)\s*/g, "")
            .replace(/\s*\[IMAGE_PREVIEW_URL:.*?]\s*/g, "")
            .replace(new RegExp(`${WEB_ICON}\\s*`, 'g'), "") // Remove globe icon
            .trim();

        if (!cleanUserMsg) {
            showStatus("Cannot regenerate: empty user message.", true);
            return;
        }

        // Regenerate in-place
        history[turnIndex][1] = null;
        renderChat();
        
        showStatus("Regenerating…");
        startCursor(); // Start cursor immediately after rendering partial chat

        const inputs = [
            cleanUserMsg,
            history.map(([u, a]) => [u, a]),
            null, // do not re-send file by default
            false,
        ];

        const job = gradioClient.submit("/on_submit", inputs);
        for await (const chunk of job) {
            if (chunk && Array.isArray(chunk.data) && chunk.data.length > 0) {
                const serverHistoryCandidate = chunk.data[0];
                const normalized = Array.isArray(serverHistoryCandidate) && Array.isArray(serverHistoryCandidate[0])
                    ? serverHistoryCandidate
                    : ensureHistoryArray(serverHistoryCandidate);

                if (normalized && normalized.length) {
                    // sanitize last turn a bit to avoid odd spacing during stream
                    const last = normalized[normalized.length - 1];
                    if (last && typeof last[1] === "string") {
                        last[1] = last[1]
                            .replace(/[ \t]+/g, " ")
                            .replace(/\s+([,.!?;:"])/g, "$1") // Adjusted for quotes and colons
                            .replace(/'\s+/g, "'");
                    }
                    history = normalized;
                    renderChat();
                    startCursor(); // Re-start cursor after rendering the new chunk
                }

                const status = chunk.data[1];
                if (typeof status === "string") showStatus(status);
            }
        }
        
        // Stop cursor when the stream is complete
        stopCursor();
        const final = await job.result;
        const finalStatus = final?.data?.[1];
        showStatus(finalStatus || "Response complete.");
    } catch (e) {
        console.error("Regenerate failed:", e);
        stopCursor();
        showStatus("Failed to regenerate.", true);
    } 
}

/**
 * Sends feedback to the backend.
 * @param {string} kind - "Good Response" or "Bad Response".
 * @param {string} [message=""] - Optional detailed feedback message for bad responses (used as desired response for /feedback_train).
 */
async function sendFeedback(kind = "Good Response", message = "") {
    try {
        await ensureClient();
        
        let endpoint = null;
        let inputs = [];
        
        if (kind === "Bad Response" && message.length > 0) {
            // FIX: Use the dedicated training endpoint for 'Bad Response' with a message.
            // The endpoint expects (Chat History, Desired Response)
            endpoint = "/feedback_train";
            inputs = [history, message];
            
        } else if (kind === "Good Response") {
            // Placeholder endpoint for Good Feedback (assuming it logs history)
            endpoint = "/feedback_good"; 
            inputs = [history];
        } else {
             // If bad feedback is sent without a message, just log it as a simple failure (or use a simple logging endpoint)
             endpoint = "/feedback_bad";
             inputs = [history, message];
        }

        const result = await gradioClient.predict(endpoint, inputs);
        const reply = result?.data?.[0] || `${kind} recorded.`;
        
        // Show status message for the user
        showStatus(reply);
        
    } catch (e) {
        console.error("Feedback send failed:", e);
        showStatus("Failed to send feedback/training data.", true);
    } 
}

function copyTextToClipboard(text) {
    // CRITICAL: Before copying, remove any internal thought markers
    const cleanText = text.replace(THOUGHT_MARKER_RE, "").trim();

    try {
        navigator.clipboard.writeText(cleanText || "");
        showStatus("Copied to clipboard.");
    } catch {
        showStatus("Copy failed.", true);
    }
}

// 🌐 REPLACED LOGIC: Now adds the globe icon to the textarea.
function markNextTurnWeb() {
    const current = textarea.value.trim();
    if (!current.includes(WEB_ICON)) {
        // Add the icon to the end of the text
        textarea.value = current ? `${current} ${WEB_ICON}` : WEB_ICON;
        textarea.dispatchEvent(new Event("input"));
    }
    showStatus(`Using web search (${WEB_TOKEN}).`);
}

// ------------------------------------------------
// Chat rendering with toolbox
// ------------------------------------------------
function renderChat() {
    if (!chatBox) return;
    if (!Array.isArray(history)) history = [];

    chatBox.innerHTML = "";

    if (history.length === 0) {
        if (emptyChatPrompt) {
            emptyChatPrompt.classList.remove("hidden");
            emptyChatPrompt.style.opacity = "1";
        }
        return;
    } else {
        if (emptyChatPrompt) {
            emptyChatPrompt.style.opacity = "0";
            setTimeout(() => emptyChatPrompt.classList.add("hidden"), 300);
        }
    }

    history.forEach((turn, idx) => {
        // 🌐 REPLACED LOGIC: Replace the actual WEB_TOKEN with the icon for display only
        let userMsg = turn[0] || "";
        userMsg = userMsg.replace(new RegExp(WEB_TOKEN, 'g'), WEB_ICON); // Replace token with icon for display

        const aiMsg = turn[1];
        
        // Apply mt-10 only to the first message (index 0)
        const topMarginClass = idx === 0 ? "mt-10" : "mb-3";

        // User bubble (right aligned)
        const userDiv = document.createElement("div");
        // Use the determined margin class
        userDiv.className = `user-message-row ${topMarginClass} flex justify-end`;
        
        // UPDATED: Increased vertical padding from py-2 to py-3 for better visual balance
        userDiv.innerHTML = `
            <div class="inline-block max-w-[85%] rounded-2xl px-4 py-3 bg-neutral-200 dark:bg-neutral-800 dark:text-white">
                ${escapeHTML(userMsg).replace(/\n/g, "<br/>")}
            </div>
        `;
        chatBox.appendChild(userDiv);

        // AI bubble (left aligned)
        const aiWrapper = document.createElement("div");
        aiWrapper.className = "ai-message-row mb-1 flex items-start gap-2 mt-2";
        
        // --- MODIFIED: Uses the new function to format and extract thought ---
        const safeAi = aiMsg == null ? "" : formatAiHtml(aiMsg); 
        // ------------------------------------------------------------------

        aiWrapper.innerHTML = `
            <img src="/src/Vailailogo.svg" alt="AI" class="w-8 h-8 rounded-full mt-1 dark:invert"/>
            <div class="max-w-[85%] text-neutral-900 dark:text-white pt-1">
                ${safeAi}
                ${aiMsg != null ? `<div class="chat-toolbox flex items-center gap-3 mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                    <button class="tool-btn copy-btn" data-idx="${idx}" title="Copy"><i class="fa-regular fa-copy"></i><span class="ml-1 hidden sm:inline"></span></button>
                    <button class="tool-btn regen-btn" data-idx="${idx}" title="Regenerate"><i class="fa-solid fa-rotate-right"></i><span class="hidden sm:inline"></span></button>
                    <span class="mx-1 text-neutral-300 dark:text-neutral-600">|</span>
                    <button class="tool-btn good-btn" data-idx="${idx}" title="Good"><i class="fa-regular fa-thumbs-up"></i></button>
                    <button class="tool-btn bad-btn" data-idx="${idx}" title="Bad"><i class="fa-regular fa-thumbs-down"></i></button>
                </div>` : ""}
            </div>
        `;
        chatBox.appendChild(aiWrapper);

        const spacer = document.createElement("div");
        // This spacer is now effectively redundant with the updated margins, but retained for old compatibility
        spacer.className = "mb-4"; 
        chatBox.appendChild(spacer);
    });

    chatBox.scrollTop = chatBox.scrollHeight;

    // Bind toolbox buttons after render
    bindToolboxEvents();
}

function bindToolboxEvents() {
    // Copy
    document.querySelectorAll(".copy-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.idx);
            const aiText = history[idx]?.[1] || "";
            // Use the updated function that strips CoT markers
            copyTextToClipboard(aiText);
        });
    });
    // Regenerate
    document.querySelectorAll(".regen-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.idx);
            regenerateTurn(idx);
        });
    });
    // Feedback
    document.querySelectorAll(".good-btn").forEach((btn) => {
        btn.addEventListener("click", () => sendFeedback("Good Response"));
    });
    document.querySelectorAll(".bad-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (badFeedbackModal) showModal(badFeedbackModal);
            else sendFeedback("Bad Response");
        });
    });
    // Web tag for next turn
    document.querySelectorAll(".web-btn").forEach((btn) => {
        btn.addEventListener("click", markNextTurnWeb);
    });
}

// ------------------------------------------------
// File preview & attachment helpers
// ------------------------------------------------
function renderFilePreview(file) {
    currentFile = file || null;
    if (!filePreviewContainer) return;
    filePreviewContainer.innerHTML = "";
    if (!file) {
        filePreviewContainer.classList.add("hidden");
        return;
    }

    const isImage = file.type && file.type.startsWith("image");
    const objectUrl = URL.createObjectURL(file);

    if (isImage) {
        filePreviewContainer.innerHTML = `
            <div class="relative w-24 h-24 rounded-xl overflow-hidden shadow border p-1">
                <img src="${objectUrl}" class="w-full h-full object-cover" alt="preview"/>
                <button id="remove-file-btn" class="absolute top-1 right-1 bg-black text-white rounded-full w-6 h-6">✕</button>
            </div>
        `;
    } else {
        filePreviewContainer.innerHTML = `
            <div class="flex items-center justify-between p-2 bg-neutral-100 dark:bg-neutral-700 rounded-xl text-sm">
                <div class="truncate text-neutral-800 dark:text-neutral-200">${escapeHTML(file.name)}</div>
                <button id="remove-file-btn" class="ml-2 text-red-500">Remove</button>
            </div>
        `;
    }

    filePreviewContainer.classList.remove("hidden");
    const btn = document.getElementById("remove-file-btn");
    if (btn) btn.addEventListener("click", clearFileAttachment);
}

function clearFileAttachment() {
    currentFile = null;
    if (fileUploadInput) fileUploadInput.value = "";
    if (imageUploadInput) imageUploadInput.value = "";
    if (filePreviewContainer) {
        const img = filePreviewContainer.querySelector("img");
        if (img && img.src) URL.revokeObjectURL(img.src);
        filePreviewContainer.innerHTML = "";
        filePreviewContainer.classList.add("hidden");
    }
    updateSendButtonState();
}

// 🌐 MODIFIED LOGIC: Replace icon with token when checking state
function updateSendButtonState() {
    // Check for text, replacing the icon with the token before checking length
    const rawText = textarea ? textarea.value.replace(new RegExp(WEB_ICON, 'g'), WEB_TOKEN).trim() : '';
    const hasText = rawText.length > 0;
    
    if (!sendButton) return;
    if (hasText || currentFile) {
        sendButton.disabled = false;
        sendButton.classList.remove("opacity-50", "cursor-not-allowed");
    } else {
        sendButton.disabled = true;
        sendButton.classList.add("opacity-50", "cursor-not-allowed");
    }
}

// ------------------------------------------------
// Gradio client
// ------------------------------------------------
async function initGradioClient() {
    try {
        if (!gradioClient) {
            let connectId = currentSpaceId;
            
            // CRITICAL FIX: If using the mixed-case repository ID (or its lowercase form), 
            // hardcode the connection to the fully normalized URL to ensure stability.
            if (currentSpaceId.toLowerCase() === "ar12c/okemollm") {
                connectId = "https://ar12c-okemollm.hf.space/";
            }
            
            gradioClient = await Client.connect(connectId); 
            showStatus(`Connected to ${currentSpaceId.split('/')[1]} ✨`);
            setTimeout(() => showStatus(""), 1500);
        }
    } catch (err) {
        console.error("Gradio Client connect error:", err);
        showStatus(`Failed to connect to remote Space: ${currentSpaceId}.`, true);
        throw err; // Re-throw to stop subsequent processes that rely on the client
    }
}

// ------------------------------------------------
// Primary: send message & stream result
// ------------------------------------------------
async function sendOkemoMessage() {
    if (!textarea || !sendButton) return;
    
    // 🌐 CRITICAL MODIFICATION: Replace the icon with the actual token before sending!
    let userMsg = textarea.value.replace(new RegExp(WEB_ICON, 'g'), WEB_TOKEN).trim();

    if (!userMsg && !currentFile) {
        showStatus("Please enter a message or attach a file.", true);
        return;
    }
    if (userMsg.length > MAX_CHARS) {
        showStatus(`Message too long (max ${MAX_CHARS}).`, true);
        return;
    }

    // Optimistic update
    let historyMessage = userMsg || "";
    if (currentFile) {
        historyMessage += ` (Attached: ${currentFile.name || "file"})`;
    }
    history.push([historyMessage, null]);
    renderChat();

    // Reset input height and text
    textarea.value = "";
    textarea.style.height = "48px";
    updateSendButtonState();

    showStatus("Generating...");
    startCursor(); // Start cursor immediately after rendering partial chat

    // CRITICAL: The userMsg SENT HERE already contains the <WEB> token if the globe was present.
    const inputs = [
        userMsg,
        history.map(([u, a]) => [u, a]),
        currentFile,
        false, // <WEB> handled by tag; backend ignores this flag
    ];

    try {
        if (!gradioClient) {
            await initGradioClient();
            if (!gradioClient) throw new Error("Unable to connect to remote Space.");
        }

        const job = gradioClient.submit("/on_submit", inputs);

        for await (const chunk of job) {
            if (chunk && Array.isArray(chunk.data) && chunk.data.length > 0) {
                const serverHistoryCandidate = chunk.data[0];

                // Normalize server history (logic remains the same)
                let normalized = null;
                if (Array.isArray(serverHistoryCandidate) && serverHistoryCandidate.length > 0 && Array.isArray(serverHistoryCandidate[0])) {
                    normalized = serverHistoryCandidate;
                } else if (Array.isArray(serverHistoryCandidate) && serverHistoryCandidate[0] && serverHistoryCandidate[0].content !== undefined) {
                    const arr = serverHistoryCandidate;
                    const pairs = [];
                    for (let i = 0; i < arr.length; i += 2) {
                        const u = arr[i] ? (arr[i].content || "") : "";
                        const a = arr[i + 1] ? (arr[i + 1].content || "") : null;
                        pairs.push([u, a]);
                    }
                    normalized = pairs;
                } else if (Array.isArray(serverHistoryCandidate) && serverHistoryCandidate.length === 2 && typeof serverHistoryCandidate[0] === "string") {
                    normalized = [serverHistoryCandidate];
                }

                if (normalized) {
                    // sanitize last AI message a bit to avoid odd spacing during stream
                    const last = normalized[normalized.length - 1];
                    if (last && typeof last[1] === "string") {
                        last[1] = last[1]
                            .replace(/[ \t]+/g, " ")
                            .replace(/\s+([,.!?;:"])/g, "$1") // Adjusted for quotes and colons
                            .replace(/'\s+/g, "'");
                    }
                    history = normalized;
                    renderChat();
                    startCursor(); // Re-start cursor after rendering the new chunk
                }

                const possibleStatus = chunk.data[1];
                if (typeof possibleStatus === "string") showStatus(possibleStatus);
            }
        }
        
        // Stop cursor when the stream is complete
        stopCursor();
        // Response fully received -> process final result
        const finalResult = await job.result;
        const finalStatus = finalResult?.data?.[1];
        showStatus(finalStatus || "Response complete.");

    } catch (err) {
        console.error("Prediction error:", err);
        const lastIdx = history.length - 1;
        if (lastIdx >= 0 && history[lastIdx][1] === null) {
            history[lastIdx][1] = "Error: could not receive response.";
        }
        renderChat();
        stopCursor();
        showStatus(err.message || "Error receiving response.", true);

    } finally {
        updateSendButtonState();
        if (currentFile) clearFileAttachment();
    }
}

// ------------------------------------------------
// Input bindings, dropdowns, modals
// ------------------------------------------------
function bindUI() {
    // Main controls
    textarea = document.getElementById("okemo-input");
    sendButton = document.getElementById("okemo-send");
    chatBox = document.getElementById("okemo-chat");
    statusEl = document.getElementById("okemo-status"); 
    fileUploadInput = document.getElementById("file-upload-input");
    imageUploadInput = document.getElementById("image-upload-input");
    filePreviewContainer = document.getElementById("file-preview-container");
    emptyChatPrompt = document.getElementById("empty-chat-prompt");

    // Dropdowns
    menuToggle = document.getElementById("menu-toggle");
    okemoDropdown = document.getElementById("okemo-dropdown");
    plusMenuToggle = document.getElementById("plus-menu-toggle");
    inputDropdown = document.getElementById("input-dropdown");

    // Modals
    disclaimerModal = document.getElementById("disclaimer-modal");
    updateNotesModal = document.getElementById("update-notes-modal");
    badFeedbackModal = document.getElementById("bad-feedback-modal");

    // FIX: Declare badInput globally and initialize it here
    badInput = document.getElementById("bad-feedback-input"); 
    
    // NEW Model Selectors
    modelSelectBase = document.getElementById("model-select-base");
    modelSelectPro = document.getElementById("model-select-pro");
    // Ensure the main title is updated to show the current model name
    document.getElementById("okemo-title").textContent = MODEL_CONFIG.BASE.name.split(' ')[0]; // Initial short name

    // Set initial model style
    if (modelSelectBase) {
        modelSelectBase.classList.add("bg-neutral-100", "dark:bg-neutral-700", "font-semibold");
    }

    if (!textarea || !sendButton || !chatBox) {
        console.warn("Missing required HTML elements (okemo-input, okemo-send, okemo-chat).");
    }

    // Textarea auto-resize + Enter-to-send
    if (textarea) {
        textarea.addEventListener("input", function () {
            this.style.height = "auto";
            const newH = Math.min(this.scrollHeight, MAX_TEXTAREA_HEIGHT);
            this.style.height = `${Math.max(newH, 48)}px`;
            updateSendButtonState();
        });
        textarea.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sendButton.disabled) sendOkemoMessage();
            }
        });
    }

    if (sendButton) {
        sendButton.addEventListener("click", (e) => {
            e.preventDefault();
            sendOkemoMessage();
        });
    }

    // File inputs
    if (fileUploadInput) {
        fileUploadInput.addEventListener("change", (e) => {
            const f = e.target.files && e.target.files[0];
            if (f) renderFilePreview(f);
            updateSendButtonState();
        });
    }
    if (imageUploadInput) {
        imageUploadInput.addEventListener("change", (e) => {
            const f = e.target.files && e.target.files[0];
            if (f) renderFilePreview(f);
            updateSendButtonState();
        });
    }

    // Optional feedback modal buttons (global)
    const goodBtn = document.getElementById("good-feedback-btn");
    const badBtn = document.getElementById("bad-feedback-btn");
    if (goodBtn) goodBtn.addEventListener("click", () => sendFeedback("Good Response"));
    if (badBtn) badBtn.addEventListener("click", () => {
        if (badFeedbackModal) showModal(badFeedbackModal);
        else sendFeedback("Bad Response");
    });

    const badCancel = document.getElementById("cancel-bad-feedback");
    const badSubmit = document.getElementById("submit-bad-feedback");
    
    if (badCancel) badCancel.addEventListener("click", () => {
        hideModal(badFeedbackModal);
        if (badInput) badInput.value = "";
    });
    
    // --- FIX: Bad Feedback Submit Logic ---
    if (badSubmit) badSubmit.addEventListener("click", async () => {
        // 1. Get the feedback text (User's Desired/Correct Response)
        const desiredResponse = badInput ? badInput.value.trim() : "";
        
        // 2. Send the feedback to the dedicated training endpoint
        await sendFeedback("Bad Response", desiredResponse);
        
        // 3. Clean up and close modal
        hideModal(badFeedbackModal);
        if (badInput) badInput.value = "";
        
        // Log a message to the chat status bar
        showStatus("Feedback sent for training.", false);
    });
    // -------------------------------------

    // --- START CRITICAL FIX (Using self-contained logic and blocking global clicks) ---

    // 1. Initial State: Ensure all menus are correctly closed on load
    closeAllDropdowns();

    // 2. Header Dropdown Toggle
    if (menuToggle && okemoDropdown) {
        // This handler runs in the capture phase (true) and blocks all other click events.
        menuToggle.addEventListener("click", (e) => {
            e.stopImmediatePropagation(); 
            if (okemoDropdown.classList.contains("opacity-100")) {
                closeSingleDropdown(menuToggle, okemoDropdown); // Close self
            } else {
                closeAllDropdowns(); // Close all (including the other menu)
                openSingleDropdown(menuToggle, okemoDropdown); // Open self
            }
        }, true); 
    }

    // 3. Input Plus Menu Toggle
    if (plusMenuToggle && inputDropdown) {
        // This handler runs in the capture phase (true) and blocks all other click events.
        plusMenuToggle.addEventListener("click", (e) => {
            e.stopImmediatePropagation(); 
            if (inputDropdown.classList.contains("opacity-100")) {
                closeSingleDropdown(plusMenuToggle, inputDropdown); // Close self
            } else {
                closeAllDropdowns(); // Close all (including the other menu)
                openSingleDropdown(plusMenuToggle, inputDropdown); // Open self
            }
        }, true); 
    }
    
    // 4. Model Switching Bindings
    [modelSelectBase, modelSelectPro].forEach(modelLink => {
        if (modelLink) {
            modelLink.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation(); 
                const newId = modelLink.dataset.modelId;
                const newName = modelLink.dataset.modelName;
                
                // Switch the model and close the dropdown
                switchModel(newId, newName);
                closeAllDropdowns();
            });
        }
    });

    // 5. Fallback/Click Outside Logic (Now only handles clicks outside the toggles/menus)
    document.addEventListener("click", (e) => {
        // If the click is not inside either dropdown or their toggle buttons, close all.
        const isClickInsideOkemoArea = (okemoDropdown && okemoDropdown.contains(e.target)) || (menuToggle && menuToggle.contains(e.target));
        const isClickInsideInputArea = (inputDropdown && inputDropdown.contains(e.target)) || (plusMenuToggle && plusMenuToggle.contains(e.target));

        if (!isClickInsideOkemoArea && !isClickInsideInputArea) {
            closeAllDropdowns();
        }
    });


    // Input dropdown options
    const webSearchOption = document.getElementById("web-search-option");
    const addImageOption = document.getElementById("add-image-option");
    const newFeatureOption = document.getElementById("new-feature-option");

    // Fix for Input Dropdown Options (Must manually close after selection)
    const dropdownOptions = [webSearchOption, addImageOption, newFeatureOption];
    dropdownOptions.forEach(option => {
        if (option) {
            option.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevents document click listener from firing too soon
                
                // Custom logic for the button's purpose
                if (option.id === "web-search-option") {
                    // 🌐 Calls the updated function
                    markNextTurnWeb();
                    textarea.focus();
                } else if (option.id === "add-image-option" && imageUploadInput) {
                    imageUploadInput.click();
                } else if (option.id === "new-feature-option" && fileUploadInput) {
                    fileUploadInput.click();
                }

                closeAllDropdowns(); // Use unified function to close
            });
        }
    });
    
    // New Chat link clears local history (Header Dropdown)
    const newChatHeader = document.getElementById("new-chat-link-header"); // Primary header button
    const newChatDropdown = document.getElementById("new-chat-dropdown-2"); // This ID is reused in HTML, but the new selector is model-select-base/pro for model links
    const showUpdateNotes = document.getElementById("show-update-notes"); // Dropdown link

    if (newChatHeader) {
        newChatHeader.addEventListener("click", (e) => {
            e.preventDefault();
            history = [];
            renderChat();
            showStatus("Chat cleared. Starting new conversation.");
            clearFileAttachment();
        });
    }
    
    // Header Dropdown Option Handlers (ensure closure after action)
    [showUpdateNotes].forEach(link => { // Only Update Notes remains here, as model switching handles chat clearing
        if(link) {
            link.addEventListener("click", (e) => {
                e.preventDefault(); // Stop navigation for the link
                e.stopPropagation(); // Prevents document click listener from firing too soon
                
                // Custom logic
                if (link.id === "show-update-notes") {
                    showModal(updateNotesModal);
                }
                
                closeAllDropdowns(); // Use unified function to close
            });
        }
    });
    // --- END CRITICAL FIX ---


    // Initial state
    updateSendButtonState();
    renderChat();

    // Disclaimer & update notes flow
    const disclaimerAgreed = localStorage.getItem(DISCLAIMER_AGREED_KEY) === "true";
    const updatesSeen = localStorage.getItem(UPDATE_NOTES_KEY) === "true";

    if (!disclaimerAgreed && disclaimerModal) {
        showModal(disclaimerModal);
    } else if (!updatesSeen && updateNotesModal) {
        showModal(updateNotesModal);
    }

    const disclaimerAgreeBtn = document.getElementById("disclaimer-agree");
    if (disclaimerAgreeBtn && disclaimerModal) {
        disclaimerAgreeBtn.addEventListener("click", () => {
            const dontShowAgain = document.getElementById("dont-show-again");
            if (dontShowAgain && dontShowAgain.checked) {
                localStorage.setItem(DISCLAIMER_AGREED_KEY, "true");
            }
            hideModal(disclaimerModal);
// After closing disclaimer, show updates if not seen
            if (!updatesSeen && updateNotesModal) {
                showModal(updateNotesModal);
            }
        });
    }

    const updatesCloseBtn = document.getElementById("update-notes-close");
    if (updatesCloseBtn && updateNotesModal) {
        updatesCloseBtn.addEventListener("click", () => {
            const notesDontShowAgain = document.getElementById("notes-dont-show-again");
            if (notesDontShowAgain && notesDontShowAgain.checked) {
                localStorage.setItem(UPDATE_NOTES_KEY, "true");
            }
            hideModal(updateNotesModal);
        });
    }
}

// ------------------------------------------------
// Kickoff
// ------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
    bindUI();
    // Use the function that connects to the currentSpaceId (MODEL_CONFIG.BASE.id initially)
    await initGradioClient(); 
});