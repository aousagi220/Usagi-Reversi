const test = require("node:test");
const assert = require("node:assert/strict");

const {
  transformCoordinate,
  inverseTransformCoordinate,
  transformBoardKey,
  canonicalizeBoardKey,
} = require("./boardSymmetry");

test("8種類の対称変換で座標を元に戻せる", () => {
  for (let transform = 0; transform < 8; transform++) {
    const transformed = transformCoordinate([2, 5], transform);
    assert.deepEqual(
      inverseTransformCoordinate(transformed, transform),
      [2, 5],
    );
  }
});

test("回転・反転した盤面は同じ正規キーになる", () => {
  const boardKey = [
    "10000000",
    "02000000",
    "00100000",
    "00020000",
    "00001000",
    "00000200",
    "00000010",
    "00000002",
  ].join("");
  const canonicalKey = canonicalizeBoardKey(boardKey).key;

  for (let transform = 0; transform < 8; transform++) {
    assert.equal(
      canonicalizeBoardKey(transformBoardKey(boardKey, transform)).key,
      canonicalKey,
    );
  }
});
