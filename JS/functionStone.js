function placeStone(boardData, x, y, color) {
  if (boardData[x][y] !== EMPTY) return false;

  boardData[x][y] = color; // 石を置く
  const flipped = flipStones(boardData, x, y, color); // 石を返す

  if (!flipped) {
    boardData[x][y] = EMPTY;
    return false;
  }
  return true;
}

function flipStones(boardData, x, y, color) {
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
  ];

  let flipped = false;

  for (const [dx, dy] of direction) {
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
    if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && boardData[nx][ny] === color) {
      for (const [fx, fy] of stonesToFlips) {
        boardData[fx][fy] = color;
      }
      if (stonesToFlips.length > 0) flipped = true;
    }
  }

  return flipped;
}
