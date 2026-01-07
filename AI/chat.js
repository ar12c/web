import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const MODEL_CONFIG = {
    BASE: {
        id: "ar12c/okemo2",
        name: "OLM 1"
    },
    PRO: {
        id: "ar12c/okemollm", 
        name: "OLM 2"
    }
};

let currentSpaceId = MODEL_CONFIG.PRO.id;
let gradioClient = null;
let webSearchEnabled = false;
let isGenerating = false;

let history = []; 
const MAX_TEXTAREA_HEIGHT = 300;
const MAX_CHARS = 2048;

const DISCLAIMER_AGREED_KEY = "okemo_disclaimer_agreed";
const UPDATE_NOTES_KEY = "okemo_update_v0.2.0";

let textarea, sendButton, chatBox, statusEl, emptyChatPrompt;
let menuToggle, okemoDropdown, plusMenuToggle, inputDropdown, plusIcon;
let disclaimerModal, updateNotesModal, badFeedbackModal, badInput;
let modelSelectBase, modelSelectPro;

const WEB_TOKEN = "<WEB>";
const WEB_ICON = "🌐"; 
const THOUGHT_MARKER_RE = /\[THOUGHT\](.*?)\[\/THOUGHT\]/gs; 

let statusTimeout = null;
let scrollObserver = null;

function escapeHTML(s) {
    if (s === null || s === undefined) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function scrollToBottom() {
    if (!chatBox) return;
    requestAnimationFrame(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
        const anchor = document.getElementById("scroll-anchor");
        if (anchor) {
            anchor.scrollIntoView({ behavior: 'auto', block: 'end' });
        }
    });
}

