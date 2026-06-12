const path = require("node:path");
const { Worker } = require("node:worker_threads");

const DEFAULT_WORKER_PATH = path.join(__dirname, "trainingWorker.js");

function validateWorkerCount(workerCount) {
  if (!Number.isInteger(workerCount) || workerCount < 1) {
    throw new Error("workerCount must be a positive integer");
  }
}

class TrainingWorkerPool {
  constructor(workerCount, { workerPath = DEFAULT_WORKER_PATH } = {}) {
    validateWorkerCount(workerCount);
    this.workers = [];
    this.idleWorkers = [];
    this.queue = [];
    this.tasks = new Map();
    this.nextTaskId = 1;
    this.closed = false;

    for (let index = 0; index < workerCount; index++) {
      const worker = new Worker(workerPath);
      worker.on("message", (message) => this.handleMessage(worker, message));
      worker.on("error", (error) => this.handleWorkerFailure(worker, error));
      worker.on("exit", (code) => {
        if (!this.closed && code !== 0) {
          this.handleWorkerFailure(worker, new Error(`Training worker exited with code ${code}`));
        }
      });
      this.workers.push(worker);
      this.idleWorkers.push(worker);
    }
  }

  evaluate(model, config) {
    if (this.closed) {
      return Promise.reject(new Error("Training worker pool is closed"));
    }

    return new Promise((resolve, reject) => {
      const taskId = this.nextTaskId++;
      this.tasks.set(taskId, { resolve, reject, worker: null });
      this.queue.push({ taskId, model, config });
      this.dispatch();
    });
  }

  dispatch() {
    while (this.idleWorkers.length > 0 && this.queue.length > 0) {
      const worker = this.idleWorkers.pop();
      const task = this.queue.shift();
      this.tasks.get(task.taskId).worker = worker;
      worker.postMessage(task);
    }
  }

  handleMessage(worker, message) {
    const task = this.tasks.get(message.taskId);
    if (!task) return;

    this.tasks.delete(message.taskId);
    this.idleWorkers.push(worker);
    if (message.error) {
      const error = new Error(message.error.message);
      error.stack = message.error.stack;
      task.reject(error);
    } else {
      task.resolve(message.stats);
    }
    this.dispatch();
  }

  handleWorkerFailure(worker, error) {
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex === -1) return;
    this.workers.splice(workerIndex, 1);
    this.idleWorkers = this.idleWorkers.filter((candidate) => candidate !== worker);

    for (const [taskId, task] of this.tasks) {
      if (task.worker === worker) {
        this.tasks.delete(taskId);
        task.reject(error);
      }
    }

    if (this.workers.length === 0) {
      for (const task of this.tasks.values()) {
        task.reject(error);
      }
      this.tasks.clear();
      this.queue.length = 0;
      return;
    }
    this.dispatch();
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    const error = new Error("Training worker pool was closed");
    for (const task of this.tasks.values()) {
      task.reject(error);
    }
    this.tasks.clear();
    this.queue.length = 0;
    await Promise.all(this.workers.map((worker) => worker.terminate()));
    this.workers.length = 0;
    this.idleWorkers.length = 0;
  }
}

module.exports = {
  TrainingWorkerPool,
  validateWorkerCount,
};
