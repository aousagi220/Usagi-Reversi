const DIRECTIONS = [
  [0, 1], // 右
  [0, -1], // 左
  [1, 0], // 下
  [-1, 0], // 上
  [1, 1], // 右下
  [1, -1], // 左下
  [-1, 1], // 右上
  [-1, -1], // 左上
];

function isInsideBoard(x, y) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function canPlace(x, y, player) {
  if (BOARD[x][y] !== EMPTY) return false;

  const opponent = player === BLACK ? WHITE : BLACK;

  for (const [dx, dy] of DIRECTIONS) {
    let nx = x + dx;
    let ny = y + dy;
    let foundOpponent = false;

    while (isInsideBoard(nx, ny) && BOARD[nx][ny] === opponent) {
      foundOpponent = true;
      nx += dx;
      ny += dy;
    }
    if (foundOpponent && isInsideBoard(nx, ny) && BOARD[nx][ny] === player) {
      return true;
    }
  }

  return false;
}

function flipStones(x, y, player) {
  const opponent = player === BLACK ? WHITE : BLACK; // どっちの石を返すか

  for (const [dx, dy] of DIRECTIONS) {
    const stonesToFlips = []; // 記録するための配列の定義

    let nx = x + dx;
    let ny = y + dy;

    // 別の色がある場所を記録
    while (isInsideBoard(nx, ny) && BOARD[nx][ny] === opponent) {
      stonesToFlips.push([nx, ny]);
      nx += dx;
      ny += dy;
    }

    // 石を返していいか確認 & 石をすべて返す
    if (isInsideBoard(nx, ny) && BOARD[nx][ny] === player) {
      for (const [fx, fy] of stonesToFlips) {
        BOARD[fx][fy] = player;
      }
    }
  }
}

function placeStone(x, y, player) {
  if (BOARD[x][y] !== EMPTY) return false;
  if (!canPlace(x, y, player)) return false;

  BOARD[x][y] = player; // 石を置く
  flipStones(x, y, player); // 石を返す

  return true;
}

function hasValidMove(player) {
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (canPlace(x, y, player)) return true;
    }
  }

  return false;
}

function countStone() {
  let countWhite = 0;
  let countBlack = 0;

  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (BOARD[x][y] === BLACK) {
        countBlack++;
      } else if (BOARD[x][y] === WHITE) {
        countWhite++;
      }
    }
  }

  return { black: countBlack, white: countWhite };
}

function isGameEnd() {
  return !hasValidMove(BLACK) && !hasValidMove(WHITE);
}

function getValidMoves() {
  const validMoves = [];
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (canPlace(x, y, currentPlayer)) {
        validMoves.push([x, y]);
      }
    }
  }
  return validMoves;
}