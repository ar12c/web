import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

/* =======================
   MODEL CONFIG
======================= */
const MODELS = {
  OLM1: { id: "ar12c/okemo2", name: "OLM 1", schema: "legacy" },
  OLM2: { id: "ar12c/OkemoLLM", name: "OLM 2", schema: "structured" }
};

const SYSTEM_PROMPT =
"You are Okemo Language Model 2 OLM2 a highly helpful verbose and comprehensive AI assistant. " +
"Your goal is to provide detailed and well structured answers in a conversational tone. " +
"CRITICAL ALWAYS wrap equations in $$ tags only. DO NOT under any circumstances use parentheses or square brackets for mathematical formulas.";

const WEB_TOKEN = "<WEB>";
const WEB_ICON = "🌐";

let currentModel = MODELS.OLM2;
let client = null;
let history = [];
let isGenerating = false;
let webSearchEnabled = false;

/* =======================
   DOM
======================= */
const chatBox = document.getElementById("okemo-chat");
const textarea = document.getElementById("okemo-input");
const sendBtn = document.getElementById("okemo-send");
const statusEl = document.getElementById("okemo-status");
const emptyPrompt = document.getElementById("empty-chat-prompt");

/* =======================
   HELPERS
======================= */
function escapeHTML(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setStatus(msg = "") {
  if (!statusEl) return;
  statusEl.textContent = msg;
  if (msg) setTimeout(() => statusEl.textContent = "", 2500);
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

function fromStructuredHistory(arr) {
  const pairs = [];
  for (let i = 0; i < arr.length; i += 2) {
    const u = arr[i]?.content?.[0]?.text ?? "";
    const a = arr[i + 1]?.content?.[0]?.text ?? null;
    pairs.push([u, a]);
  }
  return pairs;
}

/* =======================
   CLIENT
======================= */
async function ensureClient() {
  if (!client) client = await Client.connect(currentModel.id);
  return client;
}

/* =======================
   SEND
======================= */
async function sendMessage(overrideText = null) {
  if (isGenerating) return;

  let msg = overrideText ?? textarea.value.trim();
  if (!msg) return;

  if (!overrideText) textarea.value = "";

  if (webSearchEnabled && !msg.includes(WEB_TOKEN)) {
    msg += ` ${WEB_TOKEN}`;
  }

  history.push([msg, null]);
  render();
  isGenerating = true;

  try {
    const c = await ensureClient();
    let job;

    if (currentModel.schema === "legacy") {
      job = c.submit("/on_submit", [
        msg,
        history.map(([u, a]) => [u, a]),
        null,
        false
      ]);
    } else {
      job = c.submit("/on_submit", [
        msg,
        toStructuredHistory(history),
        SYSTEM_PROMPT,
        512,
        0.7,
        0.9
      ]);
    }

    for await (const chunk of job) {
      if (!chunk?.data) continue;
      history = currentModel.schema === "legacy"
        ? chunk.data[0]
        : fromStructuredHistory(chunk.data[0]);
      render();
    }
  } catch {
    history.at(-1)[1] = "⚠️ Connection error.";
  } finally {
    isGenerating = false;
    render();
  }
}

/* =======================
   COPY / REGENERATE
======================= */
function copyResponse(idx) {
  const text = history[idx]?.[1];
  if (!text) return;
  navigator.clipboard.writeText(text);
  setStatus("Copied");
}

function regenerate(idx) {
  if (isGenerating) return;
  const msg = history[idx]?.[0];
  if (!msg) return;

  history[idx][1] = null;
  history = history.slice(0, idx + 1);
  render();
  sendMessage(msg);
}

/* =======================
   RENDER
======================= */
function render() {
  chatBox.innerHTML = "";

  if (history.length === 0) {
    emptyPrompt?.classList.remove("hidden");
    return;
  } else {
    emptyPrompt?.classList.add("hidden");
  }

  history.forEach(([u, a], idx) => {
    chatBox.insertAdjacentHTML("beforeend", `
      <div class="text-right">
        <div class="text-[10px] opacity-40 mb-1">USER</div>
        <div class="font-bold">
          ${escapeHTML(u.replace(WEB_TOKEN, WEB_ICON))}
        </div>
      </div>

      <div>
        <div class="text-[10px] opacity-40 mb-1">${currentModel.name}</div>
        <div class="leading-relaxed">
          ${a ? escapeHTML(a) : "<span class='typing-dots italic'>Thinking</span>"}
        </div>

        ${a ? `
        <div class="flex gap-3 mt-2 text-[10px] font-black uppercase tracking-widest opacity-40">
          <button class="hover:opacity-100 transition"
            onclick="window.__okemoCopy(${idx})">
            <i class="fa-regular fa-copy"></i> Copy
          </button>
          <button class="hover:opacity-100 transition"
            onclick="window.__okemoRegen(${idx})">
            <i class="fa-solid fa-rotate-right"></i> Regenerate
          </button>
        </div>` : ""}
      </div>
    `);
  });
}

/* =======================
   MODEL SWITCH
======================= */
function switchModel(model) {
  if (model.id === currentModel.id) return;
  currentModel = model;
  client = null;
  history = [];
  render();
  setStatus(`Switched to ${model.name}`);
}

/* =======================
   EVENTS
======================= */
sendBtn?.addEventListener("click", () => sendMessage());

textarea?.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

document.getElementById("model-select-pro")
  ?.addEventListener("click", () => switchModel(MODELS.OLM2));

document.getElementById("model-select-base")
  ?.addEventListener("click", () => switchModel(MODELS.OLM1));

document.getElementById("web-search-option")
  ?.addEventListener("click", () => {
    webSearchEnabled = !webSearchEnabled;
    setStatus(webSearchEnabled ? "Web Search On" : "Web Search Off");
  });

document.getElementById("new-chat-link-header")
  ?.addEventListener("click", () => {
    history = [];
    render();
    setStatus("Reset");
  });

/* expose for inline buttons */
window.__okemoCopy = copyResponse;
window.__okemoRegen = regenerate;

/* =======================
   INIT
======================= */
ensureClient().then(() => setStatus("Model Ready"));
