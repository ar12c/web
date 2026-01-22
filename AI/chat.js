import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

/**
 * MODELS Configuration
 */
const MODELS = {
    OLM1: { id: "https://ar12c-okemo2.hf.space", name: "OLM 1", schema: "legacy" },
    OLM2: { id: "https://ar12c-okemollm.hf.space", name: "OLM North Star", schema: "structured" }
};

const SYSTEM_PROMPT = "You are Okemo Language Model North Star (OLM North Star), a highly helpful verbose and comprehensive AI assistant. Your goal is to provide detailed and well structured answers in a conversational tone. CRITICAL ALWAYS wrap equations in $$ tags only. DO NOT under any circumstances use parentheses or square brackets for mathematical formulas.";
const WEB_TOKEN = "<WEB>";
const WEB_ICON = "🌐";
const AI_LOGO = "/src/Vailailogo.svg";

/**
 * State Management
 */
let currentModel = MODELS.OLM2;
let client = null;
let history = []; 
let allChats = JSON.parse(localStorage.getItem('olm_archives_v4') || '{}');
let currentChatId = crypto.randomUUID();
let isGenerating = false;
let webSearchEnabled = false;
let settings = JSON.parse(localStorage.getItem('olm_settings_v4') || JSON.stringify({ temp: 0.7, tokens: 512 }));

/**
 * DOM Elements
 */
const chatBoxContainer = document.getElementById("chat-container");
const chatBox = document.getElementById("chat-messages");
const textarea = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const statusEl = document.getElementById("api-status");
const footerStatusEl = document.getElementById("api-status-footer");
const welcomeState = document.getElementById("welcome-state");
const historyList = document.getElementById("history-list");
const modelMenu = document.getElementById("model-menu");
const settingsMenu = document.getElementById("settings-menu");
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const scrollBottomBtn = document.getElementById('scroll-bottom-btn');

/**
 * Utility Functions
 */
function formatMarkdown(text) {
    if (!text) return '';
    return marked.parse(text);
}

function renderMath(container) {
    const blockRegex = /\$\$([\s\S]+?)\$\$/g;
    container.innerHTML = container.innerHTML.replace(blockRegex, (match, formula) => {
        try {
            return `<div class="my-6 p-4 bg-white dark:bg-zinc-800 rounded-xl overflow-x-auto border border-ink/5 shadow-sm text-sm sm:text-base">` + 
                   katex.renderToString(formula, { displayMode: true, throwOnError: false }) + 
                   `</div>`;
        } catch (e) { return match; }
    });
}

function setStatus(msg = "", color = "green") {
    if (!statusEl || !footerStatusEl) return;
    const dot = footerStatusEl.querySelector('span');
    if (dot) {
        dot.className = `w-1 h-1 rounded-full animate-pulse bg-${color === 'green' ? 'green' : (color === 'red' ? 'red' : 'blue')}-500`;
    }
    statusEl.textContent = msg;
    const statusLabel = footerStatusEl.lastChild;
    if (statusLabel) statusLabel.textContent = " " + msg;
}

function toStructuredHistory(pairs) {
    return pairs.flatMap(([u, a]) => {
        const out = [];
        if (u) out.push({ role: "user", content: [{ type: "text", text: `YOU: ${u}` }] });
        if (a) out.push({ role: "assistant", content: [{ type: "text", text: `OLM: ${a}` }] });
        return out;
    });
}

function fromStructuredHistory(arr) {
    const pairs = [];
    for (let i = 0; i < arr.length; i += 2) {
        const u = arr[i]?.content?.[0]?.text?.replace(/^YOU: /, "") ?? "";
        const a = arr[i + 1]?.content?.[0]?.text?.replace(/^OLM: /, "") ?? null;
        pairs.push([u, a]);
    }
    return pairs;
}

/**
 * API Communication
 */
async function ensureClient(retries = 5, delay = 1500) {
    if (client) return client;
    setStatus("Connecting...", "yellow");
    for (let i = 0; i < retries; i++) {
        try {
            client = await Client.connect(currentModel.id);
            setStatus("System Ready", "green");
            return client;
        } catch (err) {
            if (i === retries - 1) {
                setStatus("Offline", "red");
                throw err;
            }
            await new Promise(r => setTimeout(r, delay * Math.pow(1.5, i)));
        }
    }
}

