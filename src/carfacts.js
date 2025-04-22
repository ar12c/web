const factContainer = document.getElementById('fact-container');
const factButton = document.getElementById('fact-button');

const catFacts = [
    "A cat's nose print is unique, just like a human's fingerprint.",
    "Cats can make over 100 different sounds, while dogs can only make about 10.",
    "The oldest known pet cat existed 9,500 years ago in Cyprus.",
    "Cats have five toes on each front paw, but usually only four on each back paw.",
    "A group of cats is called a clowder.",
    "Cats spend about 70% of their day sleeping.",
    "The clavicle (collarbone) in a cat is a 'floating' bone that isn't attached to other bones, which allows them to squeeze through very small spaces.",
    "A cat's whiskers are not just for show; they help them navigate and sense their environment.",
    "Some cats are polydactyl, meaning they have more than the usual number of toes.",
    "The average cat can jump up to six times its height.",
    "Cats have excellent night vision and can see in light six times dimmer than what a human needs to see.",
    "A cat's heart beats twice as fast as a human's, ranging from 110 to 140 beats per minute.",
    "The third eyelid in a cat helps to keep their eyes lubricated and protected.",
    "Many cats are lactose intolerant, so milk isn't a good treat for them.",
    "The world's richest cat, according to the Guinness World Records, inherited $13 million."
];

factButton.addEventListener('click', () => {
    const randomIndex = Math.floor(Math.random() * catFacts.length);
    const newFact = catFacts[randomIndex];

    // Remove the 'show' class before updating content to trigger the transition again
    factContainer.classList.remove('show');

    // Wait for a short moment to allow the fade-out to start
    setTimeout(() => {
        factContainer.textContent = newFact;
        // Add the 'show' class to trigger the fade-in and slide-up
        factContainer.classList.add('show');
    }, 50); // Adjust the delay as needed
});
