const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  BLACK,
  WHITE,
  createBoard,
} = require("./reversiEngine");
const { NORMAL, STRONG } = require("./cpuStrategies");
const {
  openDatabase,
  saveGame,
  boardToKey,
} = require("./database");
const {
  buildOpeningBook,
  writeOpeningBook,
} = require("./buildOpeningBook");

function createResult(winner) {
  return {
    blackCpu: STRONG,
    whiteCpu: NORMAL,
    winner,
    score: {
      black: winner === BLACK ? 40 : 32,
      white: winner === WHITE ? 40 : 32,
      empty: winner === null ? 0 : 24,
    },
    passCount: 0,
    moves: [
      {
        turn: 1,
        player: BLACK,
        board: createBoard(),
        move: [2, 3],
      },
    ],
  };
}

test("局面ごとの候補手と成績を生成できる", () => {
  const database = openDatabase(":memory:");

  saveGame(database, createResult(BLACK));
  saveGame(database, createResult(null));

  const openingBook = buildOpeningBook(database, {
    maxTurn: 10,
    minSamples: 2,
  });
  const positionKey = `${BLACK}:${boardToKey(createBoard())}`;
  const move = openingBook.positions[positionKey][0];

  assert.equal(openingBook.metadata.positionCount, 1);
  assert.deepEqual(
    {
      x: move.x,
      y: move.y,
      samples: move.samples,
      wins: move.wins,
      draws: move.draws,
      score: move.score,
    },
    {
      x: 2,
      y: 3,
      samples: 2,
      wins: 1,
      draws: 1,
      score: 0.75,
    },
  );

  database.close();
});

test("最低サンプル数に満たない候補手を除外する", () => {
  const database = openDatabase(":memory:");

  saveGame(database, createResult(BLACK));

  const openingBook = buildOpeningBook(database, {
    minSamples: 2,
  });

  assert.equal(openingBook.metadata.positionCount, 0);
  database.close();
});

test("定石JSONをファイルへ出力できる", () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "reversi-book-"));
  const outputPath = path.join(outputDirectory, "openingBook.json");
  const openingBook = {
    metadata: {
      positionCount: 0,
    },
    positions: {},
  };

  writeOpeningBook(openingBook, outputPath);

  assert.deepEqual(
    JSON.parse(fs.readFileSync(outputPath, "utf8")),
    openingBook,
  );
});

test("手数とサンプル数には正の整数だけ指定できる", () => {
  const database = openDatabase(":memory:");

  assert.throws(
    () => buildOpeningBook(database, { maxTurn: 0 }),
    /positive integer/,
  );
  assert.throws(
    () => buildOpeningBook(database, { minSamples: 1.5 }),
    /positive integer/,
  );

  database.close();
});
