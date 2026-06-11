const BOARD_SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const DIRECTIONS = [
  [0, 1],   // 右
  [0, -1],  // 左
  [1, 0],   // 下
  [-1, 0],  // 上
  [1, 1],   // 右下
  [1, -1],  // 左下
  [-1, 1],  // 右上
  [-1, -1], // 左上
];

function createBoard() {
  const board = Array(BOARD_SIZE)
    .fill()
    .map(() => Array(BOARD_SIZE).fill(EMPTY));

  const middle = BOARD_SIZE / 2;

  board[middle - 1][middle - 1] = WHITE;
  board[middle - 1][middle] = BLACK;
  board[middle][middle - 1] = BLACK;
  board[middle][middle] = WHITE;

  return board;
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function isInsideBoard(x, y) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function getOpponent(player) {
  return player === BLACK ? WHITE : BLACK;
}

function getFlippableStonesInDirection(board, x, y, player, dx, dy) {
  const opponent = getOpponent(player);
  const stones = [];

  let nextX = x + dx;
  let nextY = y + dy;

  while (
    isInsideBoard(nextX, nextY) &&
    board[nextX][nextY] === opponent
  ) {
    stones.push([nextX, nextY]);
    nextX += dx;
    nextY += dy;
  }

  if (
    stones.length > 0 &&
    isInsideBoard(nextX, nextY) &&
    board[nextX][nextY] === player
  ) {
    return stones;
  }

  return [];
}

function getFlippableStones(board, x, y, player) {
  if (!isInsideBoard(x, y) || board[x][y] !== EMPTY) {
    return [];
  }

  const stones = [];

  for (const [dx, dy] of DIRECTIONS) {
    const stonesInDirection = getFlippableStonesInDirection(
      board,
      x,
      y,
      player,
      dx,
      dy,
    );

    stones.push(...stonesInDirection);
  }

  return stones;
}

function canPlace(board, x, y, player) {
  return getFlippableStones(board, x, y, player).length > 0;
}

function getValidMoves(board, player) {
  const validMoves = [];

  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (canPlace(board, x, y, player)) {
        validMoves.push([x, y]);
      }
    }
  }

  return validMoves;
}

function placeStone(board, x, y, player) {
  const flippableStones = getFlippableStones(board, x, y, player);
  if (flippableStones.length === 0) return false;

  board[x][y] = player;

  for (const [flipX, flipY] of flippableStones) {
    board[flipX][flipY] = player;
  }

  return true;
}

function hasValidMove(board, player) {
  return getValidMoves(board, player).length > 0;
}

function isGameEnd(board) {
  return !hasValidMove(board, BLACK) && !hasValidMove(board, WHITE);
}

function countStones(board) {
  const count = {
    black: 0,
    white: 0,
    empty: 0,
  };

  for (const row of board) {
    for (const stone of row) {
      if (stone === BLACK) {
        count.black++;
      } else if (stone === WHITE) {
        count.white++;
      } else {
        count.empty++;
      }
    }
  }

  return count;
}

module.exports = {
  BOARD_SIZE,
  EMPTY,
  BLACK,
  WHITE,
  createBoard,
  cloneBoard,
  isInsideBoard,
  getOpponent,
  getFlippableStonesInDirection,
  getFlippableStones,
  canPlace,
  getValidMoves,
  placeStone,
  hasValidMove,
  isGameEnd,
  countStones,
};
