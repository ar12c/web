
const modal = document.getElementById("test");
const closeBtn = document.getElementById("Close");

function openModal() {
  
  modal.classList.remove("hidden");

  
  modal.classList.remove("fade-out-once");

  
  modal.classList.remove("fade-in-once");
  void modal.offsetWidth; 
  modal.classList.add("fade-in-once");
}

function closeModal() {
  
  modal.classList.remove("fade-in-once");

  
  modal.classList.add("fade-out-once");

  
  modal.addEventListener(
    "animationend",
    (e) => {
      
      if (e.animationName === "fadeOutOnce") {
        modal.classList.add("hidden");
        modal.classList.remove("fade-out-once");
      }
    },
    { once: true }
  );
}

closeBtn.addEventListener("click", closeModal);



