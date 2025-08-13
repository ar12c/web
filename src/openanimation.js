document.getElementById("test").style.display ="none";

function openTest() {
    document.getElementById("test").style.display = "block";
}

function closeTest() {
    document.getElementById("test").style.display = "none";
}

document.getElementById('More').addEventListener('click', openTest);
document.getElementById('Close').addEventListener('click', closeTest);