const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const { STRONG } = require("../Automation/cpuStrategies");
const {
  isNeuralModel,
  createNeuralModel,
  normalizeModel,
  validateModel,
} = require("./evaluator");
const {
  DEFAULT_BEST_MODEL_PATH,
  resolveTrainingStart,
  writeBestModel,
} = require("./trainer");
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
const {
  REMOTE_TRAINING_PROTOCOL_VERSION,
  normalizeRemoteJob,
} = require("./remoteTrainingRunner");

const DEFAULT_REMOTE_TRAINING_PORT = 8787;
const MAX_RESULT_BYTES = 50 * 1024 * 1024;
const PROJECT_ROOT = path.join(__dirname, "..");

function getSourceFiles(rootDirectory = PROJECT_ROOT) {
  const sourceFiles = [];
  const includedRoots = ["AITraining", "Automation"];

  function visit(relativeDirectory) {
    const absoluteDirectory = path.join(rootDirectory, relativeDirectory);

    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        if (relativePath === "AITraining/data" || relativePath === "AITraining/models") continue;
        visit(relativePath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (entry.name.endsWith(".test.js") || entry.name.endsWith(".db")) continue;
      if (!entry.name.endsWith(".js") && !entry.name.endsWith(".json")) continue;
      sourceFiles.push(relativePath);
    }
  }

  for (const includedRoot of includedRoots) {
    visit(includedRoot);
  }

  return sourceFiles.sort();
}

function createSourceManifest(rootDirectory = PROJECT_ROOT) {
  return getSourceFiles(rootDirectory).map((relativePath) => {
    const content = fs.readFileSync(path.join(rootDirectory, relativePath));
    return {
      path: relativePath,
      size: content.length,
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
    };
  });
}

function resolveSourcePath(relativePath, manifestPaths, rootDirectory = PROJECT_ROOT) {
  if (!manifestPaths.has(relativePath)) {
    throw new Error("Unknown source path");
  }

  const absolutePath = path.resolve(rootDirectory, relativePath);
  const rootPrefix = `${path.resolve(rootDirectory)}${path.sep}`;
  if (!absolutePath.startsWith(rootPrefix)) {
    throw new Error("Invalid source path");
  }
  return absolutePath;
}

function isAuthorized(request, token) {
  const authorization = request.headers.authorization ?? "";
  const expected = `Bearer ${token}`;
  const actualBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
}

function readJsonBody(request, maxBytes = MAX_RESULT_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body is too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function createRemoteJob({
  generationCount,
  populationSize,
  gamesPerModel,
  searchDepth,
  endgameThreshold,
  localSearchEliteCount,
  localSearchCoordinateCount,
  localSearchStrength,
  workerCount,
  modelType = "linear",
  shouldResume,
  database,
  bestModelPath = DEFAULT_BEST_MODEL_PATH,
}) {
  if (modelType !== "linear" && modelType !== "nn") {
    throw new Error("modelType must be linear or nn");
  }
  const storedBest = getBestStoredModel(database);
  const fileBest = fs.existsSync(bestModelPath)
    ? JSON.parse(fs.readFileSync(bestModelPath, "utf8"))
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
  const hallOfFameModels = getHallOfFameModels(database, 8).map(({ model }) => model);
  if (hallOfFameModels.length === 0) {
    hallOfFameModels.push(baseModel);
  }

  return normalizeRemoteJob({
    protocolVersion: REMOTE_TRAINING_PROTOCOL_VERSION,
    jobId: crypto.randomUUID(),
    config: {
      generationCount,
      populationSize,
      gamesPerModel,
      searchDepth,
      endgameThreshold,
      localSearchEliteCount,
      localSearchCoordinateCount,
      localSearchStrength,
      workerCount,
      modelType,
      baseModel,
      hallOfFameModels,
      startGeneration: trainingStart.startGeneration,
      previousBest:
        trainingStart.previousBest &&
        isNeuralModel(trainingStart.previousBest.model) === isNeuralModel(baseModel)
        ? {
            ...trainingStart.previousBest,
            model: normalizeModel(trainingStart.previousBest.model),
          }
        : null,
    },
  });
}

function importRemoteResult({
  payload,
  job,
  database,
  bestModelPath = DEFAULT_BEST_MODEL_PATH,
}) {
  if (payload?.protocolVersion !== REMOTE_TRAINING_PROTOCOL_VERSION) {
    throw new Error("Unsupported remote training protocol");
  }
  if (payload.jobId !== job.jobId) {
    throw new Error("Result jobId does not match");
  }
  if (!Array.isArray(payload.generations) || payload.generations.length !== job.config.generationCount) {
    throw new Error("Result does not contain every generation");
  }

  const best = payload.result?.best;
  if (!best?.model || !Number.isFinite(best.fitness)) {
    throw new Error("Result best model is invalid");
  }

  payload.generations.forEach((generation, index) => {
    const expectedGeneration = job.config.startGeneration + index;
    if (generation.generation !== expectedGeneration) {
      throw new Error("Generation number does not match the job");
    }
    if (
      !Array.isArray(generation.rankedPopulation) ||
      generation.rankedPopulation.length !== job.config.populationSize
    ) {
      throw new Error("Generation does not contain the full population");
    }
    if (!Number.isFinite(generation.bestFitness) || !Number.isFinite(generation.averageFitness)) {
      throw new Error("Generation fitness is invalid");
    }
    for (const individual of generation.rankedPopulation) {
      validateModel(individual.model);
      if (!Number.isFinite(individual.fitness)) {
        throw new Error("Individual fitness is invalid");
      }
    }
  });

  const runId = startTrainingRun(database, {
    populationSize: job.config.populationSize,
    gamesPerModel: job.config.gamesPerModel,
    opponentCpu: STRONG,
  });

  try {
    for (const generation of payload.generations) {
      saveGeneration(database, {
        runId,
        ...generation,
      });
    }
    completeTrainingRun(database, runId);
  } catch (error) {
    throw error;
  }

  const generation = payload.result.bestGeneration ?? payload.generations.at(-1).generation;
  writeBestModel(
    {
      ...best,
      model: normalizeModel(best.model),
    },
    generation,
    bestModelPath,
  );

  return {
    runId,
    generation,
    fitness: best.fitness,
  };
}

function createRemoteTrainingServer({
  token,
  job,
  database,
  rootDirectory = PROJECT_ROOT,
  bestModelPath = DEFAULT_BEST_MODEL_PATH,
}) {
  if (typeof token !== "string" || token.length < 24) {
    throw new Error("REMOTE_TRAINING_TOKEN must contain at least 24 characters");
  }

  const manifest = createSourceManifest(rootDirectory);
  const manifestPaths = new Set(manifest.map((entry) => entry.path));
  let acceptedResult = null;

  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, "http://localhost");

      if (request.method === "GET" && requestUrl.pathname === "/health") {
        sendJson(response, 200, { ok: true, resultAccepted: acceptedResult !== null });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/colab-worker.py") {
        const content = fs.readFileSync(path.join(__dirname, "colabWorker.py"));
        response.writeHead(200, {
          "content-type": "text/x-python; charset=utf-8",
          "content-length": content.length,
          "cache-control": "no-store",
        });
        response.end(content);
        return;
      }

      if (!isAuthorized(request, token)) {
        sendJson(response, 401, { error: "Unauthorized" });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/job") {
        sendJson(response, 200, job);
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/manifest") {
        sendJson(response, 200, { files: manifest });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/file") {
        const relativePath = requestUrl.searchParams.get("path") ?? "";
        const absolutePath = resolveSourcePath(relativePath, manifestPaths, rootDirectory);
        const content = fs.readFileSync(absolutePath);
        response.writeHead(200, {
          "content-type": "application/octet-stream",
          "content-length": content.length,
          "cache-control": "no-store",
        });
        response.end(content);
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/result") {
        if (acceptedResult !== null) {
          sendJson(response, 409, { error: "A result has already been accepted" });
          return;
        }
        const payload = await readJsonBody(request);
        acceptedResult = importRemoteResult({
          payload,
          job,
          database,
          bestModelPath,
        });
        sendJson(response, 201, { ok: true, ...acceptedResult });
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
  });
}

