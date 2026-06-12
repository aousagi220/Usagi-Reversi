const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BOARD_SIZE,
  EMPTY,
  BLACK,
  WHITE,
  createBoard,
  cloneBoard,
  getValidMoves,
  getOpponent,
} = require("../Automation/reversiEngine");
const { createModel } = require("./evaluator");
const { transformBoardKey } = require("../Automation/boardSymmetry");
const {
  evaluateTerminalBoard,
  negamax,
  scoreMoves,
  selectModelMove,
} = require("./modelCpu");

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

test("初期盤面の合法手をすべて仮置き評価する", () => {
  const board = createBoard();
  const scoredMoves = scoreMoves(board, BLACK);

  assert.equal(scoredMoves.length, 4);
  assert.deepEqual(
    scoredMoves.map(({ x, y }) => [x, y]),
    [
      [2, 3],
      [3, 2],
      [4, 5],
      [5, 4],
    ],
  );
  assert.equal(
    scoredMoves.every(({ score }) => Number.isFinite(score)),
    true,
  );
});

test("角を重視するモデルは角を選ぶ", () => {
  const board = createEmptyBoard();
  board[0][1] = WHITE;
  board[0][2] = BLACK;
  board[3][1] = WHITE;
  board[3][2] = BLACK;
  const model = createModel({
    stoneDifference: 0,
    mobilityDifference: 0,
    cornerDifference: 100,
    edgeDifference: 0,
    frontierDifference: 0,
    cSquareDifference: 0,
    xSquareDifference: 0,
    stableDiscDifference: 0,
  });

  assert.deepEqual(
    selectModelMove(board, BLACK, model, () => 0),
    [0, 0],
  );
});

test("同点時は乱数に応じた手を選ぶ", () => {
  const board = createBoard();
  const model = createModel({
    stoneDifference: 0,
    mobilityDifference: 0,
    cornerDifference: 0,
    edgeDifference: 0,
    frontierDifference: 0,
    cSquareDifference: 0,
    xSquareDifference: 0,
    stableDiscDifference: 0,
  });

  assert.deepEqual(
    selectModelMove(board, BLACK, model, () => 0),
    [2, 3],
  );
  assert.deepEqual(
    selectModelMove(board, BLACK, model, () => 0.99),
    [5, 4],
  );
});

test("手選択時に元の盤面を変更しない", () => {
  const board = createBoard();
  const before = cloneBoard(board);

  selectModelMove(board, BLACK);

  assert.deepEqual(board, before);
});

test("合法手がなければnullを返す", () => {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(BLACK));

  assert.equal(selectModelMove(board, WHITE), null);
});

test("終局ではモデル評価ではなく最終石差を返す", () => {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(BLACK));
  board[0][0] = WHITE;
  board[0][1] = WHITE;

  assert.equal(evaluateTerminalBoard(board, BLACK), 1_000_060);
  assert.equal(evaluateTerminalBoard(board, WHITE), -1_000_060);
});

test("パスは探索深さを消費しない", () => {
  const board = createEmptyBoard();
  board[0][0] = BLACK;
  board[0][1] = WHITE;
  board[0][3] = BLACK;
  const model = createModel({
    stoneDifference: 1,
    mobilityDifference: 0,
    cornerDifference: 0,
    edgeDifference: 0,
    frontierDifference: 0,
    cSquareDifference: 0,
    xSquareDifference: 0,
    stableDiscDifference: 0,
  });

  const passedScore = negamax(board, WHITE, 1, -Infinity, Infinity, model);
  const opponentScore = negamax(board, getOpponent(WHITE), 1, -Infinity, Infinity, model);

  assert.equal(passedScore, -opponentScore);
});

test("探索深さ1では既存の1手読み評価と同じ候補集合になる", () => {
  const board = createBoard();
  const model = createModel({
    stoneDifference: 0,
    mobilityDifference: 0,
    cornerDifference: 0,
    edgeDifference: 0,
    frontierDifference: 0,
    cSquareDifference: 0,
    xSquareDifference: 0,
    stableDiscDifference: 0,
  });

  const scoredMoves = scoreMoves(board, BLACK, model);
  const maxScore = Math.max(...scoredMoves.map(({ score }) => score));
  const expectedBestMoves = scoredMoves.filter(({ score }) => score === maxScore).map(({ x, y }) => [x, y]);
  const selectedMove = selectModelMove(board, BLACK, model, () => 0, { searchDepth: 1 });

  assert.equal(
    expectedBestMoves.some(([x, y]) => x === selectedMove[0] && y === selectedMove[1]),
    true,
  );
});

