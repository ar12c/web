const cards = document.querySelectorAll(".interactive-card");

cards.forEach((card) => {
  const initialStyles = {
    transform: null,
    boxShadow: null,
  };

  // Enable GPU acceleration for smoother animations
  card.style.willChange = "transform, box-shadow";

  card.addEventListener("mouseenter", () => {
    card.style.transition = "transform 600ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 600ms ease";
    card.style.transform = "scale(1.015)";
    card.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.08)";
  });

  card.addEventListener("mousemove", (e) => {
    const { clientX: pointerX, clientY: pointerY } = e;
    const { left, top, width, height } = card.getBoundingClientRect();

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const cardCenterX = left + halfWidth;
    const cardCenterY = top + halfHeight;

    const deltaX = pointerX - cardCenterX;
    const deltaY = pointerY - cardCenterY;

    const rotationX = (deltaY / halfHeight) * -5; // max tilt ~5deg
    const rotationY = (deltaX / halfWidth) * 5;

    card.style.transform = `
      perspective(800px) 
      rotateX(${rotationX}deg) 
      rotateY(${rotationY}deg) 
      scale(1.015)
    `;

    // Subtle light effect based on mouse position
    const lightX = 50 + (deltaX / width) * 20; 
    const lightY = 50 + (deltaY / height) * 20;
    card.style.boxShadow = `
      ${-rotationY * 2}px ${rotationX * 2}px 30px rgba(0, 0, 0, 0.15),
      inset ${lightX}px ${lightY}px 80px rgba(255, 255, 255, 0.05)
    `;
  });

  card.addEventListener("mouseleave", () => {
    card.style.transition = "transform 800ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 800ms ease";
    card.style.transform = initialStyles.transform;
    card.style.boxShadow = initialStyles.boxShadow;
  });
});
