const EMPTY = 0; // no stone
const BLACK = 1; // player 1
const WHITE = 2; // player 2
const TYPE_HUMAN = 0;
const TYPE_CPU =1;
const BOARD_SIZE = 8;
const WEAK = 0;
const NORMAL = 1;
const STRONG = 2;
document.documentElement.style.setProperty("--board-size", BOARD_SIZE);

let currentPlayer = BLACK;
let blackPlayerName = TYPE_HUMAN;
let whitePlayerName = TYPE_CPU;
let blackCpuType = WEAK;
let whiteCpuType = WEAK;

const BOARD = Array(BOARD_SIZE)
  .fill()
  .map(() => Array(BOARD_SIZE).fill(EMPTY));

resetGame();

document.getElementById("board").addEventListener("click", (e) => {
  if (currentPlayer === BLACK && blackPlayerName === TYPE_CPU) return;
  if (currentPlayer === WHITE && whitePlayerName === TYPE_CPU) return;

  if (!e.target.classList.contains("cell")) return;

  const x = parseInt(e.target.dataset.x, 10);
  const y = parseInt(e.target.dataset.y, 10);

  if (placeStone(x, y, currentPlayer)) {
    proceedTurn();
  }
});

document.getElementById("reset-btn").addEventListener("click", () => {
  resetGame();
});

document.getElementById("rematch-btn").addEventListener("click", () => {
  resetGame();
});
