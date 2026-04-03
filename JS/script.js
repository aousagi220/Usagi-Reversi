const EMPTY = 0; // no stone
const BLACK = 1; // player 1
const WHITE = 2; // player 2
const BOARD_SIZE = 8;
document.documentElement.style.setProperty("--board-size", BOARD_SIZE);
let currentPlayer = BLACK;

const board = Array(BOARD_SIZE)
  .fill()
  .map(() => Array(BOARD_SIZE).fill(EMPTY));

currentPlayer = resetGame(board, BOARD_SIZE, currentPlayer, BLACK);

document.getElementById("board").addEventListener("click", (e) => {
  if (!e.target.classList.contains("cell")) return;

  const x = parseInt(e.target.dataset.x, 10);
  const y = parseInt(e.target.dataset.y, 10);

  if (placeStone(board, x, y, currentPlayer, BOARD_SIZE)) {
    currentPlayer = proceedTurn(board, BOARD_SIZE, currentPlayer, BLACK, WHITE);
  }
});

document.getElementById("reset-btn").addEventListener("click", () => {
  currentPlayer = resetGame(board, BOARD_SIZE, currentPlayer, BLACK);
});

document.getElementById("rematch-btn").addEventListener("click", () => {
  currentPlayer = resetGame(board, BOARD_SIZE, currentPlayer, BLACK);
});
