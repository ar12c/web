const confettiButton = document.getElementById('confetti-button');
const confettiCanvas = document.getElementById('confetti-canvas');
const confettiInstance = confetti.create(confettiCanvas, {
    resize: true,
    useWorker: true
});

confettiButton.addEventListener('click', () => {
    confettiInstance({
        particleCount: 200,
        spread: 70,
        origin: { x: 0.5, y: 1 },
        zIndex: -100
    });
});