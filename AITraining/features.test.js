const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BOARD_SIZE,
  EMPTY,
  BLACK,
  WHITE,
  createBoard,
  placeStone,
} = require("../Automation/reversiEngine");
const {
  EDGE_SQUARES,
  countDangerSquares,
  extractFeatures,
} = require("./features");

function createEmptyBoard() {
  return Array.from(
    { length: BOARD_SIZE },
    () => Array(BOARD_SIZE).fill(EMPTY),
  );
}

test("初期盤面の特徴量は両者とも同じになる", () => {
  const board = createBoard();

  assert.deepEqual(extractFeatures(board, BLACK), {
    stoneDifference: 0,
    mobilityDifference: 0,
    cornerDifference: 0,
    edgeDifference: 0,
    dangerSquareDifference: 0,
  });
});

test("特徴量は相手視点で符号が反転する", () => {
  const board = createBoard();
  placeStone(board, 2, 3, BLACK);

  const blackFeatures = extractFeatures(board, BLACK);
  const whiteFeatures = extractFeatures(board, WHITE);

  for (const featureName of Object.keys(blackFeatures)) {
    assert.equal(blackFeatures[featureName] + whiteFeatures[featureName], 0);
  }
});

test("角と辺を別々に数える", () => {
  const board = createEmptyBoard();
  board[0][0] = BLACK;
  board[0][2] = BLACK;
  board[7][4] = WHITE;

  const features = extractFeatures(board, BLACK);

  assert.equal(features.cornerDifference, 1);
  assert.equal(features.edgeDifference, 0);
  assert.equal(EDGE_SQUARES.some(([x, y]) => x === 0 && y === 0), false);
});

test("空いている角の周辺だけを危険マスとして数える", () => {
  const board = createEmptyBoard();
  board[1][1] = BLACK;
  board[0][6] = WHITE;

  assert.equal(countDangerSquares(board, BLACK), 1);
  assert.equal(countDangerSquares(board, WHITE), 1);

  board[0][0] = WHITE;

  assert.equal(countDangerSquares(board, BLACK), 0);
  assert.equal(countDangerSquares(board, WHITE), 1);
});

test("合法手数の差を取得できる", () => {
  const board = createBoard();
  placeStone(board, 2, 3, BLACK);

  const features = extractFeatures(board, WHITE);

  assert.equal(features.mobilityDifference, 0);
});
