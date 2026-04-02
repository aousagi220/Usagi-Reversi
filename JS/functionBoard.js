function boardReset(boardData, boardSize) {
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      boardData[x][y] = EMPTY;
    }
  }

  const mid = boardSize / 2;
  boardData[mid - 1][mid - 1] = WHITE;
  boardData[mid - 1][mid] = BLACK;
  boardData[mid][mid - 1] = BLACK;
  boardData[mid][mid] = WHITE;
}
