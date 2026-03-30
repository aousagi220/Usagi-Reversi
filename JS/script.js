const EMPTY = 0; // no stone
const BLACK = 1; // player 1
const WHITE = 2; // player 2

const board = Array(8)
  .fill()
  .map(() => Array(8).fill(0));

function printBoard(boardData) {
  const displayBoard = boardData
    .map((row) =>
      row
        .map((cell) => {
          if (cell === WHITE) return "○";
          if (cell === BLACK) return "●";
          return "・";
        })
        .join(" "),
    )
    .join("\n");

  console.log(displayBoard);
}

function startGame() {
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
}

function flipStones(x, y, color) {
  const opponent = color === BLACK ? WHITE : BLACK; // どっちの石を返すか
  const direction = [
    [0, 1], // 右
    [0, -1], // 左
    [1, 0], // 下
    [-1, 0], // 上
    [1, 1], // 右下
    [1, -1], // 左下
    [-1, 1], // 右上
    [-1, -1], // 左上
  ]

  let flipped = false;

  for (const [dx, dy] of direction){
    const stonesToFlips = []; // 記録するための配列の定義

    let nx = x + dx
    let ny = y + dy

      // 別の色がある場所を記録
    while (
      nx >= 0 && nx < 8 && 
      ny >= 0 && ny < 8 &&
      board[nx][ny] === opponent
    ){
      stonesToFlips.push([nx, ny]);
      nx += dx;
      ny += dy;
    }

    // 石を返していいか確認 & 石をすべて返す
    if (
      nx >= 0 && nx < 8 && 
      ny >= 0 && ny < 8 &&
      board[nx][ny] === color
    ){
      for (const [fx, fy] of stonesToFlips) {
        board[fx][fy] = color;
      }
      if (stonesToFlips.length > 0) flipped = true;
    }
  }

  return flipped;
}

function placeStone(x, y, color) {
  if (board[x][y] !== EMPTY) return false;

  board[x][y] = color; // 石を置く
  const flipped = flipStones(x, y, color); // 石を返す

  if (!flipped) {
    board[x][y] = EMPTY;
    return false;
  }

  return true;
}

startGame();
printBoard(board);

placeStone(3, 2, BLACK);
printBoard(board);

placeStone(4, 2, WHITE);
printBoard(board);

placeStone(5, 2, BLACK);
printBoard(board);