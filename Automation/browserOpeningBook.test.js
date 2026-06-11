const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.join(__dirname, "..");

test("ブラウザ版の強CPUが生成済み定石を参照できる", () => {
  const openingBookScript = fs.readFileSync(
    path.join(projectRoot, "JS", "openingBookData.js"),
    "utf8",
  );
  const cpuFlowScript = fs.readFileSync(
    path.join(projectRoot, "JS", "functionCpuFlow.js"),
    "utf8",
  );
  const context = vm.createContext({
    Math,
    setTimeout,
    window: {
      clearTimeout,
    },
  });

  vm.runInContext(
    `
      const EMPTY = 0;
      const BLACK = 1;
      const WHITE = 2;
      const BOARD_SIZE = 8;
      const WEAK = 0;
      const NORMAL = 1;
      const STRONG = 2;
      const TYPE_CPU = 1;
      let currentPlayer = BLACK;
      let blackPlayerName = TYPE_CPU;
      let whitePlayerName = TYPE_CPU;
      let blackCpuType = STRONG;
      let whiteCpuType = STRONG;
      const BOARD = Array.from(
        { length: BOARD_SIZE },
        () => Array(BOARD_SIZE).fill(EMPTY),
      );
      BOARD[3][3] = WHITE;
      BOARD[3][4] = BLACK;
      BOARD[4][3] = BLACK;
      BOARD[4][4] = WHITE;
    `,
    context,
  );
  vm.runInContext(openingBookScript, context);
  vm.runInContext(cpuFlowScript, context);

  const move = vm.runInContext(
    "getOpeningMove([[2, 3], [3, 2], [4, 5], [5, 4]])",
    context,
  );

  assert.deepEqual({ x: move.x, y: move.y }, { x: 2, y: 3 });
});

test("HTMLは定石データをCPU処理より先に読み込む", () => {
  const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const openingBookIndex = html.indexOf("./JS/openingBookData.js");
  const cpuFlowIndex = html.indexOf("./JS/functionCpuFlow.js");

  assert.ok(openingBookIndex >= 0);
  assert.ok(openingBookIndex < cpuFlowIndex);
});
