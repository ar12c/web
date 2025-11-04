// chat.js — OkemoLLM frontend integrator for Hugging Face Space "ar12c/okemo2"
// Place this file in your site's JS and ensure the HTML IDs referenced exist.

import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const SPACE_ID = "ar12c/okemo2"; // Hugging Face Space
let gradioClient = null;

// Local chat state
let history = []; // local history as [[userMsg, aiMsg], ...]
let currentFile = null;
const MAX_TEXTAREA_HEIGHT = 300;
const MAX_CHARS = 1024;

// UI elements (will be initialized)
let textarea, sendButton, chatBox, loadingBar, fileUploadInput, filePreviewContainer, emptyChatPrompt, statusEl;

// ------------------------------------------------
// Helper utilities
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
  statusEl.textContent = msg;
  statusEl.className = isError ? "text-red-500 text-sm" : "text-neutral-500 text-sm";
}

function ensureHistoryArray(h) {
  if (!Array.isArray(h)) return [];
  // Convert any non-[[u,a],...] forms into a normalized array
  if (h.length === 0) return [];
  // If first element looks like {role:, content:} objects, attempt conversion
  if (h[0] && typeof h[0] === "object" && !Array.isArray(h[0])) {
    // Try to map messages grouped by turns => fallback to empty
    try {
      // If it's an array of objects like [{role:'user',content:'x'},{role:'assistant',content:'y'}, ...]
      const asPairs = [];
      for (let i = 0; i < h.length; i += 2) {
        const u = (h[i] && (h[i].content || "")) || "";
        const a = (h[i + 1] && (h[i + 1].content || "")) || null;
        asPairs.push([u, a]);
      }
      return asPairs;
    } catch (e) {
      return [];
    }
  }
  // If shape is already [[u,a], ...] keep it
  if (Array.isArray(h[0])) return h;
  return [];
}

// ------------------------------------------------
// Basic rendering of chat history
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
    const userMsg = turn[0] || "";
    const aiMsg = turn[1] || "";

    // User bubble (right aligned)
    const userDiv = document.createElement("div");
    userDiv.className = "user-message-row mb-3 flex justify-end";
    userDiv.innerHTML = `
      <div class="inline-block max-w-[85%] rounded-2xl px-4 py-2 bg-neutral-200 dark:bg-neutral-800 dark:text-white">
        ${escapeHTML(userMsg).replace(/\n/g, "<br/>")}
      </div>
    `;
    chatBox.appendChild(userDiv);

    // AI bubble (left aligned)
    const aiWrapper = document.createElement("div");
    aiWrapper.className = "ai-message-row mb-1 flex items-start gap-2 mt-2";
    aiWrapper.innerHTML = `
      <img src="/src/Vailailogo.svg" alt="AI" class="w-8 h-8 rounded-full mt-1 dark:invert"/>
      <div class="max-w-[85%] text-neutral-900 dark:text-white pt-1">${escapeHTML(aiMsg).replace(/\n/g, "<br/>")}</div>
    `;
    chatBox.appendChild(aiWrapper);

    // small spacer / actions placeholder
    const spacer = document.createElement("div");
    spacer.className = "mb-4";
    chatBox.appendChild(spacer);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
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
      <div class="flex items-center justify-between p-2 bg-neutral-100 rounded-xl">
        <div class="truncate">${escapeHTML(file.name)}</div>
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
  if (filePreviewContainer) {
    URL.revokeObjectURL(filePreviewContainer.querySelector("img")?.src || "");
    filePreviewContainer.innerHTML = "";
    filePreviewContainer.classList.add("hidden");
  }
  // Re-enable send button state update
  updateSendButtonState();
}

