const modal = document.getElementById('test');
const openButton = document.getElementById('openModalBtn');
const closeButton = document.getElementById('Close');
const modalText = document.getElementById('modal-text');

// Function to reset the animation
function resetAnimations() {
    // Remove the animation classes
    modal.classList.remove('fade-in-blur');
    modalText.classList.remove('fade-in-text');
    // Force a reflow/re-render to reset the animation state
    void modal.offsetWidth; 
    
    // Add the animation classes back
    modal.classList.add('fade-in-blur');
    modalText.classList.add('fade-in-text');
}

// Function to show the modal (when "OkemoLLM" is clicked)
openButton.addEventListener('click', () => {
    // 1. Make the modal visible first
    // Assuming your modal is hidden by default (e.g., using a 'hidden' class or 'display: none')
    modal.style.display = 'flex'; // or remove the 'hidden' class
    
    // 2. Run the animation reset/restart
    resetAnimations(); 
});

// Function to hide the modal (when 'X' is clicked)
closeButton.addEventListener('click', () => {
    // Hide the modal immediately (or after a slight delay if you want a fade-out effect)
    modal.style.display = 'none'; // or add the 'hidden' class
    
    // **Crucially**, remove the animation classes right after hiding so they're ready to be added again on open
    modal.classList.remove('fade-in-blur');
    modalText.classList.remove('fade-in-text');
});