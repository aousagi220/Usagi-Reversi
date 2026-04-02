const EMPTY = 0; // no stone
const BLACK = 1; // player 1
const WHITE = 2; // player 2
const BOARD_SIZE = 10;
let currentPlayer = BLACK;

const board = Array(BOARD_SIZE)
  .fill()
  .map(() => Array(BOARD_SIZE).fill(EMPTY));

function resetGame() {
  currentPlayer = BLACK;
  boardReset(board, BOARD_SIZE);
  renderBoard(board, currentPlayer, BOARD_SIZE);
}

function gameEnd() {
  const result = countStone(board, BOARD_SIZE);
  if (result.black > result.white) {
    console.log("黒の勝ち！");
  } else if (result.black < result.white) {
    console.log("白の勝ち！");
  } else {
    console.log("引き分け！");
  }
}

resetGame();

document.getElementById("board").addEventListener("click", (e) => {
  if (!e.target.classList.contains("cell")) return;

  const x = parseInt(e.target.dataset.x, 10);
  const y = parseInt(e.target.dataset.y, 10);

  if (placeStone(board, x, y, currentPlayer, BOARD_SIZE)) {
    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
    renderBoard(board, currentPlayer, BOARD_SIZE);
    if (!hasValidMove(board, currentPlayer, BOARD_SIZE)) {
      if (isGameEnd(board, BOARD_SIZE)) {
        console.log("双方置けなくなりました！");
        gameEnd();
        return;
      } else {
        currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
        renderBoard(board, currentPlayer, BOARD_SIZE);
        console.log("パスされました！");
      }
    }
  }
});
