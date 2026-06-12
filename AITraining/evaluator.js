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
const CORE_FEATURE_NAMES = FEATURE_NAMES.slice(0, 4);
const PHASE_NAMES = ["opening", "midgame", "endgame"];
const PHASE_ANCHORS = Object.freeze({
  opening: 45,
  midgame: 30,
  endgame: 14,
});

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

  const normalizedWeights = {
    ...BASE_WEIGHTS,
    ...weights,
  };

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

function isPhasedModel(model) {
  return PHASE_NAMES.some((phaseName) => Object.hasOwn(model, phaseName));
}

function normalizeModel(model) {
  if (model === null || typeof model !== "object" || Array.isArray(model)) {
    throw new TypeError("model must be an object");
  }

  if (!isPhasedModel(model)) {
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

  if (isPhasedModel(model)) {
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

function interpolateWeights(firstWeights, secondWeights, ratio) {
  return Object.fromEntries(
    FEATURE_NAMES.map((featureName) => [
      featureName,
      firstWeights[featureName] +
        (secondWeights[featureName] - firstWeights[featureName]) * ratio,
    ]),
  );
}

function getPhaseWeights(model, emptyCount) {
  if (!Number.isInteger(emptyCount) || emptyCount < 0 || emptyCount > 60) {
    throw new Error("emptyCount must be an integer between 0 and 60");
  }

  const normalizedModel = normalizeModel(model);
  if (emptyCount >= PHASE_ANCHORS.opening) return normalizedModel.opening;
  if (emptyCount <= PHASE_ANCHORS.endgame) return normalizedModel.endgame;

  if (emptyCount >= PHASE_ANCHORS.midgame) {
    const ratio =
      (PHASE_ANCHORS.opening - emptyCount) /
      (PHASE_ANCHORS.opening - PHASE_ANCHORS.midgame);
    return interpolateWeights(normalizedModel.opening, normalizedModel.midgame, ratio);
  }

  const ratio =
    (PHASE_ANCHORS.midgame - emptyCount) /
    (PHASE_ANCHORS.midgame - PHASE_ANCHORS.endgame);
  return interpolateWeights(normalizedModel.midgame, normalizedModel.endgame, ratio);
}

function evaluateFeatures(features, model = DEFAULT_MODEL, emptyCount = PHASE_ANCHORS.midgame) {
  validateModel(model);
  const weights = getPhaseWeights(model, emptyCount);
  let score = 0;

  for (const featureName of FEATURE_NAMES) {
    const featureValue = features[featureName];
    if (!Number.isFinite(featureValue)) {
      throw new TypeError(`Feature value must be finite: ${featureName}`);
    }
    score += featureValue * weights[featureName];
  }

  return score;
}

function evaluateBoard(board, player, model = DEFAULT_MODEL) {
  return evaluateFeatures(
    extractFeatures(board, player),
    model,
    countStones(board).empty,
  );
}

function createModel(weights = {}) {
  const model = isPhasedModel(weights)
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
  DEFAULT_MODEL,
  normalizeModel,
  validateModel,
  getPhaseWeights,
  evaluateFeatures,
  evaluateBoard,
  createModel,
};
