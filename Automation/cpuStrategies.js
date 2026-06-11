const {
  BOARD_SIZE,
  EMPTY,
  getFlippableStones,
  getValidMoves,
  countStones,
} = require("./reversiEngine");

const WEAK = 0;
const NORMAL = 1;
const STRONG = 2;

const CORNERS = [
  [0, 0],
  [0, BOARD_SIZE - 1],
  [BOARD_SIZE - 1, 0],
  [BOARD_SIZE - 1, BOARD_SIZE - 1],
];

const CORNER_AREAS = [
  {
    corner: [0, 0],
    edgeSquares: [
      [0, 1],
      [1, 0],
    ],
    crossSquare: [1, 1],
  },
  {
    corner: [0, BOARD_SIZE - 1],
    edgeSquares: [
      [0, BOARD_SIZE - 2],
      [1, BOARD_SIZE - 1],
    ],
    crossSquare: [1, BOARD_SIZE - 2],
  },
  {
    corner: [BOARD_SIZE - 1, 0],
    edgeSquares: [
      [BOARD_SIZE - 2, 0],
      [BOARD_SIZE - 1, 1],
    ],
    crossSquare: [BOARD_SIZE - 2, 1],
  },
  {
    corner: [BOARD_SIZE - 1, BOARD_SIZE - 1],
    edgeSquares: [
      [BOARD_SIZE - 2, BOARD_SIZE - 1],
      [BOARD_SIZE - 1, BOARD_SIZE - 2],
    ],
    crossSquare: [BOARD_SIZE - 2, BOARD_SIZE - 2],
  },
];

const CORNER_NEAR_PENALTY = -20;
const CORNER_NEAR_CROSS_PENALTY = -30;
const ONE_STONE_BONUS = 5;
const EDGE_BONUS = 15;
const CORNER_BONUS = 50;

function isSameSquare([firstX, firstY], [secondX, secondY]) {
  return firstX === secondX && firstY === secondY;
}

function selectRandomMove(moves, random = Math.random) {
  if (moves.length === 0) return null;

  const randomIndex = Math.floor(random() * moves.length);
  return moves[randomIndex];
}

function boardToKey(board) {
  return board.flat().join("");
}

function selectOpeningMove(
  board,
  player,
  validMoves,
  openingBook,
  random = Math.random,
) {
  if (!openingBook?.positions) return null;

  const positionKey = `${player}:${boardToKey(board)}`;
  const bookMoves = openingBook.positions[positionKey];
  if (!bookMoves || bookMoves.length === 0) return null;

  const validBookMoves = bookMoves.filter((bookMove) =>
    validMoves.some(([x, y]) => x === bookMove.x && y === bookMove.y),
  );
  if (validBookMoves.length === 0) return null;

  const bestScore = Math.max(...validBookMoves.map((move) => move.score));
  const bestMoves = validBookMoves
    .filter((move) => move.score === bestScore)
    .map(({ x, y }) => [x, y]);

  return selectRandomMove(bestMoves, random);
}

function selectWeakMove(validMoves, random = Math.random) {
  return selectRandomMove(validMoves, random);
}

function selectNormalMove(board, player, validMoves, random = Math.random) {
  if (validMoves.length === 0) return null;

  const scoredMoves = validMoves.map(([x, y]) => ({
    x,
    y,
    score: getFlippableStones(board, x, y, player).length,
  }));
  const maxScore = Math.max(...scoredMoves.map((move) => move.score));
  const bestMoves = scoredMoves
    .filter((move) => move.score === maxScore)
    .map(({ x, y }) => [x, y]);

  return selectRandomMove(bestMoves, random);
}

function selectStrongMove(board, player, validMoves, random = Math.random) {
  if (validMoves.length === 0) return null;

  const stoneCount = countStones(board);
  const isOpening = stoneCount.black + stoneCount.white <= 15;

  const scoredMoves = validMoves.map(([x, y]) => {
    const flippableCount = getFlippableStones(board, x, y, player).length;
    const square = [x, y];
    let score = flippableCount;

    if (isOpening && flippableCount === 1) {
      score += ONE_STONE_BONUS;
    }

    if (x === 0 || x === BOARD_SIZE - 1 || y === 0 || y === BOARD_SIZE - 1) {
      score += EDGE_BONUS;
    }

    if (CORNERS.some((corner) => isSameSquare(corner, square))) {
      score += CORNER_BONUS;
    }

    for (const area of CORNER_AREAS) {
      const [cornerX, cornerY] = area.corner;
      if (board[cornerX][cornerY] !== EMPTY) continue;

      if (area.edgeSquares.some((edgeSquare) => isSameSquare(edgeSquare, square))) {
        score += CORNER_NEAR_PENALTY;
      }

      if (isSameSquare(area.crossSquare, square)) {
        score += CORNER_NEAR_CROSS_PENALTY;
      }
    }

    return { x, y, score };
  });

  const maxScore = Math.max(...scoredMoves.map((move) => move.score));
  const bestMoves = scoredMoves
    .filter((move) => move.score === maxScore)
    .map(({ x, y }) => [x, y]);

  return selectRandomMove(bestMoves, random);
}

function selectCpuMove(
  board,
  player,
  cpuType,
  random = Math.random,
  openingBook = null,
) {
  const validMoves = getValidMoves(board, player);

  if (cpuType === WEAK) {
    return selectWeakMove(validMoves, random);
  }

  if (cpuType === NORMAL) {
    return selectNormalMove(board, player, validMoves, random);
  }

  if (cpuType === STRONG) {
    const openingMove = selectOpeningMove(
      board,
      player,
      validMoves,
      openingBook,
      random,
    );
    if (openingMove !== null) return openingMove;

    return selectStrongMove(board, player, validMoves, random);
  }

  throw new Error(`Unknown CPU type: ${cpuType}`);
}

module.exports = {
  WEAK,
  NORMAL,
  STRONG,
  boardToKey,
  selectOpeningMove,
  selectWeakMove,
  selectNormalMove,
  selectStrongMove,
  selectCpuMove,
};
