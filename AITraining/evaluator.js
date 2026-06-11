const { extractFeatures } = require("./features");

const FEATURE_NAMES = [
  "stoneDifference",
  "mobilityDifference",
  "cornerDifference",
  "edgeDifference",
  "dangerSquareDifference",
];

const DEFAULT_MODEL = Object.freeze({
  stoneDifference: 1,
  mobilityDifference: 8,
  cornerDifference: 50,
  edgeDifference: 15,
  dangerSquareDifference: -25,
});

function validateModel(model) {
  if (model === null || typeof model !== "object" || Array.isArray(model)) {
    throw new TypeError("model must be an object");
  }

  for (const featureName of FEATURE_NAMES) {
    if (!Object.hasOwn(model, featureName)) {
      throw new Error(`Missing model weight: ${featureName}`);
    }

    if (!Number.isFinite(model[featureName])) {
      throw new TypeError(`Model weight must be finite: ${featureName}`);
    }
  }

  return true;
}

function evaluateFeatures(features, model = DEFAULT_MODEL) {
  validateModel(model);

  let score = 0;

  for (const featureName of FEATURE_NAMES) {
    const featureValue = features[featureName];
    if (!Number.isFinite(featureValue)) {
      throw new TypeError(`Feature value must be finite: ${featureName}`);
    }

    score += featureValue * model[featureName];
  }

  return score;
}

function evaluateBoard(board, player, model = DEFAULT_MODEL) {
  const features = extractFeatures(board, player);

  return evaluateFeatures(features, model);
}

function createModel(weights = {}) {
  const model = {
    ...DEFAULT_MODEL,
    ...weights,
  };

  validateModel(model);
  return model;
}

module.exports = {
  FEATURE_NAMES,
  DEFAULT_MODEL,
  validateModel,
  evaluateFeatures,
  evaluateBoard,
  createModel,
};
