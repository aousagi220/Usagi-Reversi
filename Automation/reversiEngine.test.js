const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BOARD_SIZE,
  EMPTY,
  BLACK,
  WHITE,
  createBoard,
  cloneBoard,
  getFlippableStones,
  getValidMoves,
  placeStone,
  hasValidMove,
  isGameEnd,
  countStones,
} = require("./reversiEngine");

test("初期盤面を作成できる", () => {
  const board = createBoard();

  assert.equal(board.length, BOARD_SIZE);
  assert.equal(board[3][3], WHITE);
  assert.equal(board[3][4], BLACK);
  assert.equal(board[4][3], BLACK);
  assert.equal(board[4][4], WHITE);
  assert.deepEqual(countStones(board), { black: 2, white: 2, empty: 60 });
});

test("作成した盤面同士は独立している", () => {
  const firstBoard = createBoard();
  const secondBoard = createBoard();

  firstBoard[0][0] = BLACK;

  assert.equal(secondBoard[0][0], EMPTY);
});

test("初期盤面の黒の合法手を取得できる", () => {
  const board = createBoard();

  assert.deepEqual(getValidMoves(board, BLACK), [
    [2, 3],
    [3, 2],
    [4, 5],
    [5, 4],
  ]);
});

test("8方向の反転対象をまとめて取得できる", () => {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
  const center = 3;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;

      board[center + dx][center + dy] = WHITE;
      board[center + dx * 2][center + dy * 2] = BLACK;
    }
  }

  assert.equal(getFlippableStones(board, center, center, BLACK).length, 8);
});

test("合法手に石を置いて反転できる", () => {
  const board = createBoard();

  assert.equal(placeStone(board, 2, 3, BLACK), true);
  assert.equal(board[2][3], BLACK);
  assert.equal(board[3][3], BLACK);
  assert.deepEqual(countStones(board), { black: 4, white: 1, empty: 59 });
});

test("合法手ではない場所に置いても盤面を変更しない", () => {
  const board = createBoard();
  const before = cloneBoard(board);

  assert.equal(placeStone(board, 0, 0, BLACK), false);
  assert.deepEqual(board, before);
});

test("合法手の有無を判定できる", () => {
  const board = createBoard();

  assert.equal(hasValidMove(board, BLACK), true);
  assert.equal(hasValidMove(board, WHITE), true);
});

test("両者に合法手がなければゲーム終了になる", () => {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(BLACK));

  assert.equal(isGameEnd(board), true);
});

test("片方に合法手があればゲームは続く", () => {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(BLACK));
  board[0][0] = EMPTY;
  board[0][1] = WHITE;

  assert.equal(isGameEnd(board), false);
});
