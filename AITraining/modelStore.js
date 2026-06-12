const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { normalizeModel, validateModel } = require("./evaluator");

const DEFAULT_TRAINING_DATABASE_PATH = path.join(
  __dirname,
  "data",
  "training.db",
);

function openTrainingDatabase(
  databasePath = DEFAULT_TRAINING_DATABASE_PATH,
) {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  createTrainingTables(database);

  return database;
}

function createTrainingTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS training_runs (
      id INTEGER PRIMARY KEY,
      population_size INTEGER NOT NULL,
      games_per_model INTEGER NOT NULL,
      opponent_cpu INTEGER NOT NULL,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS generations (
      id INTEGER PRIMARY KEY,
      run_id INTEGER NOT NULL,
      generation_number INTEGER NOT NULL,
      best_fitness REAL NOT NULL,
      average_fitness REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES training_runs(id) ON DELETE CASCADE,
      UNIQUE (run_id, generation_number)
    );

    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY,
      generation_id INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      fitness REAL NOT NULL,
      weights_json TEXT NOT NULL,
      stats_json TEXT,
      FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE,
      UNIQUE (generation_id, rank)
    );

    CREATE INDEX IF NOT EXISTS idx_models_fitness
      ON models(fitness DESC);
  `);
}

function startTrainingRun(
  database,
  {
    populationSize,
    gamesPerModel,
    opponentCpu,
  },
) {
  const result = database
    .prepare(`
      INSERT INTO training_runs (
        population_size,
        games_per_model,
        opponent_cpu
      ) VALUES (?, ?, ?)
    `)
    .run(populationSize, gamesPerModel, opponentCpu);

  return Number(result.lastInsertRowid);
}

function saveGeneration(
  database,
  {
    runId,
    generation,
    bestFitness,
    averageFitness,
    rankedPopulation,
  },
) {
  const insertGeneration = database.prepare(`
    INSERT INTO generations (
      run_id,
      generation_number,
      best_fitness,
      average_fitness
    ) VALUES (?, ?, ?, ?)
  `);
  const insertModel = database.prepare(`
    INSERT INTO models (
      generation_id,
      rank,
      fitness,
      weights_json,
      stats_json
    ) VALUES (?, ?, ?, ?, ?)
  `);

  database.exec("BEGIN");

  try {
    const generationResult = insertGeneration.run(
      runId,
      generation,
      bestFitness,
      averageFitness,
    );
    const generationId = Number(generationResult.lastInsertRowid);

    rankedPopulation.forEach((individual, index) => {
      validateModel(individual.model);
      const normalizedModel = normalizeModel(individual.model);
      insertModel.run(
        generationId,
        index + 1,
        individual.fitness,
        JSON.stringify(normalizedModel),
        individual.stats ? JSON.stringify(individual.stats) : null,
      );
    });

    database.exec("COMMIT");
    return generationId;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function completeTrainingRun(database, runId) {
  database
    .prepare(`
      UPDATE training_runs
      SET completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .run(runId);
}

function getLatestGenerationNumber(database) {
  const row = database
    .prepare(`
      SELECT MAX(generation_number) AS generation
      FROM generations
    `)
    .get();

  return row.generation === null ? 0 : Number(row.generation);
}

function getBestStoredModel(database) {
  const row = database
    .prepare(`
      SELECT
        generations.generation_number AS generation,
        models.fitness,
        models.weights_json,
        models.stats_json
      FROM models
      JOIN generations ON generations.id = models.generation_id
      ORDER BY models.fitness DESC, generations.generation_number DESC
      LIMIT 1
    `)
    .get();

  if (!row) return null;

  return {
    generation: Number(row.generation),
    fitness: Number(row.fitness),
    model: normalizeModel(JSON.parse(row.weights_json)),
    stats: row.stats_json ? JSON.parse(row.stats_json) : null,
  };
}

function getTrainingCounts(database) {
  const runs = database
    .prepare("SELECT COUNT(*) AS count FROM training_runs")
    .get();
  const generations = database
    .prepare("SELECT COUNT(*) AS count FROM generations")
    .get();
  const models = database
    .prepare("SELECT COUNT(*) AS count FROM models")
    .get();

  return {
    runs: Number(runs.count),
    generations: Number(generations.count),
    models: Number(models.count),
  };
}

module.exports = {
  DEFAULT_TRAINING_DATABASE_PATH,
  openTrainingDatabase,
  createTrainingTables,
  startTrainingRun,
  saveGeneration,
  completeTrainingRun,
  getLatestGenerationNumber,
  getBestStoredModel,
  getTrainingCounts,
};
