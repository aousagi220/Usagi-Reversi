const fs = require("node:fs");
const path = require("node:path");
const {
  DEFAULT_DATABASE_PATH,
  openDatabase,
} = require("./database");
const {
  canonicalizeBoardKey,
  transformCoordinate,
} = require("./boardSymmetry");

const DEFAULT_OUTPUT_PATH = path.join(__dirname, "data", "openingBook.json");
const DEFAULT_BROWSER_OUTPUT_PATH = path.join(__dirname, "..", "JS", "openingBookData.js");
const DEFAULT_MAX_TURN = 16;
const DEFAULT_MIN_SAMPLES = 5;

function collectOpeningBookRows(
  database,
  {
    maxTurn = DEFAULT_MAX_TURN,
    minSamples = DEFAULT_MIN_SAMPLES,
  } = {},
) {
  if (!Number.isInteger(maxTurn) || maxTurn <= 0) {
    throw new Error("maxTurn must be a positive integer");
  }

  if (!Number.isInteger(minSamples) || minSamples <= 0) {
    throw new Error("minSamples must be a positive integer");
  }

  return database
    .prepare(`
      SELECT
        moves.board_key,
        moves.player,
        moves.x,
        moves.y,
        COUNT(*) AS samples,
        SUM(CASE WHEN games.winner = moves.player THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN games.winner IS NULL THEN 1 ELSE 0 END) AS draws
      FROM moves
      JOIN games ON games.id = moves.game_id
      WHERE
        moves.turn <= ?
        AND moves.x IS NOT NULL
        AND moves.y IS NOT NULL
      GROUP BY
        moves.board_key,
        moves.player,
        moves.x,
        moves.y
      ORDER BY
        moves.board_key,
        moves.player,
        samples DESC
    `)
    .all(maxTurn);
}

function rowsToOpeningBook(rows, { minSamples = DEFAULT_MIN_SAMPLES } = {}) {
  const positions = {};
  const aggregatedMoves = new Map();

  for (const row of rows) {
    const canonical = canonicalizeBoardKey(row.board_key);
    const [x, y] = transformCoordinate(
      [Number(row.x), Number(row.y)],
      canonical.transform,
    );
    const positionKey = `${row.player}:${canonical.key}`;
    const moveKey = `${positionKey}:${x}:${y}`;
    const samples = Number(row.samples);
    const wins = Number(row.wins);
    const draws = Number(row.draws);
    const current = aggregatedMoves.get(moveKey) ?? {
      positionKey,
      x,
      y,
      samples: 0,
      wins: 0,
      draws: 0,
    };
    current.samples += samples;
    current.wins += wins;
    current.draws += draws;
    aggregatedMoves.set(moveKey, current);
  }

  for (const move of aggregatedMoves.values()) {
    if (move.samples < minSamples) continue;
    if (!positions[move.positionKey]) positions[move.positionKey] = [];
    positions[move.positionKey].push({
      x: move.x,
      y: move.y,
      samples: move.samples,
      wins: move.wins,
      draws: move.draws,
      score: Number(((move.wins + move.draws * 0.5) / move.samples).toFixed(4)),
    });
  }

  for (const moves of Object.values(positions)) {
    moves.sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      return second.samples - first.samples;
    });
  }

  return positions;
}

function buildOpeningBook(
  database,
  {
    maxTurn = DEFAULT_MAX_TURN,
    minSamples = DEFAULT_MIN_SAMPLES,
  } = {},
) {
  const rows = collectOpeningBookRows(database, { maxTurn, minSamples });
  const positions = rowsToOpeningBook(rows, { minSamples });

  return {
    metadata: {
      maxTurn,
      minSamples,
      positionCount: Object.keys(positions).length,
      generatedAt: new Date().toISOString(),
    },
    positions,
  };
}

function writeOpeningBook(openingBook, outputPath = DEFAULT_OUTPUT_PATH) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(openingBook, null, 2)}\n`);
}

function writeBrowserOpeningBook(
  openingBook,
  outputPath = DEFAULT_BROWSER_OUTPUT_PATH,
) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `const OPENING_BOOK = ${JSON.stringify(openingBook)};\n`,
  );
}

if (require.main === module) {
  const maxTurn = Number(process.argv[2] ?? DEFAULT_MAX_TURN);
  const minSamples = Number(process.argv[3] ?? DEFAULT_MIN_SAMPLES);
  const database = openDatabase(DEFAULT_DATABASE_PATH);
  const openingBook = buildOpeningBook(database, { maxTurn, minSamples });

  writeOpeningBook(openingBook);
  writeBrowserOpeningBook(openingBook);
  database.close();

  console.log(`定石局面数: ${openingBook.metadata.positionCount}`);
  console.log(`対象: ${maxTurn}手目まで / 最低${minSamples}サンプル`);
  console.log(`出力先: ${DEFAULT_OUTPUT_PATH}`);
  console.log(`ブラウザ用: ${DEFAULT_BROWSER_OUTPUT_PATH}`);
}

module.exports = {
  DEFAULT_OUTPUT_PATH,
  DEFAULT_BROWSER_OUTPUT_PATH,
  DEFAULT_MAX_TURN,
  DEFAULT_MIN_SAMPLES,
  collectOpeningBookRows,
  rowsToOpeningBook,
  buildOpeningBook,
  writeOpeningBook,
  writeBrowserOpeningBook,
};