test("置換表は同一局面の再探索結果を再利用する", () => {
  const board = createBoard();
  const transpositionTable = new Map();
  const searchStats = {};
  const firstScore = negamax(
    board,
    BLACK,
    3,
    -Infinity,
    Infinity,
    createModel(),
    transpositionTable,
    searchStats,
  );
  const nodesAfterFirstSearch = searchStats.nodes;
  const hitsAfterFirstSearch = searchStats.cacheHits ?? 0;
  const secondScore = negamax(
    board,
    BLACK,
    3,
    -Infinity,
    Infinity,
    createModel(),
    transpositionTable,
    searchStats,
  );

  assert.equal(secondScore, firstScore);
  assert.equal(searchStats.nodes, nodesAfterFirstSearch + 1);
  assert.equal(searchStats.cacheHits, hitsAfterFirstSearch + 1);
  assert.ok(transpositionTable.size > 0);
});

test("置換表は回転した同一局面を再利用する", () => {
  const board = createEmptyBoard();
  board[0][0] = BLACK;
  board[0][1] = WHITE;
  board[0][2] = BLACK;
  board[2][0] = WHITE;
  board[3][0] = BLACK;
  const rotatedKey = transformBoardKey(board.flat().join(""), 1);
  const rotatedBoard = Array.from({ length: BOARD_SIZE }, (_, x) =>
    Array.from({ length: BOARD_SIZE }, (_, y) =>
      Number(rotatedKey[x * BOARD_SIZE + y]),
    ),
  );
  const transpositionTable = new Map();
  const searchStats = {};
  const model = createModel();
  const firstScore = negamax(
    board,
    BLACK,
    3,
    -Infinity,
    Infinity,
    model,
    transpositionTable,
    searchStats,
  );
  const hitsBeforeRotation = searchStats.cacheHits ?? 0;
  const rotatedScore = negamax(
    rotatedBoard,
    BLACK,
    3,
    -Infinity,
    Infinity,
    model,
    transpositionTable,
    searchStats,
  );

  assert.equal(rotatedScore, firstScore);
  assert.equal(searchStats.cacheHits, hitsBeforeRotation + 1);
});

test("置換表の有無で選択する手は変わらない", () => {
  const board = createBoard();
  const options = { searchDepth: 4 };

  assert.deepEqual(
    selectModelMove(board, BLACK, undefined, () => 0, {
      ...options,
      useTranspositionTable: true,
    }),
    selectModelMove(board, BLACK, undefined, () => 0, {
      ...options,
      useTranspositionTable: false,
    }),
  );
});

test("反復深化は指定深さまで探索する", () => {
  const searchStats = {};

  selectModelMove(createBoard(), BLACK, undefined, () => 0, {
    searchDepth: 4,
    useIterativeDeepening: true,
    searchStats,
  });

  assert.equal(searchStats.completedDepth, 4);
  assert.equal(searchStats.iterations, 4);
  assert.ok(searchStats.cutoffs > 0);
});

test("反復深化と探索ヒューリスティックの有無で最善手は変わらない", () => {
  const board = createBoard();
  const options = { searchDepth: 5 };

  assert.deepEqual(
    selectModelMove(board, BLACK, undefined, () => 0, {
      ...options,
      useIterativeDeepening: true,
    }),
    selectModelMove(board, BLACK, undefined, () => 0, {
      ...options,
      useIterativeDeepening: false,
      useSearchHeuristics: false,
    }),
  );
});

test("時間制限探索は完了済みの深さから合法手を返す", () => {
  const board = createBoard();
  const searchStats = {};
  const move = selectModelMove(board, BLACK, undefined, () => 0, {
    searchDepth: 20,
    timeLimitMs: 5,
    searchStats,
  });

  assert.equal(
    getValidMoves(board, BLACK).some(([x, y]) => x === move[0] && y === move[1]),
    true,
  );
  assert.equal(searchStats.timedOut, true);
  assert.ok((searchStats.completedDepth ?? 0) < 20);
});