function parseServerArguments(commandArguments) {
  const positionalArguments = commandArguments.filter((argument) => !argument.startsWith("--"));
  const valueOf = (name, fallback) => {
    const argument = commandArguments.find((entry) => entry.startsWith(`--${name}=`));
    return argument ? Number(argument.slice(name.length + 3)) : fallback;
  };

  return {
    generationCount: Number(positionalArguments[0] ?? 20),
    populationSize: Number(positionalArguments[1] ?? 16),
    gamesPerModel: Number(positionalArguments[2] ?? 40),
    searchDepth: valueOf("search-depth", 2),
    endgameThreshold: valueOf("endgame-threshold", 8),
    localSearchEliteCount: valueOf("local-search-elites", 1),
    localSearchCoordinateCount: valueOf("local-search-coordinates", 4),
    localSearchStrength: valueOf("local-search-strength", 0.1),
    workerCount: valueOf("workers", 1),
    modelType:
      commandArguments.find((entry) => entry.startsWith("--model-type="))
        ?.slice("--model-type=".length) ?? "linear",
    port: valueOf("port", DEFAULT_REMOTE_TRAINING_PORT),
    shouldResume: commandArguments.includes("--resume"),
  };
}

if (require.main === module) {
  const token = process.env.REMOTE_TRAINING_TOKEN;
  const options = parseServerArguments(process.argv.slice(2));
  const database = openTrainingDatabase(DEFAULT_TRAINING_DATABASE_PATH);
  const job = createRemoteJob({
    ...options,
    database,
  });
  const server = createRemoteTrainingServer({
    token,
    job,
    database,
  });

  server.listen(options.port, "127.0.0.1", () => {
    console.log(`リモート学習API: http://127.0.0.1:${options.port}`);
    console.log(`ジョブID: ${job.jobId}`);
    console.log(
      `設定: ${options.generationCount}世代 / ${options.populationSize}個体 / ` +
      `${options.gamesPerModel}試合 / 深さ${options.searchDepth} / 終盤${options.endgameThreshold}`,
    );
    console.log(
      `局所探索: 上位${options.localSearchEliteCount}体 / ` +
      `${options.localSearchCoordinateCount}座標 / 強度${options.localSearchStrength}`,
    );
    console.log(`評価モデル: ${options.modelType === "nn" ? "小規模NN" : "線形"}`);
    console.log(`評価ワーカー: ${options.workerCount}`);
  });

  function shutdown() {
    server.close(() => {
      database.close();
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

module.exports = {
  DEFAULT_REMOTE_TRAINING_PORT,
  getSourceFiles,
  createSourceManifest,
  resolveSourcePath,
  isAuthorized,
  createRemoteJob,
  importRemoteResult,
  createRemoteTrainingServer,
  parseServerArguments,
};
