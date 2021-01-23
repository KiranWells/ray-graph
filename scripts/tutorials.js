let qora = "";
let slideN = 0;

function nextSlide() {
  let classname = `#${qora}slide${slideN}`;
  $(classname).css("display", "none");

  slideN++;
  classname = `#${qora}slide${slideN}`;

  if ($(classname).length == 0) {
    $("#tutorials").css("display", "none");
    $("#quick").css("display", "none");
    $("#advanced").css("display", "none");
  }
  $(classname).css("display", "block");
}

function backSlide() {
  let classname = `#${qora}slide${slideN}`;
  $(classname).css("display", "none");

  slideN--;
  if (slideN <= 0) {
    slideN = 0;
    $("#titleScreen").css("display", "flex");
    $("#tutorials").css("display", "none");
    $("#quick").css("display", "none");
    $("#advanced").css("display", "none");
  }
  classname = `#${qora}slide${slideN}`;

  $(classname).css("display", "block");
}

function setMem() {
  localStorage.setItem("tutorial", "true");
}

$("#quickStart").on("click", () => {
  $("#tutorials").css("display", "flex");
  $("#quick").css("display", "block");
  $("#titleScreen").css("display", "none");
  qora = "q";
  nextSlide();
});

$("#advancedTutorial").on("click", () => {
  $("#tutorials").css("display", "flex");
  $("#advanced").css("display", "block");
  $("#titleScreen").css("display", "none");
  qora = "a";
  nextSlide();
});

let skip = () => {
  $("#titleScreen").css("display", "none");
  setMem();
};

$("#skip").on("click", () => {
  $("#titleScreen").css("display", "none");
  setMem();
});

$("#tutorials").on("click", (e) => {
  if (e.target.id === "tutorials")
    $("#tutorials").css("display", "none");
});

$("#titleScreen").on("click", (e) => {
  if (e.target.id === "titleScreen")
    $("#titleScreen").css("display", "none");
});

$(".back").on("click", () => {
  backSlide();
  setMem();
});

$(".next").on("click", () => {
  nextSlide();
  setMem();
});

$("#showTutorial").on("click", () => {
  $("#titleScreen").css("display", "flex");
  slideN = 0;
});

$("#skip").on("touchstart", () => {
  $("#titleScreen").css("display", "none");
  setMem();
});

$("#tutorials").on("touchstart", (e) => {
  if (e.target.id === "tutorials")
    $("#tutorials").css("display", "none");
});

$("#titleScreen").on("touchstart", (e) => {
  if (e.target.id === "titleScreen")
    $("#titleScreen").css("display", "none");
});

$(".back").on("touchstart", () => {
  backSlide();
  setMem();
});

$(".next").on("touchstart", () => {
  nextSlide();
  setMem();
});

$("#showTutorial").on("touchstart", () => {
  $("#titleScreen").css("display", "flex");
  slideN = 0;
});

if (localStorage.getItem("tutorial") === "true") {
  $("#titleScreen").css("display", "none");
}