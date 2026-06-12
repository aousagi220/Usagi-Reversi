const test = require("node:test");
const assert = require("node:assert/strict");

const { BLACK } = require("./reversiEngine");
const { NORMAL, STRONG } = require("./cpuStrategies");
const { simulateGame } = require("./simulate");
const {
  boardToKey,
  openDatabase,
  saveGame,
  getDatabaseCounts,
} = require("./database");

test("盤面を64文字のキーへ変換できる", () => {
  const result = simulateGame({
    blackCpu: STRONG,
    whiteCpu: NORMAL,
    random: () => 0,
  });
  const key = boardToKey(result.moves[0].board);

  assert.equal(key.length, 64);
  assert.match(key, /^[012]+$/);
});

test("試合結果と棋譜をSQLiteへ保存できる", () => {
  const database = openDatabase(":memory:");
  const result = simulateGame({
    blackCpu: STRONG,
    whiteCpu: NORMAL,
    random: () => 0,
  });

  const gameId = saveGame(database, result);
  const counts = getDatabaseCounts(database);
  const savedGame = database
    .prepare("SELECT * FROM games WHERE id = ?")
    .get(gameId);
  const firstMove = database
    .prepare("SELECT * FROM moves WHERE game_id = ? ORDER BY turn LIMIT 1")
    .get(gameId);

  assert.equal(counts.games, 1);
  assert.equal(counts.moves, result.moves.length);
  assert.equal(savedGame.black_cpu, STRONG);
  assert.equal(savedGame.white_cpu, NORMAL);
  assert.equal(savedGame.winner, result.winner);
  assert.equal(firstMove.player, BLACK);
  assert.equal(firstMove.board_key.length, 64);
  assert.equal(firstMove.x, 2);
  assert.equal(firstMove.y, 3);

  database.close();
});

test("複数の試合を同じDBへ追加保存できる", () => {
  const database = openDatabase(":memory:");

  saveGame(database, simulateGame({ random: () => 0 }));
  saveGame(database, simulateGame({ random: () => 0.5 }));

  assert.equal(getDatabaseCounts(database).games, 2);

  database.close();
});
