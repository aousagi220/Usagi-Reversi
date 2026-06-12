# テストとAI学習

## テスト

```bash
npm test
```

## モデル評価

既存CPUとの対局を実行します。

```bash
npm run ai:evaluate -- 100 --search-depth=3 --endgame-threshold=10
```

- `100`: 対局数
- `--search-depth=3`: 通常局面の探索深さ
- `--endgame-threshold=10`: 空きマスが10以下になったら終局まで完全読み
- `--endgame-threshold=0`: 終盤完全読みを無効化

## 遺伝的アルゴリズムによる学習

```bash
npm run ai:train -- 20 16 40 --search-depth=3 --endgame-threshold=10
```

位置引数は順に世代数、個体数、1個体あたりの対局数です。

現在の評価モデルは次の8特徴を使用します。

- 石数差
- 合法手数差
- 角の石数差
- 辺の石数差
- フロンティア石差
- Cマス差
- Xマス差
- 確定石差（角から連続する辺上の確定石）

これらの重みを序盤・中盤・終盤の3組持つため、GAが探索する重みは
合計24個です。

- 空き45マス以上: 序盤重み
- 空き30マス: 中盤重み
- 空き14マス以下: 終盤重み
- 各基準点の間: 2組の重みを線形補間

旧モデルの `dangerSquareDifference` は読み込み時にCマスとXマスの
両方へ引き継がれます。旧フラットモデルは3段階すべてへ同じ重みを
複製して移行されます。24重みを探索するため、学習時の個体数は
24以上を推奨します。

学習時はSQLiteに保存された各世代の優勝モデルから、適応度上位8体を
Hall of Fameとして読み込みます。既定では対局の50%をこのモデルプールへ
割り当て、勝敗スコアから算出した簡易Eloも適応度へ反映します。

各世代では上位個体へ制限付き座標降下も適用します。既定値は上位1体、
4座標、重みの相対幅10%です。各座標の `+ε` と `-ε` を評価し、改善した
候補だけを採用します。対象座標は世代ごとにずれ、線形モデルでは6世代で
24重みを一巡します。NNは216パラメータなので、4座標ずつなら54世代で
一巡します。

```bash
npm run ai:train -- 20 24 40 \
  --search-depth=2 \
  --endgame-threshold=8 \
  --local-search-elites=1 \
  --local-search-coordinates=4 \
  --local-search-strength=0.1
```

局所探索を無効化する場合は `--local-search-elites=0` を指定します。

### 小規模ニューラル評価

新規学習では線形評価の代わりに「8特徴 → 隠れ層8 → 出力」の小規模NNを
選択できます。

```bash
npm run ai:train -- 30 32 40 \
  --model-type=nn \
  --workers=4 \
  --search-depth=2 \
  --endgame-threshold=8 \
  --local-search-coordinates=4
```

NNは序盤・中盤・終盤で別パラメータを持ち、合計216パラメータです。
ネガマックスで白黒の評価値が必ず符号反転するよう、バイアスを持たない
`tanh` ネットワークにしています。

`--model-type=nn` は新規学習時に使用します。既存線形モデルの続きから
NNへ切り替える場合は `--resume` を付けず、新しい学習として開始してください。
線形評価へ戻す場合は `--model-type=linear` を指定するか省略します。

`--workers=N` を指定すると、個体ごとの対局評価をNode.jsの
`worker_threads`へ分散します。物理CPUコア数以下を目安にしてください。
指定を省略した場合は1ワーカーで従来どおり実行します。

前回のSQLite履歴から再開する場合:

```bash
npm run ai:train:resume -- 20 16 40 --search-depth=3 --endgame-threshold=10
```

探索深さと完全読み閾値を上げるほど計算時間は増えます。最初は
`--search-depth=2 --endgame-threshold=8` 程度で動作時間を確認してください。

探索中は局面・手番・探索深度・αβ境界を置換表へ保存し、同じ局面の再計算を
省略します。キャッシュした最善手は手順序付けにも再利用され、通常探索と
終盤完全読みの両方で自動的に有効になります。

## Google Colabでリモート学習

ローカルPCをモデルとSQLite履歴の保存先、Colabを計算ワーカーとして使用します。
現在の学習処理はJavaScriptのCPU計算であり、ColabのGPUは使用しません。
ColabのCPUコア数に合わせて `--workers=2` などを指定すると、複数個体を
並列評価できます。

### 1. 共有トークンを作る

ローカルのターミナルで実行します。

```bash
export REMOTE_TRAINING_TOKEN="$(openssl rand -hex 32)"
printf '%s\n' "$REMOTE_TRAINING_TOKEN"
```

表示されたトークンはColabで一度だけ入力します。URLへ埋め込まないでください。

### 2. ローカルAPIを起動する

新規学習:

```bash
npm run ai:remote:server -- 20 16 40 \
  --model-type=nn \
  --workers=2 \
  --search-depth=2 \
  --endgame-threshold=8 \
  --local-search-elites=1 \
  --local-search-coordinates=4 \
  --local-search-strength=0.1
```

SQLiteの続きから再開:

```bash
npm run ai:remote:server -- 20 16 40 \
  --workers=2 \
  --search-depth=2 \
  --endgame-threshold=8 \
  --local-search-elites=1 \
  --local-search-coordinates=4 \
  --local-search-strength=0.1 \
  --resume
```

位置引数は世代数、個体数、1個体あたりの対局数です。APIは
`127.0.0.1:8787` のみにバインドされます。

### 3. ngrokで公開する

別のターミナルで初回のみ認証します。

```bash
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

APIを公開します。

```bash
ngrok http 8787
```

表示された `https://...ngrok-free.app` のURLを控えます。ローカルAPIと
ngrokはColab学習が終わるまで起動したままにしてください。

### 4. Colabから接続する

ColabのCPUランタイムで次のセルを実行します。`NGROK_URL` を置き換えてください。

```python
NGROK_URL = "https://example.ngrok-free.app"

!curl -fsSL -H "ngrok-skip-browser-warning: true" \
  "$NGROK_URL/colab-worker.py" -o /content/colabWorker.py
!python3 /content/colabWorker.py --server "$NGROK_URL"
```

共有トークンの入力後、Colabは現在のローカルソースをダウンロードして学習します。
完了すると、全世代と全個体がローカルの `AITraining/data/training.db` へ保存され、
最良モデルが `AITraining/models/bestModel.json` へ保存されます。

### 注意

- APIはBearerトークンで保護されますが、トークンやngrok URLを公開しないでください。
- 同じサーバーは1件の結果だけ受け付けます。次の学習ではサーバーを再起動します。
- Colabのランタイムには利用上限や切断があります。長い学習は世代数を分割し、
  `--resume` で継続してください。
- Colabからローカルへ接続できない場合は、ローカルAPI、ngrok、URL、トークンの
  4点を確認してください。