function showStatus(msg = "", isError = false) {
    if (!statusEl) return;
    if (statusTimeout) {
        clearTimeout(statusTimeout);
        statusTimeout = null;
    }
    statusEl.textContent = msg;
    statusEl.className = isError ? "text-red-500 text-sm mb-1" : "text-neutral-500 dark:text-neutral-400 text-sm mb-1";
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
    if (Array.isArray(h[0])) return h;
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

function formatAiHtml(text) {
    if (!text) return "";

    let thoughtHTML = "";
    let finalAnswer = text;

    const match = finalAnswer.match(THOUGHT_MARKER_RE);
    if (match) {
        const thoughtContent = match[0].replace(/\[THOUGHT\]|\[\/THOUGHT\]/g, "").trim();
        finalAnswer = finalAnswer.replace(THOUGHT_MARKER_RE, "").trim();

        if (thoughtContent) {
            let t = thoughtContent.replace(/\r/g, "").replace(/[ \t]+/g, " ");
            const paragraphs = t.split(/\n{2}/).map(p => escapeHTML(p).replace(/\n/g, "<br/>"));
            const thoughtBodyHTML = paragraphs.map(p => `<p class="text-xs opacity-70">${p}</p>`).join("");

            thoughtHTML = `
                <details open class="text-xs text-neutral-600 dark:text-neutral-500 my-2 pt-2 border-t border-neutral-300 dark:border-neutral-700">
                    <summary class="cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-400 font-bold uppercase tracking-tighter">
                        <i class="fa-solid fa-brain mr-1"></i>Thinking...
                    </summary>
                    <div class="mt-2 ml-1 p-2 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg italic">
                        ${thoughtBodyHTML}
                    </div>
                </details>
            `;
        }
    }

    let t = finalAnswer.trim();
    const answerParagraphs = t.split(/\n{2}/).map(p => escapeHTML(p).replace(/\n/g, "<br/>"));
    const answerHTML = answerParagraphs.map(p => `<p class="mb-2">${p}</p>`).join("");
    
    return answerHTML + thoughtHTML;
}

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

function closeSingleDropdown(toggleEl, dropdownEl) {
    if (!dropdownEl || !dropdownEl.classList.contains("opacity-100")) return;
    dropdownEl.classList.remove("opacity-100");
    dropdownEl.classList.add("opacity-0", "scale-y-0");
    if (toggleEl) toggleEl.classList.remove("active");
    if (toggleEl === plusMenuToggle && plusIcon) plusIcon.style.transform = "rotate(0deg)";
    setTimeout(() => { dropdownEl.classList.add("hidden"); }, 200); 
}

function openSingleDropdown(toggleEl, dropdownEl) {
    if (!dropdownEl) return;
    dropdownEl.classList.remove("hidden");
    dropdownEl.classList.add("opacity-0", "scale-y-0");
    setTimeout(() => {
        dropdownEl.classList.remove("opacity-0", "scale-y-0");
        dropdownEl.classList.add("opacity-100");
        if (toggleEl) toggleEl.classList.add("active");
        if (toggleEl === plusMenuToggle && plusIcon) plusIcon.style.transform = "rotate(45deg)";
    }, 10);
}

function closeAllDropdowns() {
    closeSingleDropdown(menuToggle, okemoDropdown);
    closeSingleDropdown(plusMenuToggle, inputDropdown);
}

async function switchModel(newSpaceId, newModelName) {
    if (newSpaceId === currentSpaceId) {
        showStatus(`${newModelName} is already active.`);
        return;
    }
    
    currentSpaceId = newSpaceId;
    gradioClient = null; 

    const modelNumber = newModelName.split(' ')[1];
    const modelNumEl = document.getElementById("model-display-number");
    if (modelNumEl) modelNumEl.textContent = modelNumber;

    document.title = `Chat ${newModelName}`;
    history = [];
    renderChat();
    showStatus(`Switched to ${newModelName}`);
    
    [modelSelectBase, modelSelectPro].forEach(link => {
        if (!link) return;
        if (link.dataset.modelId === newSpaceId) {
            link.classList.add("bg-neutral-100", "dark:bg-neutral-700", "font-semibold");
        } else {
            link.classList.remove("bg-neutral-100", "dark:bg-neutral-700", "font-semibold");
        }
    });

    try {
        await initGradioClient();
    } catch (e) {
        showStatus(`Connection failed for ${newModelName}.`, true);
    }
}

async function ensureClient() {
    if (!gradioClient) {
        let connectId = currentSpaceId;
        if (currentSpaceId === "ar12c/okemollm") {
            connectId = "https://ar12c-okemollm.hf.space/";
        }
        gradioClient = await Client.connect(connectId);
    }
    return gradioClient;
}

async function regenerateTurn(turnIndex) {
    try {
        const client = await ensureClient();
        const [userMsg] = history[turnIndex] || ["", ""];
        const cleanUserMsg = (userMsg || "").replace(new RegExp(`${WEB_ICON}\\s*`, 'g'), "").trim();

        if (!cleanUserMsg) return;

        history[turnIndex][1] = null;
        isGenerating = true;
        renderChat();

        const job = client.submit("/on_submit", [
            cleanUserMsg,
            history.map(([u, a]) => [u, a]),
            null,
            false,
        ]);

        for await (const chunk of job) {
            if (chunk && Array.isArray(chunk.data) && chunk.data.length > 0) {
                history = ensureHistoryArray(chunk.data[0]);
                renderChat();
            }
        }
    } catch (e) {
        showStatus("Regeneration failed.", true);
    } finally {
        isGenerating = false;
        renderChat();
    }
}

function toggleWebSearch() {
    webSearchEnabled = !webSearchEnabled;
    const webOption = document.getElementById("web-search-option");
    if (webOption) {
        if (webSearchEnabled) {
            webOption.classList.add("text-accent-blue", "bg-neutral-100", "dark:bg-neutral-800");
            showStatus("Web Search Activated");
        } else {
            webOption.classList.remove("text-accent-blue", "bg-neutral-100", "dark:bg-neutral-800");
            showStatus("Web Search Deactivated");
        }
    }
}

function renderChat() {
    if (!chatBox) return;
    chatBox.innerHTML = "";

    const spacer = document.createElement("div");
    spacer.style.flex = "1 1 auto"; 
    chatBox.appendChild(spacer);

    if (history.length === 0) {
        if (emptyChatPrompt) {
            emptyChatPrompt.classList.remove("hidden");
            emptyChatPrompt.style.opacity = "1";
        }
        return;
    } else if (emptyChatPrompt) {
        emptyChatPrompt.classList.add("hidden");
    }

    const activeModel = Object.values(MODEL_CONFIG).find(m => m.id === currentSpaceId);
    const modelDisplayName = activeModel ? activeModel.name : "OLM";

    history.forEach((turn, idx) => {
        const userMsg = (turn[0] || "").replace(new RegExp(WEB_TOKEN, 'g'), WEB_ICON);
        const aiMsg = turn[1];
        
        const userDiv = document.createElement("div");
        userDiv.className = `flex flex-col items-end w-full mb-10`;
        userDiv.innerHTML = `
            <div class="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-50 px-2">User Dispatch</div>
            <div class="inline-block max-w-[90%] font-bold tracking-tight text-ink dark:text-dark-ink px-2 text-right">
                ${escapeHTML(userMsg).replace(/\n/g, "<br/>")}
            </div>
        `;
        chatBox.appendChild(userDiv);

        const aiWrapper = document.createElement("div");
        aiWrapper.className = "flex flex-col items-start w-full mb-12";
        const safeAi = aiMsg == null ? `<span class="animate-pulse">Thinking...</span>` : formatAiHtml(aiMsg); 

        aiWrapper.innerHTML = `
            <div class="flex items-center gap-2 mb-3 px-2">
                <img src="/src/Vailailogo.svg" alt="Logo" class="w-5 h-5 dark:invert border border-ink/20"/>
                <span class="text-[10px] font-black uppercase tracking-[0.2em] text-accent-blue dark:text-blue-400">
                    ${modelDisplayName}
                </span>
            </div>
            <div class="max-w-[95%] text-ink dark:text-dark-ink px-2 w-full">
                <div class="ai-content-area font-medium text-sm md:text-base leading-relaxed">
                    ${safeAi}
                </div>
                ${aiMsg != null ? `
                <div class="flex items-center gap-4 mt-6 pt-4 border-t border-ink/10 dark:border-white/10 w-full">
                    <button class="tool-btn copy-btn opacity-40 hover:opacity-100 hover:text-accent-blue transition-all" data-idx="${idx}" title="Copy Response">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <button class="tool-btn regen-btn opacity-40 hover:opacity-100 hover:text-accent-blue transition-all" data-idx="${idx}" title="Regenerate">
                        <i class="fa-solid fa-rotate-right"></i>
                    </button>
                    <div class="flex-1"></div>
                    <button class="tool-btn good-btn opacity-40 hover:opacity-100 transition-opacity" data-idx="${idx}">
                        <i class="fa-regular fa-thumbs-up"></i>
                    </button>
                    <button class="tool-btn bad-btn opacity-40 hover:opacity-100 transition-opacity" data-idx="${idx}">
                        <i class="fa-regular fa-thumbs-down"></i>
                    </button>
                </div>` : ""}
            </div>
        `;
        chatBox.appendChild(aiWrapper);
    });

    const scrollAnchor = document.createElement("div");
    scrollAnchor.id = "scroll-anchor";
    scrollAnchor.style.height = "1px";
    scrollAnchor.style.width = "100%";
    scrollAnchor.style.marginTop = "-1px";
    chatBox.appendChild(scrollAnchor);

    scrollToBottom();
    bindToolboxEvents();
}

function bindToolboxEvents() {
    document.querySelectorAll(".copy-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const text = (history[Number(btn.dataset.idx)]?.[1] || "").replace(THOUGHT_MARKER_RE, "").trim();
            navigator.clipboard.writeText(text);
            showStatus("Copied");
        });
    });
    document.querySelectorAll(".regen-btn").forEach(btn => {
        btn.addEventListener("click", () => regenerateTurn(Number(btn.dataset.idx)));
    });
}

