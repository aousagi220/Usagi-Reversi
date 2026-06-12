const fs = require("node:fs");
const path = require("node:path");
const { normalizeModel, validateModel } = require("../AITraining/evaluator");

const DEFAULT_INPUT_PATH = path.join(__dirname, "..", "AITraining", "models", "bestModel.json");
const DEFAULT_OUTPUT_PATH = path.join(__dirname, "..", "JS", "modelCpuData.js");

function buildBrowserModelData(payload) {
  const sourceModel = payload.weights ?? payload.model ?? payload;
  const model = normalizeModel(sourceModel);
  validateModel(model);

  return {
    generation: payload.generation ?? null,
    fitness: Number.isFinite(payload.fitness) ? payload.fitness : null,
    model,
  };
}

function writeBrowserModelData(data, outputPath = DEFAULT_OUTPUT_PATH) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `const TRAINED_MODEL_DATA = ${JSON.stringify(data)};\n`,
  );
}

if (require.main === module) {
  const inputPath = process.argv[2] ?? DEFAULT_INPUT_PATH;
  const outputPath = process.argv[3] ?? DEFAULT_OUTPUT_PATH;
  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const data = buildBrowserModelData(payload);
  writeBrowserModelData(data, outputPath);
  console.log(`ブラウザ用モデル: ${outputPath}`);
}

module.exports = {
  DEFAULT_INPUT_PATH,
  DEFAULT_OUTPUT_PATH,
  buildBrowserModelData,
  writeBrowserModelData,
};
