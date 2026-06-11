const {
  BOARD_SIZE,
  EMPTY,
  BLACK,
  getOpponent,
  getValidMoves,
  countStones,
} = require("../Automation/reversiEngine");

const CORNER_AREAS = [
  {
    corner: [0, 0],
    dangerSquares: [
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  },
  {
    corner: [0, BOARD_SIZE - 1],
    dangerSquares: [
      [0, BOARD_SIZE - 2],
      [1, BOARD_SIZE - 1],
      [1, BOARD_SIZE - 2],
    ],
  },
  {
    corner: [BOARD_SIZE - 1, 0],
    dangerSquares: [
      [BOARD_SIZE - 2, 0],
      [BOARD_SIZE - 1, 1],
      [BOARD_SIZE - 2, 1],
    ],
  },
  {
    corner: [BOARD_SIZE - 1, BOARD_SIZE - 1],
    dangerSquares: [
      [BOARD_SIZE - 2, BOARD_SIZE - 1],
      [BOARD_SIZE - 1, BOARD_SIZE - 2],
      [BOARD_SIZE - 2, BOARD_SIZE - 2],
    ],
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

function countDangerSquares(board, player) {
  let count = 0;

  for (const area of CORNER_AREAS) {
    const [cornerX, cornerY] = area.corner;
    if (board[cornerX][cornerY] !== EMPTY) continue;

    count += countSquares(board, area.dangerSquares, player);
  }

  return count;
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
    dangerSquareDifference:
      countDangerSquares(board, player) -
      countDangerSquares(board, opponent),
  };
}

module.exports = {
  CORNERS,
  CORNER_AREAS,
  EDGE_SQUARES,
  countSquares,
  countDangerSquares,
  extractFeatures,
};
