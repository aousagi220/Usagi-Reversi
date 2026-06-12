const fs = require("node:fs");
const path = require("node:path");
const { STRONG } = require("../Automation/cpuStrategies");
const {
  FEATURE_NAMES,
  PHASE_NAMES,
  DEFAULT_MODEL,
  isNeuralModel,
  createNeuralModel,
  normalizeModel,
} = require("./evaluator");
const {
  createInitialPopulation,
  evaluatePopulation,
  getModelParameters,
  improvePopulationWithLocalSearch,
  createNextGeneration,
} = require("./geneticAlgorithm");
const { loadOpeningBook } = require("./trainingSimulator");
const { DEFAULT_OPPONENT_MIX, simulateMixedMatches } = require("./mixedEvaluation");

const DEFAULT_BEST_MODEL_PATH = path.join(__dirname, "models", "bestModel.json");

function calculateFitness(stats) {
  const hallOfFameBonus = ((stats.hallOfFameElo ?? 1500) - 1500) / 10;
  return stats.modelWinRate * 100 + stats.drawRate * 25 + stats.averageStoneDifference + hallOfFameBonus;
}

function writeBestModel(rankedModel, generation, outputPath = DEFAULT_BEST_MODEL_PATH) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        generation,
        fitness: rankedModel.fitness,
        stats: rankedModel.stats,
        weights: normalizeModel(rankedModel.model),
        savedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

function train({
  populationSize = 8,
  generationCount = 3,
  gamesPerModel = 10,
  searchDepth = 1,
  endgameThreshold = 0,
  opponentMix = DEFAULT_OPPONENT_MIX,
  random = Math.random,
  openingBook = loadOpeningBook(),
  outputPath = DEFAULT_BEST_MODEL_PATH,
  baseModel = DEFAULT_MODEL,
  hallOfFameModels = [baseModel],
  startGeneration = 1,
  previousBest = null,
  localSearchEliteCount = 1,
  localSearchCoordinateCount = 4,
  localSearchStrength = 0.1,
  evaluateModel = null,
  onGenerationComplete = null,
} = {}) {
  if (!Number.isInteger(generationCount) || generationCount <= 0) {
    throw new Error("generationCount must be a positive integer");
  }

  if (!Number.isInteger(searchDepth) || searchDepth <= 0) {
    throw new Error("searchDepth must be a positive integer");
  }

  if (!Number.isInteger(endgameThreshold) || endgameThreshold < 0 || endgameThreshold > 60) {
    throw new Error("endgameThreshold must be an integer between 0 and 60");
  }

  if (!Number.isInteger(startGeneration) || startGeneration <= 0) {
    throw new Error("startGeneration must be a positive integer");
  }
  if (!Number.isInteger(localSearchEliteCount) || localSearchEliteCount < 0 || localSearchEliteCount > populationSize) {
    throw new Error("localSearchEliteCount must be between 0 and populationSize");
  }
  const parameterCount = getModelParameters(baseModel).length;
  if (
    !Number.isInteger(localSearchCoordinateCount) ||
    localSearchCoordinateCount < 0 ||
    localSearchCoordinateCount > parameterCount
  ) {
    throw new Error(`localSearchCoordinateCount must be an integer between 0 and ${parameterCount}`);
  }
  if (!Number.isFinite(localSearchStrength) || localSearchStrength < 0) {
    throw new Error("localSearchStrength must be a non-negative number");
  }

  const evaluator =
    evaluateModel ??
    ((model) => {
      const stats = simulateMixedMatches({
        model,
        hallOfFameModels,
        gameCount: gamesPerModel,
        searchDepth,
        endgameThreshold,
        opponentMix,
        random,
        openingBook,
      });

      return {
        fitness: calculateFitness(stats),
        stats,
      };
    });

  let population = createInitialPopulation({
    populationSize,
    baseModel,
    random,
  });
  let bestOverall = previousBest
    ? {
        ...previousBest,
        model: { ...previousBest.model },
      }
    : null;
  const history = [];

  for (let generationIndex = 0; generationIndex < generationCount; generationIndex++) {
    const generation = startGeneration + generationIndex;
    const evaluatedPopulation = evaluatePopulation(population, evaluator);
    const rankedPopulation = improvePopulationWithLocalSearch(
      evaluatedPopulation,
      evaluator,
      {
        eliteCount: localSearchEliteCount,
        coordinateCount: localSearchCoordinateCount,
        coordinateOffset: generationIndex * localSearchCoordinateCount,
        strength: localSearchStrength,
      },
    );
    const best = rankedPopulation[0];

    if (bestOverall === null || best.fitness > bestOverall.fitness) {
      bestOverall = {
        ...best,
        model: { ...best.model },
      };
      writeBestModel(bestOverall, generation, outputPath);
    }

    const generationResult = {
      generation,
      bestFitness: best.fitness,
      averageFitness:
        rankedPopulation.reduce((sum, individual) => sum + individual.fitness, 0) / rankedPopulation.length,
      bestModel: { ...best.model },
    };
    history.push(generationResult);
    onGenerationComplete?.(generationResult, rankedPopulation);

    if (generationIndex < generationCount - 1) {
      population = createNextGeneration(rankedPopulation, {
        populationSize,
        random,
      });
    }
  }

  return {
    best: bestOverall,
    history,
  };
}

