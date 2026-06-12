const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BOARD_SIZE,
  EMPTY,
  BLACK,
  WHITE,
  createBoard,
  cloneBoard,
} = require("./reversiEngine");
const {
  WEAK,
  NORMAL,
  STRONG,
  boardToKey,
  selectOpeningMove,
  selectWeakMove,
  selectNormalMove,
  selectStrongMove,
  selectCpuMove,
} = require("./cpuStrategies");
const {
  canonicalizeBoard,
  transformCoordinate,
} = require("./boardSymmetry");

test("弱CPUは乱数に対応する合法手を選ぶ", () => {
  const validMoves = [
    [2, 3],
    [3, 2],
    [4, 5],
    [5, 4],
  ];

  assert.deepEqual(selectWeakMove(validMoves, () => 0), [2, 3]);
  assert.deepEqual(selectWeakMove(validMoves, () => 0.99), [5, 4]);
});

test("普通CPUは最も多く反転できる手を選ぶ", () => {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
  board[3][1] = WHITE;
  board[3][2] = WHITE;
  board[3][3] = BLACK;
  board[1][3] = WHITE;
  board[2][3] = BLACK;

  const move = selectNormalMove(
    board,
    BLACK,
    [
      [0, 3],
      [3, 0],
    ],
    () => 0,
  );

  assert.deepEqual(move, [3, 0]);
});

test("強CPUは角を優先する", () => {
  const board = createBoard();
  board[0][1] = WHITE;
  board[0][2] = BLACK;

  const move = selectStrongMove(
    board,
    BLACK,
    [
      [0, 0],
      [2, 3],
    ],
    () => 0,
  );

  assert.deepEqual(move, [0, 0]);
});

test("強CPUは空いている角のXマスを避ける", () => {
  const board = createBoard();

  const move = selectStrongMove(
    board,
    BLACK,
    [
      [1, 1],
      [2, 3],
    ],
    () => 0,
  );

  assert.deepEqual(move, [2, 3]);
});

test("定石に該当する合法手を選ぶ", () => {
  const board = createBoard();
  const openingBook = {
    positions: {
      [`${BLACK}:${boardToKey(board)}`]: [
        { x: 5, y: 4, score: 0.8 },
        { x: 2, y: 3, score: 0.5 },
      ],
    },
  };

  assert.deepEqual(
    selectOpeningMove(
      board,
      BLACK,
      [
        [2, 3],
        [5, 4],
      ],
      openingBook,
      () => 0,
    ),
    [5, 4],
  );
});

test("正規化された定石手を元の盤面座標へ戻す", () => {
  const board = createBoard();
  const canonical = canonicalizeBoard(board);
  const [bookX, bookY] = transformCoordinate([5, 4], canonical.transform);
  const openingBook = {
    positions: {
      [`${BLACK}:${canonical.key}`]: [
        { x: bookX, y: bookY, score: 1 },
      ],
    },
  };

  assert.deepEqual(
    selectOpeningMove(board, BLACK, [[5, 4]], openingBook, () => 0),
    [5, 4],
  );
});

test("定石の手が不正なら使用しない", () => {
  const board = createBoard();
  const openingBook = {
    positions: {
      [`${BLACK}:${boardToKey(board)}`]: [
        { x: 0, y: 0, score: 1 },
      ],
    },
  };

  assert.equal(
    selectOpeningMove(board, BLACK, [[2, 3]], openingBook),
    null,
  );
});

test("CPU戦略は盤面を変更しない", () => {
  const board = createBoard();
  const before = cloneBoard(board);

  selectCpuMove(board, BLACK, STRONG, () => 0);

  assert.deepEqual(board, before);
});

test("合法手がなければnullを返す", () => {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(BLACK));

  assert.equal(selectCpuMove(board, WHITE, WEAK), null);
  assert.equal(selectCpuMove(board, WHITE, NORMAL), null);
  assert.equal(selectCpuMove(board, WHITE, STRONG), null);
});

test("未定義のCPUタイプを指定するとエラーになる", () => {
  const board = createBoard();

  assert.throws(() => selectCpuMove(board, BLACK, 99), /Unknown CPU type/);
});