function saveToStorage(targetChatId, targetHistory) {
    const idToSave = targetChatId || currentChatId;
    const historyToSave = targetHistory || history;
    if (!historyToSave || historyToSave.length === 0) return;
    
    const firstMsg = historyToSave[0][0] || "New Chat";
    const title = firstMsg.substring(0, 30) + (firstMsg.length > 30 ? '...' : '');
    
    allChats[idToSave] = { 
        id: idToSave, 
        title: title, 
        history: JSON.parse(JSON.stringify(historyToSave)),
        timestamp: Date.now() 
    };
    
    localStorage.setItem('olm_archives_v4', JSON.stringify(allChats));
    renderHistory();
}

async function sendMessage(overrideText = null) {
    if (isGenerating) return;
    let msg = overrideText ?? textarea.value.trim();
    if (!msg) return;

    if (!overrideText) textarea.value = "";
    textarea.style.height = "auto";
    if (webSearchEnabled && !msg.includes(WEB_TOKEN)) msg += ` ${WEB_TOKEN}`;
    
    history.push([msg, null]);
    const processingChatId = currentChatId; 
    const activeHistory = history; 
    saveToStorage(processingChatId, activeHistory); 
    
    render();
    isGenerating = true;
    sendBtn.disabled = true;

    try {
        const c = await ensureClient();
        let job;
        if (currentModel.schema === "legacy") {
            job = c.submit("/on_submit", [
                msg, 
                activeHistory.map(([u, a]) => [`YOU: ${u}`, a ? `OLM: ${a}` : null])
            ]);
        } else {
            job = c.submit("/on_submit", [
                msg, 
                toStructuredHistory(activeHistory), 
                SYSTEM_PROMPT, 
                settings.tokens, 
                settings.temp, 
                0.9
            ]);
        }

        for await (const chunk of job) {
            if (!chunk?.data) continue;
            const newHistory = currentModel.schema === "legacy"
                ? chunk.data[0].map(([u, a]) => [u.replace(/^YOU: /, ""), a ? a.replace(/^OLM: /, "") : null])
                : fromStructuredHistory(chunk.data[0]);
            
            const lastResponse = newHistory[newHistory.length - 1][1];
            if (lastResponse) {
                activeHistory[activeHistory.length - 1][1] = lastResponse;
                if (currentChatId === processingChatId) {
                    updateLastResponseInUI(lastResponse);
                }
            }
        }
    } catch (e) {
        console.error("API Error:", e);
        activeHistory.at(-1)[1] = "⚠️ Transmission interrupted. Please check connection or try again.";
        if (currentChatId === processingChatId) render();
    } finally {
        isGenerating = false;
        sendBtn.disabled = false;
        saveToStorage(processingChatId, activeHistory); 
        if (currentChatId === processingChatId) {
            render(); 
            scrollToBottom();
        }
    }
}

function updateLastResponseInUI(text) {
    const aiRows = chatBox.querySelectorAll('.message-row.bg-black\\/5, .message-row.dark\\:bg-white\\/5');
    if (aiRows.length === 0) return;
    const lastRow = aiRows[aiRows.length - 1];
    const proseDiv = lastRow.querySelector('.prose');
    if (proseDiv) {
        proseDiv.innerHTML = formatMarkdown(text);
        renderMath(proseDiv);
    }
    const actionContainer = lastRow.querySelector('.action-icons-container');
    if (actionContainer) {
        actionContainer.classList.remove('hidden');
    }
}

/**
 * UI Actions (Exposed to window for HTML event handlers)
 */
window.__okemoCopy = (idx) => {
    const text = history[idx]?.[1];
    if (!text) return;
    try {
        navigator.clipboard.writeText(text).then(() => setStatus("Copied", "blue"));
    } catch (e) {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setStatus("Copied", "blue");
    }
};

window.__okemoRegen = (idx) => {
    if (isGenerating) return;
    const msg = history[idx]?.[0];
    if (!msg) return;
    history = history.slice(0, idx);
    render();
    sendMessage(msg);
};

window.__okemoDeleteChat = (id) => {
    delete allChats[id];
    localStorage.setItem('olm_archives_v4', JSON.stringify(allChats));
    if (currentChatId === id) resetChat();
    else renderHistory();
};

/**
 * Rendering
 */
