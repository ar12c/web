const modal = document.getElementById('test');
const openButton = document.getElementById('openModalBtn');
const closeButton = document.getElementById('Close');
const modalText = document.getElementById('modal-text');


function resetAnimations() {
    
    modal.classList.remove('fade-in-blur');
    modalText.classList.remove('fade-in-text');
    
    void modal.offsetWidth; 
    
    
    modal.classList.add('fade-in-blur');
    modalText.classList.add('fade-in-text');
}


openButton.addEventListener('click', () => {
    
    
    modal.style.display = 'flex'; 
    
    
    resetAnimations(); 
});


closeButton.addEventListener('click', () => {
    
    modal.style.display = 'none'; 
    
    
    modal.classList.remove('fade-in-blur');
    modalText.classList.remove('fade-in-text');
});