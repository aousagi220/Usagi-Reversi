const EMPTY = 0; // no stone
const BLACK = 1; // player 1
const WHITE = 2; // player 2
const BOARD_SIZE = 8;
document.documentElement.style.setProperty("--board-size", BOARD_SIZE);
let currentPlayer = BLACK;

const board = Array(BOARD_SIZE)
  .fill()
  .map(() => Array(BOARD_SIZE).fill(EMPTY));

function resetGame() {
  currentPlayer = BLACK;
  boardReset(board, BOARD_SIZE);
  gameUI(board, currentPlayer, BOARD_SIZE, countStone(board, BOARD_SIZE));
  hiddenResultModal();
}

function gameEnd() {
  const result = countStone(board, BOARD_SIZE);
  if (result.black > result.white) result.message = "黒の勝ち！";
  else if (result.black < result.white) result.message = "白の勝ち！";
  else result.message = "引き分け！";
  showResultModal(result);
}
resetGame();

document.getElementById("board").addEventListener("click", (e) => {
  if (!e.target.classList.contains("cell")) return;

  const x = parseInt(e.target.dataset.x, 10);
  const y = parseInt(e.target.dataset.y, 10);

  if (placeStone(board, x, y, currentPlayer, BOARD_SIZE)) {
    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
    gameUI(board, currentPlayer, BOARD_SIZE, countStone(board, BOARD_SIZE));
    if (!hasValidMove(board, currentPlayer, BOARD_SIZE)) {
      if (isGameEnd(board, BOARD_SIZE)) {
        gameEnd();
        return;
      } else {
        currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
        gameUI(board, currentPlayer, BOARD_SIZE, countStone(board, BOARD_SIZE));
        console.log("パスされました！");
      }
    }
  }
});

document.getElementById("reset-btn").addEventListener("click", () => {
  resetGame();
});

document.getElementById("rematch-btn").addEventListener("click", () => {
  resetGame();
});
