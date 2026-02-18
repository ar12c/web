import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import gradio as gr
from transformers import GPTNeoXTokenizerFast

# ================= CONFIG =================

D_MODEL = 832
N_HEADS = 13
N_LAYERS = 18
VOCAB_SIZE = 51200
SEQ_LEN = 512
DEVICE = "cpu"
WEIGHTS_PATH = "OLM_NORTH_STAR.pt"
TOKENIZER_NAME = "EleutherAI/gpt-neox-20b"

# ================= MODEL =================

class RotaryEmbedding(nn.Module):
    def __init__(self, dim, base=10000):
        super().__init__()
        self.dim = dim
        self.base = base

    def forward(self, x, seq_len):
        device = x.device
        inv_freq = 1.0 / (self.base ** (torch.arange(0, self.dim, 2, device=device).float() / self.dim))
        t = torch.arange(seq_len, device=device).type_as(inv_freq)
        freqs = torch.outer(t, inv_freq)
        cos = freqs.cos()[None, None, :, :]
        sin = freqs.sin()[None, None, :, :]
        x1 = x[..., 0::2]
        x2 = x[..., 1::2]
        out = torch.stack([x1 * cos - x2 * sin, x1 * sin + x2 * cos], dim=-1)
        return out.flatten(-2)

class Attention(nn.Module):
    def __init__(self):
        super().__init__()
        self.qkv = nn.Linear(D_MODEL, 3 * D_MODEL, bias=False)
        self.proj = nn.Linear(D_MODEL, D_MODEL, bias=False)
        self.head_dim = D_MODEL // N_HEADS
        self.rope = RotaryEmbedding(self.head_dim)

    def forward(self, x, mask=None):
        B, T, C = x.shape
        qkv = self.qkv(x)
        q, k, v = qkv.chunk(3, dim=-1)
        q = q.view(B, T, N_HEADS, self.head_dim).transpose(1, 2)
        k = k.view(B, T, N_HEADS, self.head_dim).transpose(1, 2)
        v = v.view(B, T, N_HEADS, self.head_dim).transpose(1, 2)
        q = self.rope(q, T)
        k = self.rope(k, T)
        y = F.scaled_dot_product_attention(q, k, v, attn_mask=mask, is_causal=True)
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        return self.proj(y)

