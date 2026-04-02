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

function canPlace(boardData, x, y, currentPlayer) {
  if (boardData[x][y] !== EMPTY) return false;

  const opponent = currentPlayer === BLACK ? WHITE : BLACK;

  for (const [dx, dy] of DIRECTIONS) {
    let nx = x + dx;
    let ny = y + dy;
    let foundOpponent = false;

    while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && boardData[nx][ny] === opponent) {
      foundOpponent = true;
      nx += dx;
      ny += dy;
    }
    if (foundOpponent && nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && boardData[nx][ny] === currentPlayer) {
      return true;
    }
  }

  return false;
}

function flipStones(boardData, x, y, currentPlayer) {
  const opponent = currentPlayer === BLACK ? WHITE : BLACK; // どっちの石を返すか

  for (const [dx, dy] of DIRECTIONS) {
    const stonesToFlips = []; // 記録するための配列の定義

    let nx = x + dx;
    let ny = y + dy;

    // 別の色がある場所を記録
    while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && boardData[nx][ny] === opponent) {
      stonesToFlips.push([nx, ny]);
      nx += dx;
      ny += dy;
    }

    // 石を返していいか確認 & 石をすべて返す
    if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && boardData[nx][ny] === currentPlayer) {
      for (const [fx, fy] of stonesToFlips) {
        boardData[fx][fy] = currentPlayer;
      }
    }
  }

  return true;
}

function placeStone(boardData, x, y, currentPlayer) {
  if (boardData[x][y] !== EMPTY) return false;
  if (!canPlace(boardData, x, y, currentPlayer)) return false;

  boardData[x][y] = currentPlayer; // 石を置く
  flipStones(boardData, x, y, currentPlayer); // 石を返す

  return true;
}

function hasValidMove(boardData, currentPlayer) {
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      if (canPlace(boardData, x, y, currentPlayer)) return true;
    }
  }

  return false;
}

function countStone(boardData) {
  let countWhite = 0;
  let countBlack = 0;

  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      if (boardData[x][y] === BLACK) {
        countBlack++;
      } else if (boardData[x][y] === WHITE) {
        countWhite++;
      }
    }
  }

  return { black: countBlack, white: countWhite };
}

function isGameEnd(boardData) {
  if (!hasValidMove(boardData, BLACK) && !hasValidMove(boardData, WHITE)) {
    return true;
  }

  return false;
}