function updateSendButtonState() {
  const hasText = textarea && textarea.value.trim().length > 0;
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
// Init & connect to Gradio client
// ------------------------------------------------
async function initGradioClient() {
  try {
    if (!gradioClient) {
      gradioClient = await Client.connect(SPACE_ID);
      showStatus("Connected to OkemoLLM ✨");
      setTimeout(() => showStatus(""), 1500);
    }
  } catch (err) {
    console.error("Gradio Client connect error:", err);
    showStatus("Failed to connect to remote Space.", true);
  }
}

// ------------------------------------------------
// Primary: send message to backend & stream result
// ------------------------------------------------
async function sendOkemoMessage(isRegenerate = false, regenerateElement = null) {
  if (!textarea || !sendButton) return;
  let userMsg = textarea.value.trim();

  // validation
  if (!userMsg && !currentFile) {
    showStatus("Please enter a message or attach a file.", true);
    return;
  }
  if (userMsg.length > MAX_CHARS) {
    showStatus(`Message too long (max ${MAX_CHARS}).`, true);
    return;
  }

  // Prepare optimistic update
  let historyMessage = userMsg || "";
  if (currentFile) {
    historyMessage += ` (Attached: ${currentFile.name || "file"})`;
  }

  // Add turn placeholder (user, null)
  history.push([historyMessage, null]);
  renderChat();

  // Clear input for standard send
  textarea.value = "";
  textarea.style.height = "48px";
  updateSendButtonState();

  // Show loading
  if (loadingBar) loadingBar.classList.remove("hidden");
  showStatus("OkemoLLM Thinking...");

  // Prepare inputs for Gradio endpoint:
  // on_submit expects [user_message, history, uploaded_file, web_search_flag]
  const historyToSend = history.map(([u, a]) => [u, a]); // shallow copy
  const inputs = [
    userMsg,
    historyToSend,
    currentFile,
    false, // web_search_enabled flag (your backend uses <WEB> tag anyway)
  ];

  // Ensure connected
  try {
    if (!gradioClient) {
      await initGradioClient();
      if (!gradioClient) throw new Error("Unable to connect to remote Space.");
    }

    // Submit job for streaming
    const job = gradioClient.submit("/on_submit", inputs);

    // We will await the iterator, parsing chunks as they come
    for await (const chunk of job) {
      try {
        // typical chunk structure: { data: [ historyFromServer, statusStr, ... ], ... }
        if (chunk && Array.isArray(chunk.data) && chunk.data.length > 0) {
          const serverHistoryCandidate = chunk.data[0];

          // Normalize what the server sent into our expected [[u,a], ...] format
          let normalized = null;

          // Case A: it's already an array-of-pairs
          if (Array.isArray(serverHistoryCandidate) && serverHistoryCandidate.length > 0 && Array.isArray(serverHistoryCandidate[0])) {
            normalized = serverHistoryCandidate;
          } else if (Array.isArray(serverHistoryCandidate) && serverHistoryCandidate[0] && serverHistoryCandidate[0].content !== undefined) {
            // Case B: array of objects with .content (convert pairs)
            try {
              // Attempt grouping by pairs of objects
              const arr = serverHistoryCandidate;
              const pairs = [];
              for (let i = 0; i < arr.length; i += 2) {
                const u = arr[i] ? (arr[i].content || "") : "";
                const a = arr[i + 1] ? (arr[i + 1].content || "") : null;
                pairs.push([u, a]);
              }
              normalized = pairs;
            } catch (e) {
              normalized = null;
            }
          } else if (Array.isArray(serverHistoryCandidate) && serverHistoryCandidate.length === 2 && typeof serverHistoryCandidate[0] === "string") {
            // Rare case: single-turn [user, assistant]
            normalized = [serverHistoryCandidate];
          } else {
            // Unexpected format: do not crash; just log
            console.warn("Unexpected server history format:", serverHistoryCandidate);
          }

          if (normalized) {
            history = normalized;
            renderChat();
          } else {
            // fallback: if server sent a full chat object wrapped differently, try to coerce outer array
            const alt = ensureHistoryArray(serverHistoryCandidate);
            if (alt.length) {
              history = alt;
              renderChat();
            }
          }

          // Optionally, update status text if provided
          const possibleStatus = chunk.data[1];
          if (possibleStatus && typeof possibleStatus === "string") {
            showStatus(possibleStatus);
          }
        }
      } catch (parseErr) {
        console.error("Stream parsing error:", parseErr);
      }
    }

    // job finished, read final result
    const finalResult = await job.result;
    const finalStatus = finalResult?.data?.[1];
    if (finalStatus) showStatus(finalStatus);
    else showStatus("Response complete.");

  } catch (err) {
    console.error("Prediction error:", err);
    // mark last AI message as error if still null
    const lastIdx = history.length - 1;
    if (lastIdx >= 0 && history[lastIdx][1] === null) {
      history[lastIdx][1] = "Error: could not receive response.";
    }
    renderChat();
    showStatus(err.message || "Error receiving response.", true);

  } finally {
    if (loadingBar) loadingBar.classList.add("hidden");
    updateSendButtonState();
    // Clear attached file after send (if standard send)
    if (currentFile) clearFileAttachment();
    setTimeout(() => showStatus(""), 1500);
  }
}

// ------------------------------------------------
// Feedback stubs (Good/Bad) — call backend endpoints if desired
// ------------------------------------------------
async function sendFeedback(kind = "Good Response") {
  try {
    if (!gradioClient) await initGradioClient();
    if (!gradioClient) throw new Error("No connection.");

    const endpoint = kind === "Good Response" ? "/feedback_good" : "/feedback_bad";
    const inputs = [history];
    const result = await gradioClient.predict(endpoint, inputs);
    const reply = result?.data?.[1] || `${kind} recorded.`;
    showStatus(reply);
  } catch (e) {
    console.error("Feedback send failed:", e);
    showStatus("Failed to send feedback.", true);
  } finally {
    setTimeout(() => showStatus(""), 1500);
  }
}

// ------------------------------------------------
// Input bindings & initialization
// ------------------------------------------------
function bindUI() {
  textarea = document.getElementById("okemo-input");
  sendButton = document.getElementById("okemo-send");
  chatBox = document.getElementById("okemo-chat");
  loadingBar = document.getElementById("okemo-loading-bar");
  fileUploadInput = document.getElementById("file-upload-input");
  filePreviewContainer = document.getElementById("file-preview-container");
  emptyChatPrompt = document.getElementById("empty-chat-prompt");
  statusEl = document.getElementById("okemo-status");

  if (!textarea || !sendButton || !chatBox) {
    console.warn("Missing required HTML elements (okemo-input, okemo-send, okemo-chat).");
  }

  // Textarea auto-resize
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

  if (fileUploadInput) {
    fileUploadInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) {
        renderFilePreview(f);
      }
      updateSendButtonState();
    });
  }

  // simple shortcuts for feedback (if you wire up buttons)
  const goodBtn = document.getElementById("good-feedback-btn");
  const badBtn = document.getElementById("bad-feedback-btn");
  if (goodBtn) goodBtn.addEventListener("click", () => sendFeedback("Good Response"));
  if (badBtn) badBtn.addEventListener("click", () => sendFeedback("Bad Response"));

  // Initial state
  updateSendButtonState();
  renderChat();
}

// ------------------------------------------------
// Kickoff
// ------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  bindUI();
  await initGradioClient(); // try to connect early
});