class FeedForward(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.ModuleList([
            nn.Linear(D_MODEL, int(4.5 * D_MODEL), bias=False),
            nn.GELU(),
            nn.Linear(int(4.5 * D_MODEL), D_MODEL, bias=False)
        ])

    def forward(self, x):
        for layer in self.layers:
            x = layer(x)
        return x

class Block(nn.Module):
    def __init__(self):
        super().__init__()
        self.ln1 = nn.LayerNorm(D_MODEL)
        self.attn = Attention()
        self.ln2 = nn.LayerNorm(D_MODEL)
        self.ff = FeedForward()

    def forward(self, x):
        x = x + self.attn(self.ln1(x))
        x = x + self.ff(self.ln2(x))
        return x

class PyTorchGPT(nn.Module):
    def __init__(self):
        super().__init__()
        self.embed = nn.Embedding(VOCAB_SIZE, D_MODEL)
        self.blocks = nn.ModuleList([Block() for _ in range(N_LAYERS)])
        self.ln = nn.LayerNorm(D_MODEL)
        self.head = nn.Linear(D_MODEL, VOCAB_SIZE, bias=False)

    def forward(self, idx):
        x = self.embed(idx)
        for block in self.blocks:
            x = block(x)
        x = self.ln(x)
        return self.head(x)

# ================= LOAD =================

model = None
tokenizer = None

def load_model():
    global model, tokenizer
    print(f"--- Initializing NorthStar on {DEVICE} ---")
    
    model = PyTorchGPT().to(DEVICE)

    if os.path.exists(WEIGHTS_PATH):
        print(f"✓ Loading weights from: {WEIGHTS_PATH}")
        state_dict = torch.load(WEIGHTS_PATH, map_location=DEVICE)
        if "model_state_dict" in state_dict:
            state_dict = state_dict["model_state_dict"]
        model.load_state_dict(state_dict)
        model.eval()
        print("✓ Weights loaded successfully!")
    else:
        print(f"✗ ERROR: {WEIGHTS_PATH} not found!")
    
    tokenizer = GPTNeoXTokenizerFast.from_pretrained(TOKENIZER_NAME)
    print("✓ Tokenizer loaded")

load_model()

# ================= GENERATION =================


def get_system_prompt(use_thought):
    """Selects the appropriate system prompt based on the thought toggle."""
    if use_thought:
        return "You are Polaris, a creative and analytical AI created by OkemoVail. You can think deeply inside <thought> tags, then provide a helpful and natural answer."
    return "You are Polaris, a creative and analytical AI created by OkemoVail. Provide a helpful and natural answer directly."

def extract_text(content):
    """Extract plain text from various Gradio content formats."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        # List of content parts like [{"type": "text", "text": "..."}]
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                parts.append(part.get("text", part.get("value", str(part))))
            else:
                parts.append(getattr(part, "text", getattr(part, "value", str(part))))
        return "".join(parts)
    return str(content)

def stream_chat(message, history, use_thought=True):
    """Streaming chat function - yields updated history as tokens are generated."""
    if not message.strip():
        yield history
        return
    
    model.eval()
    
    # Select system prompt based on thought toggle
    instruction = get_system_prompt(use_thought)
    
    # Build prompt with ChatML format
    full_prompt = f"<|im_start|>system\n{instruction}<|im_end|>\n"
    
    # Add conversation history - handle both dict and ChatMessage objects
    for turn in history:
        role = ""
        content = ""
        if isinstance(turn, dict):
            role = turn.get("role", "user")
            content = extract_text(turn.get("content", ""))
        else:
            # Gradio ChatMessage objects
            role = getattr(turn, "role", "user")
            content = extract_text(getattr(turn, "content", ""))
        if role and content:
            full_prompt += f"<|im_start|>{role}\n{content}<|im_end|>\n"
    
    # Add current user input
    full_prompt += f"<|im_start|>user\n{message}<|im_end|>\n<|im_start|>assistant\n"
    
    # Encode
    idx = tokenizer.encode(full_prompt, return_tensors="pt").to(DEVICE)
    generated_text = ""
    
    # Build clean history as plain dicts for output
    clean_history = []
    for turn in history:
        if isinstance(turn, dict):
            clean_history.append({"role": turn.get("role", "user"), "content": extract_text(turn.get("content", ""))})
        else:
            clean_history.append({"role": getattr(turn, "role", "user"), "content": extract_text(getattr(turn, "content", ""))})
    
    # Add user message to history first
    new_history = clean_history + [
        {"role": "user", "content": message},
        {"role": "assistant", "content": ""}
    ]
    
    max_new_tokens = 200
    temperature = 0.8
    top_k = 40
    
    for _ in range(max_new_tokens):
        idx_cond = idx if idx.size(1) <= SEQ_LEN else idx[:, -SEQ_LEN:]
        
        with torch.no_grad():
            logits = model(idx_cond)
            logits = logits[:, -1, :] / temperature
            
            if top_k is not None:
                v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < v[:, [-1]]] = -float('Inf')
            
            probs = F.softmax(logits, dim=-1)
            idx_next = torch.multinomial(probs, num_samples=1)
            
            # Decode just the new token
            new_token = tokenizer.decode(idx_next[0])
            
            # Check for stop token before adding
            if "<|im_end" in new_token or "<|im_end|>" in generated_text + new_token:
                # Clean up the response
                final_text = generated_text
                for stop in ["<|im_end|>", "<|im_end", "<|im_", "<|im", "<|i", "<|"]:
                    if stop in final_text:
                        final_text = final_text.split(stop)[0]
                        break
                new_history[-1]["content"] = final_text.strip() + "__DONE__"
                yield new_history
                return
            
            generated_text += new_token
            
            # Update assistant message and yield
            new_history[-1]["content"] = generated_text.strip()
            yield new_history
            
            idx = torch.cat((idx, idx_next), dim=1)
            
            if idx_next.item() == tokenizer.eos_token_id:
                break
    
    # Final cleanup
    final_text = generated_text
    for stop in ["<|im_end|>", "<|im_end", "<|im_", "<|im", "<|i", "<|"]:
        if stop in final_text:
            final_text = final_text.split(stop)[0]
            break
    new_history[-1]["content"] = final_text.strip() + "__DONE__"
    yield new_history

def clear_chat():
    return []

# Simple Blocks interface
with gr.Blocks(title="Polaris") as demo:
    gr.Markdown("# 🌠 Polaris")
    
    chatbot = gr.Chatbot(height=500, label="Chat")
    thought_toggle = gr.Checkbox(value=True, visible=False, elem_id="thought-toggle", label="Use Thought")
    
    with gr.Row():
        msg = gr.Textbox(placeholder="Type message...", show_label=False, scale=9)
        clear = gr.Button("Clear", scale=1)
    
    # API endpoint with explicit name - streaming
    msg.submit(stream_chat, [msg, chatbot, thought_toggle], [chatbot], api_name="chat").then(
        lambda: "", None, [msg]
    )
    
    clear.click(clear_chat, None, [chatbot], api_name="clear_chat")

if __name__ == "__main__":
    demo.queue().launch()
