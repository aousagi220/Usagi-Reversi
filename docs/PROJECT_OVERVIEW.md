# USAGI REVERSI - プロジェクト概要

## 概要

USAGI REVERSIは、HTML / CSS / Vanilla JavaScriptで動作する8×8リバーシです。
ブラウザ対戦に加え、Node.jsによる自動対局、棋譜保存、定石生成、遺伝的
アルゴリズムとSelf-Playによる評価モデル学習に対応しています。

## ゲーム機能

| 機能 | 詳細 |
|---|---|
| ルール | 合法手判定、8方向反転、パス、終局、勝敗判定 |
| 表示 | 合法手ハイライト、石数、手番、パス通知、結果モーダル |
| プレイヤー設定 | 黒・白をそれぞれ人間またはCPUへ切り替え可能 |
| 対応環境 | デスクトップ、タブレット、モバイル |

## ブラウザCPU

| CPU | アルゴリズム |
|---|---|
| 弱 | 合法手からランダム選択 |
| 普通 | その手で返せる石が最多の手を選択 |
| 強 | 定石、角・辺の加点、Cマス・Xマスの減点を使う1手評価 |
| 学習AI | 学習済み線形モデルまたは小規模NNを使ったネガマックス＋αβ探索 |

学習AIは置換表と盤面対称性を使い、既定350msで最大深さ8まで反復深化します。
残り8マス以下では時間内での完全読みを試みます。
学習後は`npm run model:build`で`JS/modelCpuData.js`を更新します。

## Automation

`Automation`はブラウザから独立した対局・データ生成環境です。

| モジュール | 役割 |
|---|---|
| `reversiEngine.js` | 盤面生成、合法手、着手、反転、終局判定 |
| `cpuStrategies.js` | 弱・普通・強CPUの手選択 |
| `simulate.js` | CPU同士の1局実行 |
| `simulateMany.js` | 先後を交代した複数局の集計 |
| `database.js` | 対局結果と棋譜をSQLiteへ保存 |
| `buildOpeningBook.js` | 棋譜からNode版・ブラウザ版定石を生成 |
| `boardSymmetry.js` | 回転・反転8通りの盤面正規化 |
| `buildBrowserModel.js` | 最良モデルをブラウザ用JavaScriptへ変換 |

Automationの強CPUは、反転数を基準に角・辺・序盤の少数返しを加点し、空いている
角の近くにあるCマス・Xマスを減点します。生成済み定石があれば定石を優先します。

## AI学習

`AITraining`では次の機能を実装しています。

- 8特徴量による段階別線形評価
- 隠れ層8の小規模ニューラル評価
- ネガマックス＋αβ枝刈り
- 終盤完全読み
- 置換表と盤面対称性
- Hall of Fame Self-Playと簡易Elo
- 遺伝的アルゴリズムと局所探索
- `worker_threads`による並列評価
- ngrok経由のGoogle Colabリモート学習
- 反復深化と時間制限探索

詳しいコマンドと設定は
[TEST_AND_TRAINING.md](TEST_AND_TRAINING.md)を参照してください。

## 主な構成

```text
Reversi/
├── index.html
├── index.css
├── JS/
│   ├── script.js
│   ├── UI.js
│   ├── functionBoard.js
│   ├── functionStone.js
│   ├── functionGameFlow.js
│   ├── functionCpuFlow.js
│   ├── modelCpuBrowser.js
│   ├── modelCpuData.js
│   └── openingBookData.js
├── Automation/
│   ├── reversiEngine.js
│   ├── cpuStrategies.js
│   ├── simulate.js
│   ├── simulateMany.js
│   ├── database.js
│   └── buildOpeningBook.js
└── AITraining/
    ├── features.js
    ├── evaluator.js
    ├── modelCpu.js
    ├── geneticAlgorithm.js
    ├── trainer.js
    └── colabWorker.py
```