function render() {
    if (history.length === 0) {
        welcomeState.style.display = "flex";
        chatBox.style.display = "none";
        chatBox.innerHTML = "";
        return;
    } else {
        welcomeState.style.display = "none";
        chatBox.style.display = "flex";
    }

    chatBox.innerHTML = "";
    history.forEach(([u, a], idx) => {
        const userRow = document.createElement('div');
        userRow.className = 'message-row animate-msg-in';
        userRow.innerHTML = `
            <div class="message-content">
                <div class="avatar user-avatar"><i class="fa-solid fa-user"></i></div>
                <div class="flex-1 overflow-hidden font-medium text-sm sm:text-[15px] leading-relaxed text-ink dark:text-dark-ink">
                    ${formatMarkdown(u.replace(WEB_TOKEN, WEB_ICON))}
                </div>
            </div>`;
        chatBox.appendChild(userRow);

        const aiRow = document.createElement('div');
        aiRow.className = 'message-row bg-black/5 dark:bg-white/5 animate-msg-in';
        aiRow.innerHTML = `
            <div class="message-content">
                <div class="avatar ai-avatar">
                    <img src="${AI_LOGO}" alt="Logo" class="w-full h-full object-contain dark:invert transition-all duration-300">
                </div>
                <div class="flex-1 overflow-hidden">
                    <div class="prose dark:prose-invert max-w-none text-sm sm:text-[15px] leading-relaxed text-ink dark:text-dark-ink">${a ? formatMarkdown(a) : "..."}</div>
                    <div class="action-icons-container flex gap-2 mt-4 ${!a ? 'hidden' : ''}">
                        <button class="icon-action-btn" onclick="window.__okemoCopy(${idx})" title="Copy">
                            <i class="fa-regular fa-copy text-xs"></i>
                        </button>
                        <button class="icon-action-btn" onclick="window.__okemoRegen(${idx})" title="Regenerate">
                            <i class="fa-solid fa-rotate-right text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        chatBox.appendChild(aiRow);
        if (a) renderMath(aiRow.querySelector('.prose'));
    });
}

function renderHistory() {
    historyList.innerHTML = "";
    const sorted = Object.values(allChats).sort((a, b) => b.timestamp - a.timestamp);
    sorted.forEach(chat => {
        const item = document.createElement("button");
        const isActive = chat.id === currentChatId;
        item.className = `w-full text-left px-4 py-3 rounded-lg text-xs font-bold transition-all truncate flex items-center justify-between group cursor-pointer ${isActive ? 'history-item-active' : 'text-ink/50 dark:text-white/40 hover:bg-ink/5'}`;
        item.innerHTML = `
            <span class="truncate pr-2 pointer-events-none"><i class="fa-solid fa-message mr-2 opacity-30 text-[10px]"></i> ${chat.title}</span>
            <i class="fa-solid fa-trash-can opacity-0 group-hover:opacity-40 hover:!opacity-100 p-1 text-[9px]" onclick="event.stopPropagation(); window.__okemoDeleteChat('${chat.id}')"></i>`;
        
        item.onclick = () => {
            currentChatId = chat.id; 
            history = JSON.parse(JSON.stringify(chat.history)); 
            isGenerating = false; 
            render(); 
            renderHistory(); 
            if (window.innerWidth < 1024) toggleSidebar(false);
        };
        historyList.appendChild(item);
    });
}

/**
 * Navigation & Controls
 */
function resetChat() {
    currentChatId = crypto.randomUUID();
    history = [];
    isGenerating = false;
    currentModel = MODELS.OLM2;
    document.getElementById('active-model-name').innerText = currentModel.name;
    setStatus("New Session", "green");
    render();
    renderHistory();
    if (window.innerWidth < 1024) toggleSidebar(false);
}

function toggleSidebar(force = null) {
    const body = document.body;
    const isCurrentlyHidden = !body.classList.contains('sidebar-open');
    const shouldShow = force === true || (force === null && isCurrentlyHidden);
    
    if (shouldShow) {
        body.classList.add('sidebar-open');
        body.classList.remove('sidebar-closed');
        if (window.innerWidth < 1024) {
            sidebarBackdrop.classList.remove('hidden');
            setTimeout(() => sidebarBackdrop.classList.add('opacity-100'), 10);
        }
    } else {
        body.classList.remove('sidebar-open');
        body.classList.add('sidebar-closed');
        sidebarBackdrop.classList.add('hidden');
        sidebarBackdrop.classList.remove('opacity-100');
    }
}

function scrollToBottom() {
    chatBoxContainer.scrollTo({ top: chatBoxContainer.scrollHeight, behavior: 'smooth' });
}

/**
 * Event Listeners Initialisation
 */
function initEventListeners() {
    sendBtn.addEventListener('click', () => sendMessage());
    textarea.addEventListener('keydown', e => { 
        if (e.key === "Enter" && !e.shiftKey) { 
            e.preventDefault(); 
            sendMessage(); 
        } 
    });
    
    textarea.addEventListener('input', function() { 
        this.style.height = 'auto'; 
        this.style.height = (this.scrollHeight > 192 ? 192 : this.scrollHeight) + 'px'; 
    });

    document.getElementById('toggle-sidebar').addEventListener('click', (e) => { 
        e.stopPropagation(); 
        toggleSidebar(); 
    });
    
    document.getElementById('model-dropdown-btn').addEventListener('click', (e) => { 
        e.stopPropagation(); 
        settingsMenu.classList.remove('active'); 
        modelMenu.classList.toggle('active'); 
    });
    
    document.getElementById('settings-toggle').addEventListener('click', (e) => { 
        e.stopPropagation(); 
        modelMenu.classList.remove('active'); 
        settingsMenu.classList.toggle('active'); 
    });

    window.addEventListener('click', (e) => {
        if (!modelMenu.contains(e.target) && !settingsMenu.contains(e.target)) {
            modelMenu.classList.remove('active');
            settingsMenu.classList.remove('active');
        }
    });

    document.getElementById('model-select-pro').addEventListener('click', () => { 
        if (history.length > 0) resetChat();
        currentModel = MODELS.OLM2; 
        client = null; 
        document.getElementById('active-model-name').innerText = MODELS.OLM2.name; 
        modelMenu.classList.remove('active');
        ensureClient();
    });
    
    document.getElementById('model-select-base').addEventListener('click', () => { 
        if (history.length > 0) resetChat();
        currentModel = MODELS.OLM1; 
        client = null; 
        document.getElementById('active-model-name').innerText = MODELS.OLM1.name; 
        modelMenu.classList.remove('active');
        ensureClient();
    });

    document.getElementById('web-search-toggle').addEventListener('click', () => {
        webSearchEnabled = !webSearchEnabled;
        const tag = document.getElementById('web-status-tag');
        tag.innerText = webSearchEnabled ? "ON" : "OFF";
        tag.className = webSearchEnabled ? "ml-auto text-[8px] text-green-500 font-black" : "ml-auto text-[8px] opacity-40";
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('vail_modern_theme_v3', isDark ? 'light' : 'dark');
    });

    document.getElementById('new-chat-btn').addEventListener('click', resetChat);
    document.getElementById('close-sidebar-mobile').addEventListener('click', () => toggleSidebar(false));
    sidebarBackdrop.addEventListener('click', () => toggleSidebar(false));

    document.getElementById('save-settings').addEventListener('click', () => {
        settings.temp = parseFloat(document.getElementById('param-temp').value);
        localStorage.setItem('olm_settings_v4', JSON.stringify(settings));
        settingsMenu.classList.remove('active');
        setStatus("Saved", "blue");
    });

    document.getElementById('param-temp').addEventListener('input', (e) => { 
        document.getElementById('temp-val').innerText = e.target.value; 
    });

    document.getElementById('clear-all-btn').addEventListener('click', () => {
        allChats = {};
        localStorage.setItem('olm_archives_v4', '{}');
        resetChat();
    });

    chatBoxContainer.addEventListener('scroll', () => {
        const threshold = 150;
        const isScrolledUp = chatBoxContainer.scrollHeight - chatBoxContainer.scrollTop - chatBoxContainer.clientHeight > threshold;
        if (isScrolledUp) {
            scrollBottomBtn.classList.remove('opacity-0', 'invisible', 'scale-90');
            scrollBottomBtn.classList.add('opacity-100', 'visible', 'scale-100');
        } else {
            scrollBottomBtn.classList.add('opacity-0', 'invisible', 'scale-90');
            scrollBottomBtn.classList.remove('opacity-100', 'visible', 'scale-100');
        }
    });

    scrollBottomBtn.addEventListener('click', scrollToBottom);
}

/**
 * App Boot
 */
function initApp() {
    const savedTheme = localStorage.getItem('vail_modern_theme_v3');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
    if (window.innerWidth < 1024) {
        document.body.classList.remove('sidebar-open');
        document.body.classList.add('sidebar-closed');
    }
    
    const tempInput = document.getElementById('param-temp');
    if (tempInput) {
        tempInput.value = settings.temp;
        document.getElementById('temp-val').innerText = settings.temp;
    }

    initEventListeners();
    renderHistory();
    render();
    ensureClient().catch(() => setStatus("Offline", "red"));
}

// Start application
initApp();