function printGeneration(result) {
  console.log(
    `世代${result.generation}: best=${result.bestFitness.toFixed(2)} average=${result.averageFitness.toFixed(2)}`,
  );
  if (isNeuralModel(result.bestModel)) {
    console.log(`  neural network: hidden=8 parameters=${getModelParameters(result.bestModel).length}`);
    return;
  }
  for (const phaseName of PHASE_NAMES) {
    const weights = FEATURE_NAMES.map(
      (featureName) => `${featureName}=${result.bestModel[phaseName][featureName].toFixed(2)}`,
    ).join(", ");
    console.log(`  ${phaseName}: ${weights}`);
  }
}

function resolveTrainingStart({ shouldResume, storedBest, fileBest, latestGeneration }) {
  const fileBestModel = fileBest
    ? {
        generation: fileBest.generation,
        fitness: fileBest.fitness,
        stats: fileBest.stats,
        model: normalizeModel(fileBest.weights),
      }
    : null;
  const bestKnownModel =
    storedBest && fileBestModel
      ? storedBest.fitness >= fileBestModel.fitness
        ? storedBest
        : fileBestModel
      : (storedBest ?? fileBestModel);

  if (!shouldResume) {
    return {
      baseModel: DEFAULT_MODEL,
      previousBest: bestKnownModel,
      startGeneration: 1,
      source: "new",
    };
  }

  if (storedBest) {
    return {
      baseModel: normalizeModel(storedBest.model),
      previousBest: storedBest,
      startGeneration: latestGeneration + 1,
      source: "database",
    };
  }

  if (fileBest) {
    return {
      baseModel: normalizeModel(fileBest.weights),
      previousBest: fileBestModel,
      startGeneration: fileBest.generation + 1,
      source: "file",
    };
  }

  return {
    baseModel: DEFAULT_MODEL,
    previousBest: null,
    startGeneration: 1,
    source: "new",
  };
}

