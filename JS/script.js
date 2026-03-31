const EMPTY = 0; // no stone
const BLACK = 1; // player 1
const WHITE = 2; // player 2

const board = Array(8)
  .fill()
  .map(() => Array(8).fill(0));

startGame(board);
printBoard(board);

placeStone(board, 3, 2, BLACK);
printBoard(board);

placeStone(board, 4, 2, WHITE);
printBoard(board);

placeStone(board, 5, 2, BLACK);
printBoard(board);