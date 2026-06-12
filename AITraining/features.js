const {
  BOARD_SIZE,
  EMPTY,
  BLACK,
  getOpponent,
  getValidMoves,
  countStones,
} = require("../Automation/reversiEngine");

const DIRECTIONS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const CORNER_AREAS = [
  {
    corner: [0, 0],
    cSquares: [[0, 1], [1, 0]],
    xSquare: [1, 1],
  },
  {
    corner: [0, BOARD_SIZE - 1],
    cSquares: [[0, BOARD_SIZE - 2], [1, BOARD_SIZE - 1]],
    xSquare: [1, BOARD_SIZE - 2],
  },
  {
    corner: [BOARD_SIZE - 1, 0],
    cSquares: [[BOARD_SIZE - 2, 0], [BOARD_SIZE - 1, 1]],
    xSquare: [BOARD_SIZE - 2, 1],
  },
  {
    corner: [BOARD_SIZE - 1, BOARD_SIZE - 1],
    cSquares: [[BOARD_SIZE - 2, BOARD_SIZE - 1], [BOARD_SIZE - 1, BOARD_SIZE - 2]],
    xSquare: [BOARD_SIZE - 2, BOARD_SIZE - 2],
  },
];

const CORNERS = CORNER_AREAS.map(({ corner }) => corner);

function countSquares(board, squares, player) {
  return squares.reduce(
    (count, [x, y]) => count + Number(board[x][y] === player),
    0,
  );
}

function getEdgeSquares() {
  const edgeSquares = [];

  for (let index = 1; index < BOARD_SIZE - 1; index++) {
    edgeSquares.push(
      [0, index],
      [BOARD_SIZE - 1, index],
      [index, 0],
      [index, BOARD_SIZE - 1],
    );
  }

  return edgeSquares;
}

const EDGE_SQUARES = getEdgeSquares();

function countCornerAdjacentSquares(board, player, squareType) {
  let count = 0;

  for (const area of CORNER_AREAS) {
    const [cornerX, cornerY] = area.corner;
    if (board[cornerX][cornerY] !== EMPTY) continue;

    const squares = squareType === "c" ? area.cSquares : [area.xSquare];
    count += countSquares(board, squares, player);
  }

  return count;
}

function countFrontierDiscs(board, player) {
  let count = 0;

  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (board[x][y] !== player) continue;

      const isFrontier = DIRECTIONS.some(([dx, dy]) => {
        const nextX = x + dx;
        const nextY = y + dy;
        return (
          nextX >= 0 &&
          nextX < BOARD_SIZE &&
          nextY >= 0 &&
          nextY < BOARD_SIZE &&
          board[nextX][nextY] === EMPTY
        );
      });

      if (isFrontier) count++;
    }
  }

  return count;
}

function addStableEdge(board, stableSquares, player, startX, startY, dx, dy) {
  let x = startX;
  let y = startY;

  while (
    x >= 0 &&
    x < BOARD_SIZE &&
    y >= 0 &&
    y < BOARD_SIZE &&
    board[x][y] === player
  ) {
    stableSquares.add(`${x},${y}`);
    x += dx;
    y += dy;
  }
}

function countStableDiscs(board, player) {
  const stableSquares = new Set();
  const cornerDirections = [
    [0, 0, [[0, 1], [1, 0]]],
    [0, BOARD_SIZE - 1, [[0, -1], [1, 0]]],
    [BOARD_SIZE - 1, 0, [[0, 1], [-1, 0]]],
    [BOARD_SIZE - 1, BOARD_SIZE - 1, [[0, -1], [-1, 0]]],
  ];

  for (const [cornerX, cornerY, directions] of cornerDirections) {
    if (board[cornerX][cornerY] !== player) continue;

    for (const [dx, dy] of directions) {
      addStableEdge(board, stableSquares, player, cornerX, cornerY, dx, dy);
    }
  }

  return stableSquares.size;
}

function extractFeatures(board, player) {
  const opponent = getOpponent(player);
  const stoneCount = countStones(board);
  const playerStoneCount = player === BLACK ? stoneCount.black : stoneCount.white;
  const opponentStoneCount = opponent === BLACK ? stoneCount.black : stoneCount.white;

  return {
    stoneDifference: playerStoneCount - opponentStoneCount,
    mobilityDifference:
      getValidMoves(board, player).length -
      getValidMoves(board, opponent).length,
    cornerDifference:
      countSquares(board, CORNERS, player) -
      countSquares(board, CORNERS, opponent),
    edgeDifference:
      countSquares(board, EDGE_SQUARES, player) -
      countSquares(board, EDGE_SQUARES, opponent),
    frontierDifference:
      countFrontierDiscs(board, player) -
      countFrontierDiscs(board, opponent),
    cSquareDifference:
      countCornerAdjacentSquares(board, player, "c") -
      countCornerAdjacentSquares(board, opponent, "c"),
    xSquareDifference:
      countCornerAdjacentSquares(board, player, "x") -
      countCornerAdjacentSquares(board, opponent, "x"),
    stableDiscDifference:
      countStableDiscs(board, player) -
      countStableDiscs(board, opponent),
  };
}

module.exports = {
  CORNERS,
  CORNER_AREAS,
  EDGE_SQUARES,
  countSquares,
  countCornerAdjacentSquares,
  countFrontierDiscs,
  countStableDiscs,
  extractFeatures,
};
