const { BOARD_SIZE } = require("./reversiEngine");

const TRANSFORM_COUNT = 8;
const INVERSE_TRANSFORMS = Object.freeze([0, 3, 2, 1, 4, 5, 6, 7]);

function transformCoordinate([x, y], transform, boardSize = BOARD_SIZE) {
  const last = boardSize - 1;

  switch (transform) {
    case 0: return [x, y];
    case 1: return [y, last - x];
    case 2: return [last - x, last - y];
    case 3: return [last - y, x];
    case 4: return [x, last - y];
    case 5: return [last - x, y];
    case 6: return [y, x];
    case 7: return [last - y, last - x];
    default: throw new Error("transform must be an integer between 0 and 7");
  }
}

function inverseTransformCoordinate(coordinate, transform, boardSize = BOARD_SIZE) {
  if (!Number.isInteger(transform) || transform < 0 || transform >= TRANSFORM_COUNT) {
    throw new Error("transform must be an integer between 0 and 7");
  }
  return transformCoordinate(coordinate, INVERSE_TRANSFORMS[transform], boardSize);
}

function transformBoardKey(boardKey, transform, boardSize = BOARD_SIZE) {
  if (typeof boardKey !== "string" || boardKey.length !== boardSize * boardSize) {
    throw new Error(`boardKey must contain exactly ${boardSize * boardSize} characters`);
  }

  const transformed = Array(boardKey.length);
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      const [nextX, nextY] = transformCoordinate([x, y], transform, boardSize);
      transformed[nextX * boardSize + nextY] = boardKey[x * boardSize + y];
    }
  }
  return transformed.join("");
}

function canonicalizeBoardKey(boardKey, boardSize = BOARD_SIZE) {
  let key = null;
  let transform = 0;

  for (let candidateTransform = 0; candidateTransform < TRANSFORM_COUNT; candidateTransform++) {
    const candidateKey = transformBoardKey(boardKey, candidateTransform, boardSize);
    if (key === null || candidateKey < key) {
      key = candidateKey;
      transform = candidateTransform;
    }
  }
  return { key, transform };
}

function canonicalizeBoard(board) {
  return canonicalizeBoardKey(board.flat().join(""), board.length);
}

module.exports = {
  TRANSFORM_COUNT,
  transformCoordinate,
  inverseTransformCoordinate,
  transformBoardKey,
  canonicalizeBoardKey,
  canonicalizeBoard,
};