test("終盤閾値以下では終局まで完全読みする", () => {
  const board = [
    [WHITE, EMPTY, EMPTY, WHITE, WHITE, WHITE, WHITE, WHITE],
    [BLACK, BLACK, WHITE, WHITE, WHITE, BLACK, WHITE, WHITE],
    [BLACK, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE],
    [BLACK, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE],
    [BLACK, BLACK, WHITE, WHITE, WHITE, WHITE, BLACK, WHITE],
    [BLACK, WHITE, WHITE, WHITE, WHITE, BLACK, EMPTY, WHITE],
    [BLACK, BLACK, WHITE, WHITE, WHITE, WHITE, WHITE, EMPTY],
    [BLACK, WHITE, EMPTY, BLACK, EMPTY, WHITE, EMPTY, EMPTY],
  ];
  const model = createModel({
    stoneDifference: 0,
    mobilityDifference: 0,
    cornerDifference: 0,
    edgeDifference: 0,
    frontierDifference: 0,
    cSquareDifference: 0,
    xSquareDifference: 0,
    stableDiscDifference: 0,
  });

  assert.deepEqual(
    selectModelMove(board, BLACK, model, () => 0, {
      searchDepth: 1,
      endgameThreshold: 0,
    }),
    [0, 2],
  );
  assert.deepEqual(
    selectModelMove(board, BLACK, model, () => 0, {
      searchDepth: 1,
      endgameThreshold: 8,
    }),
    [7, 2],
  );
});

test("終盤完全読みは反復を省略して終局深さを探索する", () => {
  const board = [
    [WHITE, EMPTY, EMPTY, WHITE, WHITE, WHITE, WHITE, WHITE],
    [BLACK, BLACK, WHITE, WHITE, WHITE, BLACK, WHITE, WHITE],
    [BLACK, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE],
    [BLACK, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE],
    [BLACK, BLACK, WHITE, WHITE, WHITE, WHITE, BLACK, WHITE],
    [BLACK, WHITE, WHITE, WHITE, WHITE, BLACK, EMPTY, WHITE],
    [BLACK, BLACK, WHITE, WHITE, WHITE, WHITE, WHITE, EMPTY],
    [BLACK, WHITE, EMPTY, BLACK, EMPTY, WHITE, EMPTY, EMPTY],
  ];
  const searchStats = {};

  selectModelMove(board, BLACK, undefined, () => 0, {
    searchDepth: 1,
    endgameThreshold: 8,
    searchStats,
  });

  assert.equal(searchStats.completedDepth, 8);
  assert.equal(searchStats.iterations, 1);
});

test("探索深さは1以上の整数のみ許可する", () => {
  const board = createBoard();

  assert.throws(
    () => selectModelMove(board, BLACK, undefined, undefined, { searchDepth: 0 }),
    /searchDepth must be an integer of at least 1/,
  );
  assert.throws(
    () => selectModelMove(board, BLACK, undefined, undefined, { searchDepth: 1.5 }),
    /searchDepth must be an integer of at least 1/,
  );
});

test("終盤完全読みの閾値は0から60の整数のみ許可する", () => {
  const board = createBoard();

  assert.throws(
    () => selectModelMove(board, BLACK, undefined, undefined, { endgameThreshold: -1 }),
    /endgameThreshold must be an integer between 0 and 60/,
  );
  assert.throws(
    () => selectModelMove(board, BLACK, undefined, undefined, { endgameThreshold: 61 }),
    /endgameThreshold must be an integer between 0 and 60/,
  );
});

test("時間制限には正の数だけ指定できる", () => {
  const board = createBoard();

  assert.throws(
    () => selectModelMove(board, BLACK, undefined, undefined, { timeLimitMs: 0 }),
    /timeLimitMs must be a positive number or null/,
  );
  assert.throws(
    () => selectModelMove(board, BLACK, undefined, undefined, { timeLimitMs: Infinity }),
    /timeLimitMs must be a positive number or null/,
  );
});