async function initGradioClient() {
    try {
        await ensureClient();
        showStatus("Model Ready");
    } catch (err) {
        showStatus("Connection Error", true);
    }
}

async function sendOkemoMessage() {
    if (!textarea || !sendButton || sendButton.disabled) return;
    
    let rawInput = textarea.value.trim();
    if (!rawInput) return;

    let userMsg = rawInput;
    if (webSearchEnabled && !userMsg.includes(WEB_TOKEN)) {
        userMsg += ` ${WEB_TOKEN}`;
    }

    history.push([userMsg, null]);
    isGenerating = true;
    renderChat();

    textarea.value = "";
    textarea.style.height = "48px";
    sendButton.disabled = true;

    try {
        const client = await ensureClient();
        const job = client.submit("/on_submit", [
            userMsg,
            history.map(([u, a]) => [u, a]),
            null,
            false, 
        ]);

        for await (const chunk of job) {
            if (chunk && Array.isArray(chunk.data) && chunk.data.length > 0) {
                history = ensureHistoryArray(chunk.data[0]);
                renderChat();
                if (typeof chunk.data[1] === "string") showStatus(chunk.data[1]);
            }
        }
    } catch (err) {
        const lastIdx = history.length - 1;
        if (lastIdx >= 0 && history[lastIdx][1] === null) history[lastIdx][1] = "Error: Connection lost.";
        renderChat();
        showStatus("Request failed.", true);
    } finally {
        sendButton.disabled = false;
        isGenerating = false;
    }
}

