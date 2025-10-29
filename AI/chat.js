 import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

    const SPACE_ID = "ar12c/okemo2"; // or "https://ar12c-okemo2.hf.space"
    let client = null;
    let history = []; // array of [user, assistant] turns

    /**
     * Connects to the Hugging Face Gradio Space.
     */
    async function initOkemo() {
      try {
        client = await Client.connect(SPACE_ID);
        showStatus("Connected to OkemoLLM.");
        setTimeout(() => showStatus(""), 1500);
      } catch (err) {
        console.error("Failed to connect:", err);
        showStatus("Failed to connect to OkemoLLM. Retrying…", true);
        // Retry once after a short delay
        setTimeout(() => initOkemo(), 2000);
      }
    }

    /**
     * Updates the status message at the bottom of the chat.
     */
    function showStatus(msg, isError = false) {
      const el = document.getElementById("okemo-status");
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
     * User messages are aligned to the right.
     */
    function renderChat() {
      const box = document.getElementById("okemo-chat");
      if (!box) return;
      box.innerHTML = "";
      for (const [u, a] of history) {
        if (u) {
          // User message: Aligned to the right using flex justify-end
          box.innerHTML += `
            <div class="mb-3 flex justify-end">
              <div class="inline-block max-w-[85%] rounded-2xl px-4 py-2 bg-neutral-800 text-white">
                ${escapeHTML(u)}
              </div>
            </div>`;
        }
        if (a) {
          // Assistant message: Aligned to the left (default flow)
          box.innerHTML += `
            <div class="mb-4">
              <div class="inline-block max-w-[85%] rounded-2xl px-4 py-2 bg-gray-200 text-gray-900">
                ${escapeHTML(a)}
              </div>
            </div>`;
        }
      }
      // Scroll to the latest message
      box.scrollTop = box.scrollHeight;
    }

    /**
     * Sends a message to the OkemoLLM API and updates chat history.
     * This version prevents duplicate message rendering by only updating 
     * the chat after receiving the finalized history from the server.
     */
    async function sendOkemoMessage() {
      const inputEl = document.getElementById("okemo-input");
      const btnEl = document.getElementById("okemo-send");
      if (!inputEl || !btnEl) return;

      const userMsg = inputEl.value.trim();
      if (!userMsg) return;

      // Ensure client connection
      if (!client) {
        showStatus("Connecting…");
        await initOkemo();
        if (!client) {
          showStatus("Not connected. Try again later.", true);
          return;
        }
      }

      // Prepare UI for sending
      inputEl.value = "";
      btnEl.disabled = true;
      btnEl.classList.add("opacity-50", "cursor-not-allowed");
      showStatus("Thinking...");

      try {
        // Call on_submit with positional args [msg, history]
        const result = await client.predict("/on_submit", [userMsg, history]);

        // Gradio returns [updated_history, cleared_msg]
        const updatedHistory = result?.data?.[0];

        if (Array.isArray(updatedHistory)) {
          // Replace local history with the clean, complete history from the server
          history = updatedHistory;
          showStatus("Received response.");
        } else {
          console.warn("Server response did not contain a valid history array.");
          showStatus("Error: Invalid response from OkemoLLM.", true);
        }
        
        // Render the chat only once with the final server-provided history
        renderChat();

      } catch (err) {
        console.error("Prediction error:", err);
        showStatus("Error contacting OkemoLLM.", true);
      } finally {
        // Re-enable UI
        btnEl.disabled = false;
        btnEl.classList.remove("opacity-50", "cursor-not-allowed");
        // Clear status after a moment
        setTimeout(() => showStatus(""), 1500); 
      }
    }

    /**
     * Binds the Enter key to the send message function.
     */
    function bindInput() {
      const inputEl = document.getElementById("okemo-input");
      if (!inputEl) return;
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendOkemoMessage();
        }
      });
    }

    // Expose for button onclick
    window.sendOkemoMessage = sendOkemoMessage;

    // Application Bootstrap
    window.addEventListener("DOMContentLoaded", async () => {
      await initOkemo();
      bindInput();
    });