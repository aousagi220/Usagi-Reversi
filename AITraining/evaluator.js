const { countStones } = require("../Automation/reversiEngine");
const { extractFeatures } = require("./features");

const FEATURE_NAMES = [
  "stoneDifference",
  "mobilityDifference",
  "cornerDifference",
  "edgeDifference",
  "frontierDifference",
  "cSquareDifference",
  "xSquareDifference",
  "stableDiscDifference",
];
const FEATURE_SCALES = [64, 32, 4, 24, 64, 8, 4, 28];
const CORE_FEATURE_NAMES = FEATURE_NAMES.slice(0, 4);
const PHASE_NAMES = ["opening", "midgame", "endgame"];
const PHASE_ANCHORS = Object.freeze({ opening: 45, midgame: 30, endgame: 14 });
const NEURAL_HIDDEN_SIZE = 8;

const BASE_WEIGHTS = Object.freeze({
  stoneDifference: 1,
  mobilityDifference: 8,
  cornerDifference: 50,
  edgeDifference: 15,
  frontierDifference: -8,
  cSquareDifference: -20,
  xSquareDifference: -30,
  stableDiscDifference: 25,
});

function cloneWeights(weights) {
  return Object.fromEntries(
    FEATURE_NAMES.map((featureName) => [featureName, weights[featureName]]),
  );
}

const DEFAULT_MODEL = Object.freeze({
  opening: Object.freeze(cloneWeights(BASE_WEIGHTS)),
  midgame: Object.freeze(cloneWeights(BASE_WEIGHTS)),
  endgame: Object.freeze(cloneWeights(BASE_WEIGHTS)),
});

function normalizeWeights(weights) {
  if (weights === null || typeof weights !== "object" || Array.isArray(weights)) {
    throw new TypeError("model weights must be an object");
  }

  const normalizedWeights = { ...BASE_WEIGHTS, ...weights };
  if (Number.isFinite(weights.dangerSquareDifference)) {
    if (!Object.hasOwn(weights, "cSquareDifference")) {
      normalizedWeights.cSquareDifference = weights.dangerSquareDifference;
    }
    if (!Object.hasOwn(weights, "xSquareDifference")) {
      normalizedWeights.xSquareDifference = weights.dangerSquareDifference;
    }
  }
  delete normalizedWeights.dangerSquareDifference;
  return cloneWeights(normalizedWeights);
}

function isNeuralModel(model) {
  return model?.type === "nn";
}

function isPhasedLinearModel(model) {
  return PHASE_NAMES.some((phaseName) => Object.hasOwn(model, phaseName));
}

function createNeuralPhase(random = Math.random) {
  const scale = Math.sqrt(6 / (FEATURE_NAMES.length + NEURAL_HIDDEN_SIZE));
  return {
    inputWeights: Array.from(
      { length: NEURAL_HIDDEN_SIZE },
      () => Array.from({ length: FEATURE_NAMES.length }, () => (random() * 2 - 1) * scale),
    ),
    outputWeights: Array.from(
      { length: NEURAL_HIDDEN_SIZE },
      () => (random() * 2 - 1) * Math.sqrt(6 / (NEURAL_HIDDEN_SIZE + 1)),
    ),
  };
}

function createNeuralModel({ random = Math.random } = {}) {
  return {
    type: "nn",
    hiddenSize: NEURAL_HIDDEN_SIZE,
    ...Object.fromEntries(
      PHASE_NAMES.map((phaseName) => [phaseName, createNeuralPhase(random)]),
    ),
  };
}

function normalizeNeuralPhase(phase) {
  if (phase === null || typeof phase !== "object" || Array.isArray(phase)) {
    throw new TypeError("neural model phase must be an object");
  }
  return {
    inputWeights: phase.inputWeights.map((row) => [...row]),
    outputWeights: [...phase.outputWeights],
  };
}

function normalizeModel(model) {
  if (model === null || typeof model !== "object" || Array.isArray(model)) {
    throw new TypeError("model must be an object");
  }

  if (isNeuralModel(model)) {
    return {
      type: "nn",
      hiddenSize: NEURAL_HIDDEN_SIZE,
      ...Object.fromEntries(
        PHASE_NAMES.map((phaseName) => [
          phaseName,
          normalizeNeuralPhase(model[phaseName]),
        ]),
      ),
    };
  }

  if (!isPhasedLinearModel(model)) {
    const weights = normalizeWeights(model);
    return Object.fromEntries(
      PHASE_NAMES.map((phaseName) => [phaseName, cloneWeights(weights)]),
    );
  }

  return Object.fromEntries(
    PHASE_NAMES.map((phaseName) => [
      phaseName,
      normalizeWeights(model[phaseName] ?? BASE_WEIGHTS),
    ]),
  );
}

function validateNeuralPhase(phase) {
  if (!Array.isArray(phase.inputWeights) || phase.inputWeights.length !== NEURAL_HIDDEN_SIZE) {
    throw new Error("neural inputWeights must match hidden size");
  }
  for (const row of phase.inputWeights) {
    if (!Array.isArray(row) || row.length !== FEATURE_NAMES.length || row.some((value) => !Number.isFinite(value))) {
      throw new Error("neural inputWeights must contain finite values");
    }
  }
  if (
    !Array.isArray(phase.outputWeights) ||
    phase.outputWeights.length !== NEURAL_HIDDEN_SIZE ||
    phase.outputWeights.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("neural outputWeights must contain finite values");
  }
}

