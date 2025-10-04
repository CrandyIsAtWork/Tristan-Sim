const dialogues = [
  "It’s a normal day... just Tristan being Tristan.",
  "Wait—what’s that sound?",
  "A strange portal appears before him!",
  "Another Tristan steps out... from another dimension?!",
  "“Come with me, or your world is doomed!”",
  "Before he can react, he’s pulled through the portal..."
];

let currentLine = 0;
const dialogueEl = document.getElementById("dialogue");
const nextBtn = document.getElementById("next");

nextBtn.addEventListener("click", () => {
  currentLine++;
  if (currentLine < dialogues.length) {
    dialogueEl.textContent = dialogues[currentLine];
  } else {
    // Cutscene end → move to first world
    window.location.href = "dimensions/pokemon.html";
  }
});
