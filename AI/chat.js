import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

/* =======================
   MODEL CONFIG
======================= */
const MODEL_CONFIG = {
    BASE: { id: "ar12c/okemo2", name: "OLM 1", schema: "legacy" },
    PRO:  { id: "ar12c/OkemoLLM", name: "OLM 2", schema: "structured" }
};

const SYSTEM_PROMPT =
"You are Okemo Language Model 2 OLM2 a highly helpful verbose and comprehensive AI assistant. " +
"Your goal is to provide detailed and well structured answers in a conversational tone. " +
"CRITICAL ALWAYS wrap equations in $$ tags only. DO NOT under any circumstances use parentheses or square brackets for mathematical formulas.";

let currentModel = MODEL_CONFIG.PRO;
let gradioClient = null;
let history = [];
let isGenerating = false;
let webSearchEnabled = false;

const WEB_TOKEN = "<WEB>";
const WEB_ICON = "🌐";

/* =======================
   UTILITIES
======================= */
function escapeHTML(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/* =======================
   HISTORY CONVERSION
======================= */
function toStructuredHistory(pairs) {
    const out = [];
    for (const [u, a] of pairs) {
        if (u) out.push({
            role: "user",
            content: [{ type: "text", text: u }],
            metadata: null,
            options: null
        });
        if (a) out.push({
            role: "assistant",
            content: [{ type: "text", text: a }],
            metadata: null,
            options: null
        });
    }
    return out;
}

function fromStructuredHistory(structured) {
    const pairs = [];
    for (let i = 0; i < structured.length; i += 2) {
        const u = structured[i]?.content?.[0]?.text ?? "";
        const a = structured[i + 1]?.content?.[0]?.text ?? null;
        pairs.push([u, a]);
    }
    return pairs;
}

/* =======================
   CLIENT
======================= */
async function ensureClient() {
    if (!gradioClient) {
        gradioClient = await Client.connect(currentModel.id);
    }
    return gradioClient;
}

/* =======================
   SEND MESSAGE (AUTO SCHEMA)
======================= */
async function sendMessage(rawInput) {
    if (isGenerating || !rawInput.trim()) return;

    let message = rawInput.trim();
    if (webSearchEnabled && !message.includes(WEB_TOKEN)) {
        message += ` ${WEB_TOKEN}`;
    }

    history.push([message, null]);
    renderChat();
    isGenerating = true;

    const client = await ensureClient();

    let job;

    if (currentModel.schema === "legacy") {
        /* ===== OLM 1 ===== */
        job = client.submit("/on_submit", [
            message,
            history.map(([u, a]) => [u, a]),
            null,
            false
        ]);
    } else {
        /* ===== OLM 2 ===== */
        job = client.submit("/on_submit", [
            message,
            toStructuredHistory(history),
            SYSTEM_PROMPT,
            512,
            0.7,
            0.9
        ]);
    }

    try {
        for await (const chunk of job) {
            if (!chunk?.data) continue;

            if (currentModel.schema === "legacy") {
                history = chunk.data[0] ?? history;
            } else {
                history = fromStructuredHistory(chunk.data[0] ?? []);
            }
            renderChat();
        }
    } catch (e) {
        history.at(-1)[1] = "⚠️ Connection error.";
    } finally {
        isGenerating = false;
        renderChat();
    }
}

/* =======================
   REGENERATE
======================= */
async function regenerateTurn(index) {
    const msg = history[index]?.[0];
    if (!msg) return;

    history[index][1] = null;
    renderChat();
    await sendMessage(msg);
}

/* =======================
   MODEL SWITCH
======================= */
async function switchModel(model) {
    if (model.id === currentModel.id) return;
    currentModel = model;
    gradioClient = null;
    history = [];
    renderChat();
}

/* =======================
   RENDER
======================= */
function renderChat() {
    const box = document.getElementById("okemo-chat");
    if (!box) return;
    box.innerHTML = "";

    history.forEach(([u, a], idx) => {
        box.innerHTML += `
        <div class="text-right mb-6">
            <div class="opacity-60 text-xs mb-1">USER</div>
            <div>${escapeHTML(u.replace(WEB_TOKEN, WEB_ICON))}</div>
        </div>
        <div class="mb-10">
            <div class="opacity-60 text-xs mb-1">${currentModel.name}</div>
            <div>${a ? escapeHTML(a) : "<em>Thinking...</em>"}</div>
            ${a ? `
            <div class="mt-2">
                <button onclick="regenerateTurn(${idx})">↻ Regenerate</button>
            </div>` : ""}
        </div>`;
    });

    box.scrollTop = box.scrollHeight;
}

/* =======================
   UI BINDINGS
======================= */
window.sendOkemoMessage = () => {
    const ta = document.getElementById("okemo-input");
    sendMessage(ta.value);
    ta.value = "";
};

window.regenerateTurn = regenerateTurn;

window.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("model-select-base")
        ?.addEventListener("click", () => switchModel(MODEL_CONFIG.BASE));

    document.getElementById("model-select-pro")
        ?.addEventListener("click", () => switchModel(MODEL_CONFIG.PRO));

    document.getElementById("web-search-option")
        ?.addEventListener("click", () => webSearchEnabled = !webSearchEnabled);

    await ensureClient();
});
