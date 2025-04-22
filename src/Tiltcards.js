const cards = document.querySelectorAll(".interactive-card");

cards.forEach((card) => {
  // The rest of your event listener code would go inside this loop,
  // so that each 'card' element in the NodeList gets the behavior.
  const initialStyles = {
    transform: null,
    transition: null,
    boxShadow: null,
  };

  card.addEventListener("mouseenter", () => {
    card.style.transition = "transform 0.2s ease-out, box-shadow 0.2s ease-out";
    card.style.transform = "scale(1.04)";
    card.style.boxShadow = "0 10px 20px rgba(0, 0, 0, 0.2)";
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

    const distanceToCenter = Math.hypot(deltaX, deltaY);
    const maxDistance = Math.max(halfWidth, halfHeight);

    const degree = (distanceToCenter * 2) / maxDistance;
    const rx = deltaY / halfHeight;
    const ry = deltaX / halfWidth;

    card.style.transform = `perspective(400px) rotate3d(${-rx}, ${ry}, 0, ${degree}deg) scale(1.04)`;
    card.style.boxShadow = "0 0px 20px rgba(0, 0, 0, 0.3)";
  });

  card.addEventListener("mouseleave", () => {
    card.style.transition = "transform 0.2s ease-in, box-shadow 0.2s ease-in";
    card.style.transform = initialStyles.transform;
    card.style.boxShadow = initialStyles.boxShadow;
    card.style = null;
  });
});