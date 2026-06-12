const { parentPort } = require("node:worker_threads");
const { simulateMixedMatches } = require("./mixedEvaluation");

if (parentPort === null) {
  throw new Error("trainingWorker must run inside a worker thread");
}

parentPort.on("message", ({ taskId, model, config }) => {
  try {
    const stats = simulateMixedMatches({
      ...config,
      model,
    });
    parentPort.postMessage({ taskId, stats });
  } catch (error) {
    parentPort.postMessage({
      taskId,
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
  }
});
