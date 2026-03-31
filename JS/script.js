const EMPTY = 0; // no stone
const BLACK = 1; // player 1
const WHITE = 2; // player 2
let PLAYER = 0;

const board = Array(8)
  .fill()
  .map(() => Array(8).fill(0));

function resetGame() {
  PLAYER = BLACK;
  startGame(board);
  renderBoard(board);
}

resetGame()

document.getElementById("board").addEventListener("click", (e) => {
  if (!e.target.classList.contains("cell")) return;

  const x = parseInt(e.target.dataset.x);
  const y = parseInt(e.target.dataset.y);

  if (placeStone(board, x, y, PLAYER)) {
    PLAYER = PLAYER === BLACK ? WHITE : BLACK;
    renderBoard(board);
    console.log("正常に動作しました！");
    printBoard(board);
  }
});