if (require.main === module) {
  const commandArguments = process.argv.slice(2);
  const positionalArguments = commandArguments.filter((argument) => !argument.startsWith("--"));
  const generationCount = Number(positionalArguments[0] ?? 3);
  const populationSize = Number(positionalArguments[1] ?? 8);
  const gamesPerModel = Number(positionalArguments[2] ?? 10);
  const searchDepthArgument = commandArguments.find((argument) => argument.startsWith("--search-depth="));
  const searchDepth = searchDepthArgument ? Number(searchDepthArgument.slice("--search-depth=".length)) : 1;
  const endgameThresholdArgument = commandArguments.find((argument) => argument.startsWith("--endgame-threshold="));
  const endgameThreshold = endgameThresholdArgument
    ? Number(endgameThresholdArgument.slice("--endgame-threshold=".length))
    : 0;
  const localSearchEliteArgument = commandArguments.find((argument) => argument.startsWith("--local-search-elites="));
  const localSearchEliteCount = localSearchEliteArgument
    ? Number(localSearchEliteArgument.slice("--local-search-elites=".length))
    : 1;
  const localSearchCoordinatesArgument = commandArguments.find(
    (argument) => argument.startsWith("--local-search-coordinates="),
  );
  const localSearchCoordinateCount = localSearchCoordinatesArgument
    ? Number(localSearchCoordinatesArgument.slice("--local-search-coordinates=".length))
    : 4;
  const localSearchStrengthArgument = commandArguments.find(
    (argument) => argument.startsWith("--local-search-strength="),
  );
  const localSearchStrength = localSearchStrengthArgument
    ? Number(localSearchStrengthArgument.slice("--local-search-strength=".length))
    : 0.1;
  const modelTypeArgument = commandArguments.find((argument) => argument.startsWith("--model-type="));
  const modelType = modelTypeArgument
    ? modelTypeArgument.slice("--model-type=".length)
    : "linear";
  if (modelType !== "linear" && modelType !== "nn") {
    throw new Error("model-type must be linear or nn");
  }
  const shouldResume = commandArguments.includes("--resume");

  const {
    DEFAULT_TRAINING_DATABASE_PATH,
    openTrainingDatabase,
    startTrainingRun,
    saveGeneration,
    completeTrainingRun,
    getLatestGenerationNumber,
    getBestStoredModel,
    getHallOfFameModels,
  } = require("./modelStore");

  const database = openTrainingDatabase();
  const storedBest = getBestStoredModel(database);
  const fileBest = fs.existsSync(DEFAULT_BEST_MODEL_PATH)
    ? JSON.parse(fs.readFileSync(DEFAULT_BEST_MODEL_PATH, "utf8"))
    : null;
  const trainingStart = resolveTrainingStart({
    shouldResume,
    storedBest,
    fileBest,
    latestGeneration: getLatestGenerationNumber(database),
  });
  const baseModel = !shouldResume && modelType === "nn"
    ? createNeuralModel()
    : normalizeModel(trainingStart.baseModel);
  const previousBest =
    trainingStart.previousBest &&
    isNeuralModel(trainingStart.previousBest.model) === isNeuralModel(baseModel)
      ? trainingStart.previousBest
      : null;
  const hallOfFameModels = getHallOfFameModels(database, 8).map(({ model }) => model);
  if (hallOfFameModels.length === 0) {
    hallOfFameModels.push(baseModel);
  }

  if (storedBest && (!fileBest || storedBest.fitness > fileBest.fitness)) {
    writeBestModel(storedBest, storedBest.generation, DEFAULT_BEST_MODEL_PATH);
  }
  const runId = startTrainingRun(database, {
    populationSize,
    gamesPerModel,
    opponentCpu: STRONG,
  });

  if (trainingStart.source === "database") {
    console.log(`DBの世代${trainingStart.startGeneration - 1}から再開します`);
  } else if (trainingStart.source === "file") {
    console.log(`bestModel.jsonの世代${trainingStart.startGeneration - 1}から再開します`);
  } else {
    console.log("新規学習を世代1から開始します");
  }
  console.log(`探索深さ: ${searchDepth}`);
  console.log(`終盤完全読み: ${endgameThreshold === 0 ? "無効" : `残り${endgameThreshold}マス以下`}`);
  console.log(`Hall of Fame: ${hallOfFameModels.length}モデル`);
  console.log(`評価モデル: ${isNeuralModel(baseModel) ? "小規模NN" : "線形"}`);
  console.log(
    `局所探索: 上位${localSearchEliteCount}体 / ${localSearchCoordinateCount}座標 / 強度${localSearchStrength}`,
  );

  let result;

  try {
    result = train({
      generationCount,
      populationSize,
      gamesPerModel,
      searchDepth,
      endgameThreshold,
      baseModel,
      startGeneration: trainingStart.startGeneration,
      previousBest,
      hallOfFameModels,
      localSearchEliteCount,
      localSearchCoordinateCount,
      localSearchStrength,
      onGenerationComplete: (generationResult, rankedPopulation) => {
        printGeneration(generationResult);
        saveGeneration(database, {
          runId,
          ...generationResult,
          rankedPopulation,
        });
      },
    });
    completeTrainingRun(database, runId);
  } finally {
    database.close();
  }

  console.log(`最良モデル保存先: ${DEFAULT_BEST_MODEL_PATH}`);
  console.log(`学習履歴DB: ${DEFAULT_TRAINING_DATABASE_PATH}`);
  console.log(`最良適応度: ${result.best.fitness.toFixed(2)}`);
}

module.exports = {
  DEFAULT_BEST_MODEL_PATH,
  calculateFitness,
  writeBestModel,
  train,
  printGeneration,
  resolveTrainingStart,
};
