const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.join(__dirname, "..");

function createBrowserContext() {
  const context = vm.createContext({ Math });
  vm.runInContext(
    `
      const EMPTY = 0;
      const BLACK = 1;
      const WHITE = 2;
      const BOARD_SIZE = 8;
      const DIRECTIONS = [
        [0, 1], [0, -1], [1, 0], [-1, 0],
        [1, 1], [1, -1], [-1, 1], [-1, -1],
      ];
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
  vm.runInContext(
    fs.readFileSync(path.join(projectRoot, "JS", "modelCpuData.js"), "utf8"),
    context,
  );
  vm.runInContext(
    fs.readFileSync(path.join(projectRoot, "JS", "modelCpuBrowser.js"), "utf8"),
    context,
  );
  return context;
}

test("ブラウザ版学習AIが初期盤面から合法手を選ぶ", () => {
  const context = createBrowserContext();
  const result = vm.runInContext(
    `
      (() => {
        const move = selectBrowserModelMove(BOARD, BLACK);
        return {
          move,
          legal: getModelValidMoves(BOARD, BLACK)
            .some(([x, y]) => x === move[0] && y === move[1]),
        };
      })()
    `,
    context,
  );

  assert.equal(result.legal, true);
});

test("HTMLはモデルデータと探索処理をCPUフローより先に読み込む", () => {
  const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const dataIndex = html.indexOf("./JS/modelCpuData.js");
  const modelIndex = html.indexOf("./JS/modelCpuBrowser.js");
  const cpuFlowIndex = html.indexOf("./JS/functionCpuFlow.js");

  assert.ok(dataIndex >= 0);
  assert.ok(modelIndex > dataIndex);
  assert.ok(cpuFlowIndex > modelIndex);
  assert.match(html, /<option value="3">学習AI<\/option>/);
});
