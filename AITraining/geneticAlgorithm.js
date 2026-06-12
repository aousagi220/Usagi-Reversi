const {
  FEATURE_NAMES,
  PHASE_NAMES,
  DEFAULT_MODEL,
  normalizeModel,
  validateModel,
} = require("./evaluator");

function randomBetween(min, max, random = Math.random) {
  return min + (max - min) * random();
}

function mapModelWeights(model, mapWeight) {
  const normalizedModel = normalizeModel(model);

  return Object.fromEntries(
    PHASE_NAMES.map((phaseName) => [
      phaseName,
      Object.fromEntries(
        FEATURE_NAMES.map((featureName) => [
          featureName,
          mapWeight(normalizedModel[phaseName][featureName], phaseName, featureName),
        ]),
      ),
    ]),
  );
}

function createRandomModel({
  baseModel = DEFAULT_MODEL,
  variationRate = 0.5,
  random = Math.random,
} = {}) {
  validateModel(baseModel);

  if (!Number.isFinite(variationRate) || variationRate < 0) {
    throw new Error("variationRate must be a non-negative number");
  }

  return mapModelWeights(baseModel, (baseWeight) => {
    const variation = Math.max(Math.abs(baseWeight), 1) * variationRate;
    return randomBetween(baseWeight - variation, baseWeight + variation, random);
  });
}

function crossoverModels(firstParent, secondParent, random = Math.random) {
  validateModel(firstParent);
  validateModel(secondParent);
  const normalizedSecondParent = normalizeModel(secondParent);

  return mapModelWeights(firstParent, (firstWeight, phaseName, featureName) =>
    random() < 0.5
      ? firstWeight
      : normalizedSecondParent[phaseName][featureName],
  );
}

function mutateModel(
  model,
  {
    mutationRate = 0.2,
    mutationStrength = 0.25,
    random = Math.random,
  } = {},
) {
  validateModel(model);

  if (mutationRate < 0 || mutationRate > 1) {
    throw new Error("mutationRate must be between 0 and 1");
  }
  if (!Number.isFinite(mutationStrength) || mutationStrength < 0) {
    throw new Error("mutationStrength must be a non-negative number");
  }

  return mapModelWeights(model, (weight) => {
    if (random() >= mutationRate) return weight;

    const mutationRange = Math.max(Math.abs(weight), 1) * mutationStrength;
    return weight + randomBetween(-mutationRange, mutationRange, random);
  });
}

function createInitialPopulation({
  populationSize,
  baseModel = DEFAULT_MODEL,
  variationRate = 0.5,
  random = Math.random,
}) {
  if (!Number.isInteger(populationSize) || populationSize < 2) {
    throw new Error("populationSize must be an integer of at least 2");
  }

  const population = [normalizeModel(baseModel)];
  while (population.length < populationSize) {
    population.push(createRandomModel({ baseModel, variationRate, random }));
  }
  return population;
}

function evaluatePopulation(population, evaluateModel) {
  if (typeof evaluateModel !== "function") {
    throw new TypeError("evaluateModel must be a function");
  }

  return population
    .map((model, index) => {
      validateModel(model);
      const normalizedModel = normalizeModel(model);
      const evaluation = evaluateModel(normalizedModel, index);

      if (!Number.isFinite(evaluation.fitness)) {
        throw new TypeError("fitness must be a finite number");
      }

      return {
        model: normalizedModel,
        ...evaluation,
      };
    })
    .sort((first, second) => second.fitness - first.fitness);
}

function selectParent(rankedPopulation, selectionPoolSize, random = Math.random) {
  const poolSize = Math.min(selectionPoolSize, rankedPopulation.length);
  return rankedPopulation[Math.floor(random() * poolSize)].model;
}

function createNextGeneration(
  rankedPopulation,
  {
    populationSize = rankedPopulation.length,
    eliteCount = 2,
    selectionPoolSize = Math.ceil(rankedPopulation.length / 2),
    mutationRate = 0.2,
    mutationStrength = 0.25,
    random = Math.random,
  } = {},
) {
  if (rankedPopulation.length === 0) {
    throw new Error("rankedPopulation must not be empty");
  }
  if (!Number.isInteger(eliteCount) || eliteCount < 1 || eliteCount > populationSize) {
    throw new Error("eliteCount must be between 1 and populationSize");
  }

  const nextGeneration = rankedPopulation
    .slice(0, eliteCount)
    .map(({ model }) => normalizeModel(model));

  while (nextGeneration.length < populationSize) {
    const child = crossoverModels(
      selectParent(rankedPopulation, selectionPoolSize, random),
      selectParent(rankedPopulation, selectionPoolSize, random),
      random,
    );
    nextGeneration.push(
      mutateModel(child, { mutationRate, mutationStrength, random }),
    );
  }

  return nextGeneration;
}

module.exports = {
  randomBetween,
  createRandomModel,
  crossoverModels,
  mutateModel,
  createInitialPopulation,
  evaluatePopulation,
  createNextGeneration,
};