function validateWeights(weights, { requireCoreWeights = false } = {}) {
  if (requireCoreWeights) {
    for (const featureName of CORE_FEATURE_NAMES) {
      if (!Object.hasOwn(weights, featureName)) {
        throw new Error(`Missing model weight: ${featureName}`);
      }
    }
  }
  const normalizedWeights = normalizeWeights(weights);
  for (const featureName of FEATURE_NAMES) {
    if (!Number.isFinite(normalizedWeights[featureName])) {
      throw new TypeError(`Model weight must be finite: ${featureName}`);
    }
  }
}

function validateModel(model) {
  if (model === null || typeof model !== "object" || Array.isArray(model)) {
    throw new TypeError("model must be an object");
  }

  if (isNeuralModel(model)) {
    if (model.hiddenSize !== NEURAL_HIDDEN_SIZE) {
      throw new Error(`neural hiddenSize must be ${NEURAL_HIDDEN_SIZE}`);
    }
    for (const phaseName of PHASE_NAMES) {
      if (!Object.hasOwn(model, phaseName)) {
        throw new Error(`Missing model phase: ${phaseName}`);
      }
      validateNeuralPhase(model[phaseName]);
    }
    return true;
  }

  if (isPhasedLinearModel(model)) {
    for (const phaseName of PHASE_NAMES) {
      if (!Object.hasOwn(model, phaseName)) {
        throw new Error(`Missing model phase: ${phaseName}`);
      }
      validateWeights(model[phaseName], { requireCoreWeights: true });
    }
  } else {
    validateWeights(model, { requireCoreWeights: true });
  }
  return true;
}

function getPhaseBlend(emptyCount) {
  if (!Number.isInteger(emptyCount) || emptyCount < 0 || emptyCount > 60) {
    throw new Error("emptyCount must be an integer between 0 and 60");
  }
  if (emptyCount >= PHASE_ANCHORS.opening) return ["opening", "opening", 0];
  if (emptyCount <= PHASE_ANCHORS.endgame) return ["endgame", "endgame", 0];
  if (emptyCount >= PHASE_ANCHORS.midgame) {
    return [
      "opening",
      "midgame",
      (PHASE_ANCHORS.opening - emptyCount) /
        (PHASE_ANCHORS.opening - PHASE_ANCHORS.midgame),
    ];
  }
  return [
    "midgame",
    "endgame",
    (PHASE_ANCHORS.midgame - emptyCount) /
      (PHASE_ANCHORS.midgame - PHASE_ANCHORS.endgame),
  ];
}

function interpolateValue(first, second, ratio) {
  return first + (second - first) * ratio;
}

function interpolateWeights(firstWeights, secondWeights, ratio) {
  return Object.fromEntries(
    FEATURE_NAMES.map((featureName) => [
      featureName,
      interpolateValue(firstWeights[featureName], secondWeights[featureName], ratio),
    ]),
  );
}

function getPhaseWeights(model, emptyCount) {
  const normalizedModel = normalizeModel(model);
  if (isNeuralModel(normalizedModel)) {
    throw new Error("getPhaseWeights only supports linear models");
  }
  const [firstPhase, secondPhase, ratio] = getPhaseBlend(emptyCount);
  return interpolateWeights(
    normalizedModel[firstPhase],
    normalizedModel[secondPhase],
    ratio,
  );
}

function evaluateNeuralPhase(features, phase) {
  const inputs = FEATURE_NAMES.map(
    (featureName, index) => features[featureName] / FEATURE_SCALES[index],
  );
  const hidden = phase.inputWeights.map((row) => {
    const sum = row.reduce(
      (total, weight, inputIndex) => total + weight * inputs[inputIndex],
      0,
    );
    return Math.tanh(sum);
  });
  return hidden.reduce(
    (total, value, index) => total + value * phase.outputWeights[index],
    0,
  ) * 100;
}

function evaluateFeatures(features, model = DEFAULT_MODEL, emptyCount = PHASE_ANCHORS.midgame) {
  validateModel(model);
  for (const featureName of FEATURE_NAMES) {
    if (!Number.isFinite(features[featureName])) {
      throw new TypeError(`Feature value must be finite: ${featureName}`);
    }
  }

  const normalizedModel = normalizeModel(model);
  if (isNeuralModel(normalizedModel)) {
    const [firstPhase, secondPhase, ratio] = getPhaseBlend(emptyCount);
    return interpolateValue(
      evaluateNeuralPhase(features, normalizedModel[firstPhase]),
      evaluateNeuralPhase(features, normalizedModel[secondPhase]),
      ratio,
    );
  }

  const weights = getPhaseWeights(normalizedModel, emptyCount);
  return FEATURE_NAMES.reduce(
    (score, featureName) => score + features[featureName] * weights[featureName],
    0,
  );
}

function evaluateBoard(board, player, model = DEFAULT_MODEL) {
  return evaluateFeatures(extractFeatures(board, player), model, countStones(board).empty);
}

function createModel(weights = {}) {
  if (isNeuralModel(weights)) {
    const model = normalizeModel(weights);
    validateModel(model);
    return model;
  }
  const model = isPhasedLinearModel(weights)
    ? normalizeModel({
        opening: { ...BASE_WEIGHTS, ...weights.opening },
        midgame: { ...BASE_WEIGHTS, ...weights.midgame },
        endgame: { ...BASE_WEIGHTS, ...weights.endgame },
      })
    : normalizeModel({ ...BASE_WEIGHTS, ...weights });
  validateModel(model);
  return model;
}

module.exports = {
  FEATURE_NAMES,
  PHASE_NAMES,
  PHASE_ANCHORS,
  NEURAL_HIDDEN_SIZE,
  DEFAULT_MODEL,
  isNeuralModel,
  createNeuralModel,
  normalizeModel,
  validateModel,
  getPhaseWeights,
  evaluateFeatures,
  evaluateBoard,
  createModel,
};
