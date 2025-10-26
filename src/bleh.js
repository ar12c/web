// script.js
const modal = document.getElementById("test");
const closeBtn = document.getElementById("Close");

function openModal() {
  // Unhide first
  modal.classList.remove("hidden");

  // Clean up any closing state
  modal.classList.remove("fade-out-once");

  // Re-trigger fade in
  modal.classList.remove("fade-in-once");
  void modal.offsetWidth; // force reflow so the animation restarts
  modal.classList.add("fade-in-once");
}

function closeModal() {
  // Prevent stacking animations
  modal.classList.remove("fade-in-once");

  // Play fade out
  modal.classList.add("fade-out-once");

  // After fade out finishes, hide the element
  modal.addEventListener(
    "animationend",
    (e) => {
      // Only hide if the fade-out animation just finished
      if (e.animationName === "fadeOutOnce") {
        modal.classList.add("hidden");
        modal.classList.remove("fade-out-once");
      }
    },
    { once: true }
  );
}

closeBtn.addEventListener("click", closeModal);

// Call openModal() when you want to show it (e.g., on some trigger)
// openModal();
