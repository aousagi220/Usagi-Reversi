function boardReset(boardData) {
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      boardData[x][y] = EMPTY;
    }
  }

  boardData[3][3] = WHITE;
  boardData[3][4] = BLACK;
  boardData[4][3] = BLACK;
  boardData[4][4] = WHITE;
}