function bindUI() {
    textarea = document.getElementById("okemo-input");
    sendButton = document.getElementById("okemo-send");
    chatBox = document.getElementById("okemo-chat");
    statusEl = document.getElementById("okemo-status"); 
    emptyChatPrompt = document.getElementById("empty-chat-prompt");
    menuToggle = document.getElementById("menu-toggle");
    okemoDropdown = document.getElementById("okemo-dropdown");
    plusMenuToggle = document.getElementById("plus-menu-toggle");
    plusIcon = document.getElementById("plus-icon");
    inputDropdown = document.getElementById("input-dropdown");
    disclaimerModal = document.getElementById("disclaimer-modal");
    updateNotesModal = document.getElementById("update-notes-modal");
    modelSelectBase = document.getElementById("model-select-base");
    modelSelectPro = document.getElementById("model-select-pro");

    if (chatBox) {
        Object.assign(chatBox.style, {
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            height: "calc(100vh - 250px)", 
            width: "100%",
            maxWidth: "900px",
            margin: "0 auto",
            position: "relative",
            scrollBehavior: "smooth"
        });
        
        scrollObserver = new MutationObserver(() => {
            scrollToBottom();
        });
        scrollObserver.observe(chatBox, { childList: true, subtree: true, characterData: true });
    }

    if (textarea) {
        textarea.addEventListener("input", function () {
            this.style.height = "auto";
            this.style.height = `${Math.min(Math.max(this.scrollHeight, 48), MAX_TEXTAREA_HEIGHT)}px`;
            sendButton.disabled = this.value.trim().length === 0;
        });
        textarea.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendOkemoMessage();
            }
        });
    }

    if (sendButton) sendButton.addEventListener("click", () => {
        sendOkemoMessage();
    });

    if (menuToggle) {
        menuToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            if (okemoDropdown.classList.contains("opacity-100")) closeAllDropdowns();
            else { closeAllDropdowns(); openSingleDropdown(menuToggle, okemoDropdown); }
        });
    }

    if (plusMenuToggle) {
        plusMenuToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            if (inputDropdown.classList.contains("opacity-100")) closeAllDropdowns();
            else { closeAllDropdowns(); openSingleDropdown(plusMenuToggle, inputDropdown); }
        });
    }

    document.addEventListener("click", closeAllDropdowns);

    if (modelSelectBase) {
        modelSelectBase.addEventListener("click", (e) => {
            e.preventDefault();
            switchModel(MODEL_CONFIG.BASE.id, MODEL_CONFIG.BASE.name);
        });
    }
    if (modelSelectPro) {
        modelSelectPro.addEventListener("click", (e) => {
            e.preventDefault();
            switchModel(MODEL_CONFIG.PRO.id, MODEL_CONFIG.PRO.name);
        });
    }

    const webSearchOption = document.getElementById("web-search-option");
    if (webSearchOption) {
        webSearchOption.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleWebSearch();
            textarea.focus();
        });
    }

    const newChatHeader = document.getElementById("new-chat-link-header");
    if (newChatHeader) newChatHeader.addEventListener("click", () => {
        history = [];
        renderChat();
        showStatus("Reset");
    });

    if (localStorage.getItem(DISCLAIMER_AGREED_KEY) !== "true") showModal(disclaimerModal);
}

window.addEventListener("DOMContentLoaded", async () => {
    bindUI();
    await initGradioClient(); 
});