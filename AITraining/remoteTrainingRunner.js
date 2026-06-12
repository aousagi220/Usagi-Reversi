const fs = require("node:fs");
const path = require("node:path");

const { DEFAULT_MODEL, normalizeModel, validateModel } = require("./evaluator");
const { DEFAULT_OPPONENT_MIX } = require("./mixedEvaluation");
const { train } = require("./trainer");

const REMOTE_TRAINING_PROTOCOL_VERSION = 1;

function validatePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function normalizeRemoteJob(job) {
  if (job === null || typeof job !== "object" || Array.isArray(job)) {
    throw new TypeError("job must be an object");
  }
  if (typeof job.jobId !== "string" || job.jobId.length === 0) {
    throw new Error("jobId must be a non-empty string");
  }

  const config = job.config ?? {};
  const normalizedJob = {
    protocolVersion: REMOTE_TRAINING_PROTOCOL_VERSION,
    jobId: job.jobId,
    config: {
      populationSize: config.populationSize ?? 16,
      generationCount: config.generationCount ?? 20,
      gamesPerModel: config.gamesPerModel ?? 40,
      searchDepth: config.searchDepth ?? 2,
      endgameThreshold: config.endgameThreshold ?? 8,
      opponentMix: config.opponentMix ?? DEFAULT_OPPONENT_MIX,
      baseModel: normalizeModel(config.baseModel ?? DEFAULT_MODEL),
      pastModel: normalizeModel(config.pastModel ?? config.baseModel ?? DEFAULT_MODEL),
      startGeneration: config.startGeneration ?? 1,
      previousBest: config.previousBest
        ? {
            ...config.previousBest,
            model: normalizeModel(config.previousBest.model),
          }
        : null,
    },
  };

  validatePositiveInteger(normalizedJob.config.populationSize, "populationSize");
  validatePositiveInteger(normalizedJob.config.generationCount, "generationCount");
  validatePositiveInteger(normalizedJob.config.gamesPerModel, "gamesPerModel");
  validatePositiveInteger(normalizedJob.config.searchDepth, "searchDepth");
  validatePositiveInteger(normalizedJob.config.startGeneration, "startGeneration");
  validateModel(normalizedJob.config.baseModel);
  validateModel(normalizedJob.config.pastModel);

  if (
    !Number.isInteger(normalizedJob.config.endgameThreshold) ||
    normalizedJob.config.endgameThreshold < 0 ||
    normalizedJob.config.endgameThreshold > 60
  ) {
    throw new Error("endgameThreshold must be an integer between 0 and 60");
  }

  return normalizedJob;
}

function runRemoteTraining(job, { outputPath } = {}) {
  const normalizedJob = normalizeRemoteJob(job);
  const generations = [];
  const bestModelPath = outputPath ?? path.join(__dirname, "models", "remoteBestModel.json");
  let bestFitness = normalizedJob.config.previousBest?.fitness ?? -Infinity;
  let bestGeneration = normalizedJob.config.previousBest?.generation ?? null;

  const result = train({
    ...normalizedJob.config,
    outputPath: bestModelPath,
    onGenerationComplete: (generationResult, rankedPopulation) => {
      if (generationResult.bestFitness > bestFitness) {
        bestFitness = generationResult.bestFitness;
        bestGeneration = generationResult.generation;
      }
      generations.push({
        ...generationResult,
        rankedPopulation: rankedPopulation.map((individual) => ({
          ...individual,
          model: normalizeModel(individual.model),
        })),
      });
      console.log(
        `世代${generationResult.generation}: best=${generationResult.bestFitness.toFixed(2)} ` +
        `average=${generationResult.averageFitness.toFixed(2)}`,
      );
    },
  });

  return {
    protocolVersion: REMOTE_TRAINING_PROTOCOL_VERSION,
    jobId: normalizedJob.jobId,
    completedAt: new Date().toISOString(),
    result: {
      bestGeneration,
      best: {
        ...result.best,
        model: normalizeModel(result.best.model),
      },
      history: result.history,
    },
    generations,
  };
}

if (require.main === module) {
  const [jobPath, resultPath] = process.argv.slice(2);
  if (!jobPath || !resultPath) {
    throw new Error("Usage: node AITraining/remoteTrainingRunner.js JOB_JSON RESULT_JSON");
  }

  const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
  const payload = runRemoteTraining(job, {
    outputPath: path.join(path.dirname(resultPath), "bestModel.json"),
  });
  fs.writeFileSync(resultPath, `${JSON.stringify(payload)}\n`);
  console.log(`リモート学習結果: ${resultPath}`);
}

module.exports = {
  REMOTE_TRAINING_PROTOCOL_VERSION,
  normalizeRemoteJob,
  runRemoteTraining,
};
