// /AI/typewriter.js
// Deterministic multi-prompt typewriter (no randomization).
// Types each prompt in order, deletes to blank, pauses 400ms, then continues.
// Uses a single scheduler to avoid speed-up from stacked timers.

(function () {
  function initTypewriter() {
    const input = document.getElementById('aiPromptInput');
    if (!input) return;

    const prompts = [
      'Hi Okemo Language Model',
      'Who is Charles Lerclec?',
      'Tell me a joke',
      'What are you?',
      'clanker',
      'can axolotls spread rumors?',
    ];

    const typingSpeed = 100;     // ms per character while typing
    const deletingSpeed = 10;    // ms per character while deleting (calmer)
    const holdAfterType = 1000;     // ms to hold full phrase (your current preference)
    const holdAfterDelete = 400; // ms before typing next prompt
    const caretChar = '|';

    let promptIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let userInteracted = false;

    // Single scheduling handle
    let nextTickId = null;
    let lastPlaceholder = input.placeholder;

    function setPlaceholder(text) {
      if (text !== lastPlaceholder) {
        input.placeholder = text;
        lastPlaceholder = text;
      }
    }

    function scheduleNext(delay, fn) {
      if (nextTickId) {
        clearTimeout(nextTickId);
        nextTickId = null;
      }
      nextTickId = setTimeout(fn, delay);
    }

    function step() {
      if (userInteracted) return;

      const prompt = prompts[promptIndex];

      if (!deleting) {
        // Typing forward
        charIndex = Math.min(charIndex + 1, prompt.length);
        const shown = prompt.slice(0, charIndex);
        setPlaceholder(shown + caretChar);

        if (charIndex === prompt.length) {
          // Finished typing current prompt; optional hold, then delete
          scheduleNext(holdAfterType, () => {
            deleting = true;
            step();
          });
        } else {
          scheduleNext(typingSpeed, step);
        }
      } else {
        // Deleting backward — show truncated text during deletion
        const prev = prompt.slice(0, charIndex);
        charIndex = Math.max(charIndex - 1, 0);
        const shown = prompt.slice(0, charIndex);

        if (shown !== prev) {
          setPlaceholder(shown); // no caret during deletion for stability
        }

        if (charIndex === 0) {
          // Clear once, advance to next prompt, pause, then type
          setPlaceholder('');
          deleting = false;
          promptIndex = (promptIndex + 1) % prompts.length;
          scheduleNext(holdAfterDelete, step);
        } else {
          scheduleNext(deletingSpeed, step);
        }
      }
    }

    function onUserInput() {
      const wasAnimating = !userInteracted;
      userInteracted = input.value.length > 0;

      if (userInteracted && nextTickId) {
        clearTimeout(nextTickId);
        nextTickId = null;
      }
      // If user cleared input, resume typing after a short delay
      if (!userInteracted && wasAnimating === false) {
        scheduleNext(600, step);
      }
    }

    input.addEventListener('input', onUserInput);
    input.addEventListener('focus', onUserInput);
    input.addEventListener('blur', onUserInput);

    // Kick off after a short delay
    scheduleNext(300, step);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTypewriter);
  } else {
    initTypewriter();
  }
})();
