const EMPTY = 0; // no stone
const BLACK = 1; // player 1
const WHITE = 2; // player 2
let currentPlayer = BLACK;

const board = Array(8)
  .fill()
  .map(() => Array(8).fill(0));

function resetGame() {
  currentPlayer = BLACK;
  boardReset(board);
  renderBoard(board, currentPlayer);
}

function gameEnd() {
  const result = countStone(board);
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

  if (placeStone(board, x, y, currentPlayer)) {
    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
    renderBoard(board, currentPlayer);
    if (!hasValidMove(board, currentPlayer)) {
      if (isGameEnd(board)) {
        console.log("双方置けなくなりました！");
        gameEnd();
        return;
      } else {
        currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
        renderBoard(board, currentPlayer);
        console.log("パスされました！");
      }
    }
  }
});
