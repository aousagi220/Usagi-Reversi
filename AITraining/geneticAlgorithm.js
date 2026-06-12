const {
  PHASE_NAMES,
  DEFAULT_MODEL,
  isNeuralModel,
  normalizeModel,
  validateModel,
} = require("./evaluator");

function randomBetween(min, max, random = Math.random) {
  return min + (max - min) * random();
}

function collectNumericParameters(value, path, parameters) {
  if (typeof value === "number") {
    parameters.push({ path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectNumericParameters(entry, [...path, index], parameters));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    collectNumericParameters(entry, [...path, key], parameters);
  }
}

function getModelParameters(model) {
  const normalizedModel = normalizeModel(model);
  const parameters = [];
  for (const phaseName of PHASE_NAMES) {
    collectNumericParameters(normalizedModel[phaseName], [phaseName], parameters);
  }
  return parameters;
}

function getPathValue(object, path) {
  return path.reduce((value, key) => value[key], object);
}

function setPathValue(object, path, value) {
  const parent = path.slice(0, -1).reduce((current, key) => current[key], object);
  parent[path.at(-1)] = value;
}

function mapModelParameters(model, mapParameter) {
  const normalizedModel = normalizeModel(model);
  const mappedModel = structuredClone(normalizedModel);

  getModelParameters(normalizedModel).forEach(({ path, value }, index) => {
    setPathValue(mappedModel, path, mapParameter(value, path, index));
  });
  return mappedModel;
}

function assertCompatibleModels(firstModel, secondModel) {
  if (isNeuralModel(firstModel) !== isNeuralModel(secondModel)) {
    throw new Error("models must use the same architecture");
  }
  if (getModelParameters(firstModel).length !== getModelParameters(secondModel).length) {
    throw new Error("models must have the same parameter count");
  }
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

  return mapModelParameters(baseModel, (baseWeight) => {
    const variation = Math.max(Math.abs(baseWeight), 0.1) * variationRate;
    return randomBetween(baseWeight - variation, baseWeight + variation, random);
  });
}

function crossoverModels(firstParent, secondParent, random = Math.random) {
  validateModel(firstParent);
  validateModel(secondParent);
  assertCompatibleModels(firstParent, secondParent);
  const normalizedSecondParent = normalizeModel(secondParent);

  return mapModelParameters(firstParent, (firstWeight, path) =>
    random() < 0.5 ? firstWeight : getPathValue(normalizedSecondParent, path),
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

  return mapModelParameters(model, (weight) => {
    if (random() >= mutationRate) return weight;
    const mutationRange = Math.max(Math.abs(weight), 0.1) * mutationStrength;
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
      return { model: normalizedModel, ...evaluation };
    })
    .sort((first, second) => second.fitness - first.fitness);
}

async function evaluatePopulationAsync(population, evaluateModel) {
  if (typeof evaluateModel !== "function") {
    throw new TypeError("evaluateModel must be a function");
  }

  const evaluatedPopulation = await Promise.all(
    population.map(async (model, index) => {
      validateModel(model);
      const normalizedModel = normalizeModel(model);
      const evaluation = await evaluateModel(normalizedModel, index);
      if (!Number.isFinite(evaluation.fitness)) {
        throw new TypeError("fitness must be a finite number");
      }
      return { model: normalizedModel, ...evaluation };
    }),
  );
  return evaluatedPopulation.sort((first, second) => second.fitness - first.fitness);
}

function createCoordinateCandidate(model, path, delta) {
  const candidate = normalizeModel(model);
  setPathValue(candidate, path, getPathValue(candidate, path) + delta);
  return candidate;
}

function improveIndividualWithLocalSearch(
  individual,
  evaluateModel,
  {
    coordinateCount = 4,
    coordinateOffset = 0,
    strength = 0.1,
  } = {},
) {
  if (!Number.isInteger(coordinateCount) || coordinateCount < 0) {
    throw new Error("coordinateCount must be a non-negative integer");
  }
  if (!Number.isInteger(coordinateOffset) || coordinateOffset < 0) {
    throw new Error("coordinateOffset must be a non-negative integer");
  }
  if (!Number.isFinite(strength) || strength < 0) {
    throw new Error("local search strength must be a non-negative number");
  }

  const coordinates = getModelParameters(individual.model);
  let best = { ...individual, model: normalizeModel(individual.model) };

  for (let index = 0; index < Math.min(coordinateCount, coordinates.length); index++) {
    const { path } = coordinates[(coordinateOffset + index) % coordinates.length];
    const baseModel = best.model;
    const weight = getPathValue(baseModel, path);
    const step = Math.max(Math.abs(weight), 0.1) * strength;
    let coordinateBest = best;

    for (const direction of [1, -1]) {
      const candidateModel = createCoordinateCandidate(baseModel, path, step * direction);
      const evaluation = evaluateModel(candidateModel);
      if (!Number.isFinite(evaluation.fitness)) {
        throw new TypeError("fitness must be a finite number");
      }
      if (evaluation.fitness > coordinateBest.fitness) {
        coordinateBest = { model: candidateModel, ...evaluation };
      }
    }
    best = coordinateBest;
  }
  return best;
}

function improvePopulationWithLocalSearch(
  rankedPopulation,
  evaluateModel,
  {
    eliteCount = 1,
    coordinateCount = 4,
    coordinateOffset = 0,
    strength = 0.1,
  } = {},
) {
  if (!Number.isInteger(eliteCount) || eliteCount < 0 || eliteCount > rankedPopulation.length) {
    throw new Error("local search eliteCount must be between 0 and population size");
  }

  return rankedPopulation
    .map((individual, index) =>
      index < eliteCount
        ? improveIndividualWithLocalSearch(individual, evaluateModel, {
            coordinateCount,
            coordinateOffset,
            strength,
          })
        : individual,
    )
    .sort((first, second) => second.fitness - first.fitness);
}

async function improveIndividualWithLocalSearchAsync(
  individual,
  evaluateModel,
  {
    coordinateCount = 4,
    coordinateOffset = 0,
    strength = 0.1,
  } = {},
) {
  if (!Number.isInteger(coordinateCount) || coordinateCount < 0) {
    throw new Error("coordinateCount must be a non-negative integer");
  }
  if (!Number.isInteger(coordinateOffset) || coordinateOffset < 0) {
    throw new Error("coordinateOffset must be a non-negative integer");
  }
  if (!Number.isFinite(strength) || strength < 0) {
    throw new Error("local search strength must be a non-negative number");
  }

  const coordinates = getModelParameters(individual.model);
  let best = { ...individual, model: normalizeModel(individual.model) };

  for (let index = 0; index < Math.min(coordinateCount, coordinates.length); index++) {
    const { path } = coordinates[(coordinateOffset + index) % coordinates.length];
    const baseModel = best.model;
    const weight = getPathValue(baseModel, path);
    const step = Math.max(Math.abs(weight), 0.1) * strength;
    const candidateModels = [1, -1].map((direction) =>
      createCoordinateCandidate(baseModel, path, step * direction),
    );
    const evaluations = await Promise.all(
      candidateModels.map((candidateModel) => evaluateModel(candidateModel)),
    );

    evaluations.forEach((evaluation, candidateIndex) => {
      if (!Number.isFinite(evaluation.fitness)) {
        throw new TypeError("fitness must be a finite number");
      }
      if (evaluation.fitness > best.fitness) {
        best = {
          model: candidateModels[candidateIndex],
          ...evaluation,
        };
      }
    });
  }
  return best;
}

async function improvePopulationWithLocalSearchAsync(
  rankedPopulation,
  evaluateModel,
  {
    eliteCount = 1,
    coordinateCount = 4,
    coordinateOffset = 0,
    strength = 0.1,
  } = {},
) {
  if (!Number.isInteger(eliteCount) || eliteCount < 0 || eliteCount > rankedPopulation.length) {
    throw new Error("local search eliteCount must be between 0 and population size");
  }

  const improvedElites = await Promise.all(
    rankedPopulation.slice(0, eliteCount).map((individual) =>
      improveIndividualWithLocalSearchAsync(individual, evaluateModel, {
        coordinateCount,
        coordinateOffset,
        strength,
      }),
    ),
  );
  return [...improvedElites, ...rankedPopulation.slice(eliteCount)]
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
    nextGeneration.push(mutateModel(child, { mutationRate, mutationStrength, random }));
  }
  return nextGeneration;
}

module.exports = {
  randomBetween,
  getModelParameters,
  createRandomModel,
  crossoverModels,
  mutateModel,
  createInitialPopulation,
  evaluatePopulation,
  evaluatePopulationAsync,
  improveIndividualWithLocalSearch,
  improveIndividualWithLocalSearchAsync,
  improvePopulationWithLocalSearch,
  improvePopulationWithLocalSearchAsync,
  createNextGeneration,
};
