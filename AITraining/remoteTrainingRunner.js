const fs = require("node:fs");
const path = require("node:path");

const {
  DEFAULT_MODEL,
  createNeuralModel,
  normalizeModel,
  validateModel,
} = require("./evaluator");
const { getModelParameters } = require("./geneticAlgorithm");
const { DEFAULT_OPPONENT_MIX } = require("./mixedEvaluation");
const { train, trainParallel } = require("./trainer");
const { validateWorkerCount } = require("./trainingWorkerPool");

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
  const configuredBaseModel = config.modelType === "nn" && !config.baseModel
    ? createNeuralModel()
    : config.baseModel ?? DEFAULT_MODEL;
  const normalizedJob = {
    protocolVersion: REMOTE_TRAINING_PROTOCOL_VERSION,
    jobId: job.jobId,
    config: {
      populationSize: config.populationSize ?? 16,
      generationCount: config.generationCount ?? 20,
      gamesPerModel: config.gamesPerModel ?? 40,
      searchDepth: config.searchDepth ?? 2,
      endgameThreshold: config.endgameThreshold ?? 8,
      localSearchEliteCount: config.localSearchEliteCount ?? 1,
      localSearchCoordinateCount: config.localSearchCoordinateCount ?? 4,
      localSearchStrength: config.localSearchStrength ?? 0.1,
      workerCount: config.workerCount ?? 1,
      opponentMix: config.opponentMix ?? DEFAULT_OPPONENT_MIX,
      baseModel: normalizeModel(configuredBaseModel),
      hallOfFameModels: (config.hallOfFameModels ?? [configuredBaseModel])
        .map((model) => normalizeModel(model)),
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
  validateWorkerCount(normalizedJob.config.workerCount);
  const parameterCount = getModelParameters(normalizedJob.config.baseModel).length;
  if (
    !Number.isInteger(normalizedJob.config.localSearchEliteCount) ||
    normalizedJob.config.localSearchEliteCount < 0 ||
    normalizedJob.config.localSearchEliteCount > normalizedJob.config.populationSize
  ) {
    throw new Error("localSearchEliteCount must be between 0 and populationSize");
  }
  if (
    !Number.isInteger(normalizedJob.config.localSearchCoordinateCount) ||
    normalizedJob.config.localSearchCoordinateCount < 0 ||
    normalizedJob.config.localSearchCoordinateCount > parameterCount
  ) {
    throw new Error(
      `localSearchCoordinateCount must be an integer between 0 and ${parameterCount}`,
    );
  }
  if (!Number.isFinite(normalizedJob.config.localSearchStrength) || normalizedJob.config.localSearchStrength < 0) {
    throw new Error("localSearchStrength must be a non-negative number");
  }
  validateModel(normalizedJob.config.baseModel);
  for (const model of normalizedJob.config.hallOfFameModels) {
    validateModel(model);
  }

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

async function runRemoteTrainingParallel(job, { outputPath } = {}) {
  const normalizedJob = normalizeRemoteJob(job);
  const generations = [];
  const bestModelPath = outputPath ?? path.join(__dirname, "models", "remoteBestModel.json");
  let bestFitness = normalizedJob.config.previousBest?.fitness ?? -Infinity;
  let bestGeneration = normalizedJob.config.previousBest?.generation ?? null;

  const result = await trainParallel({
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
  (async () => {
    const [jobPath, resultPath] = process.argv.slice(2);
    if (!jobPath || !resultPath) {
      throw new Error("Usage: node AITraining/remoteTrainingRunner.js JOB_JSON RESULT_JSON");
    }

    const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
    const normalizedJob = normalizeRemoteJob(job);
    const options = {
      outputPath: path.join(path.dirname(resultPath), "bestModel.json"),
    };
    const payload = normalizedJob.config.workerCount > 1
      ? await runRemoteTrainingParallel(normalizedJob, options)
      : runRemoteTraining(normalizedJob, options);
    fs.writeFileSync(resultPath, `${JSON.stringify(payload)}\n`);
    console.log(`リモート学習結果: ${resultPath}`);
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  REMOTE_TRAINING_PROTOCOL_VERSION,
  normalizeRemoteJob,
  runRemoteTraining,
  runRemoteTrainingParallel,
};
