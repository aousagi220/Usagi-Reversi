function boardReset() {
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      BOARD[x][y] = EMPTY;
    }
  }

  const mid = BOARD_SIZE / 2;
  BOARD[mid - 1][mid - 1] = WHITE;
  BOARD[mid - 1][mid] = BLACK;
  BOARD[mid][mid - 1] = BLACK;
  BOARD[mid][mid] = WHITE;
}
