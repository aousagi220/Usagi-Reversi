const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DEFAULT_DATABASE_PATH = path.join(__dirname, "data", "reversi.db");

function boardToKey(board) {
  return board.flat().join("");
}

function openDatabase(databasePath = DEFAULT_DATABASE_PATH) {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  createTables(database);

  return database;
}

function createTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY,
      black_cpu INTEGER NOT NULL,
      white_cpu INTEGER NOT NULL,
      winner INTEGER,
      black_score INTEGER NOT NULL,
      white_score INTEGER NOT NULL,
      empty_count INTEGER NOT NULL,
      pass_count INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS moves (
      id INTEGER PRIMARY KEY,
      game_id INTEGER NOT NULL,
      turn INTEGER NOT NULL,
      player INTEGER NOT NULL,
      board_key TEXT NOT NULL,
      x INTEGER,
      y INTEGER,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_moves_board_key
      ON moves(board_key);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_moves_game_turn
      ON moves(game_id, turn);
  `);
}

function saveGame(database, result) {
  const insertGame = database.prepare(`
    INSERT INTO games (
      black_cpu,
      white_cpu,
      winner,
      black_score,
      white_score,
      empty_count,
      pass_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMove = database.prepare(`
    INSERT INTO moves (
      game_id,
      turn,
      player,
      board_key,
      x,
      y
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  database.exec("BEGIN");

  try {
    const game = insertGame.run(
      result.blackCpu,
      result.whiteCpu,
      result.winner,
      result.score.black,
      result.score.white,
      result.score.empty,
      result.passCount,
    );
    const gameId = Number(game.lastInsertRowid);

    for (const move of result.moves) {
      const [x, y] = move.move ?? [null, null];
      insertMove.run(
        gameId,
        move.turn,
        move.player,
        boardToKey(move.board),
        x,
        y,
      );
    }

    database.exec("COMMIT");
    return gameId;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function getDatabaseCounts(database) {
  const gameCount = database.prepare("SELECT COUNT(*) AS count FROM games").get();
  const moveCount = database.prepare("SELECT COUNT(*) AS count FROM moves").get();

  return {
    games: Number(gameCount.count),
    moves: Number(moveCount.count),
  };
}

module.exports = {
  DEFAULT_DATABASE_PATH,
  boardToKey,
  openDatabase,
  createTables,
  saveGame,
  getDatabaseCounts,
};
