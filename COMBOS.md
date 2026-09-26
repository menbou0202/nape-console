# Comboの試し方

まず画面だけ試す場合は、公開版の
[Comboデモ](https://menbou0202.github.io/nape-console/?demo=combos) を開きます。
「Demo only — no device connected」と表示され、実機には接続しません。
再読み込みするとデモの編集内容は元に戻ります。

実機では、対応する `nape-console.uf2` を書き込み、
[Nape Console](https://menbou0202.github.io/nape-console/) をChromeまたはEdgeで開いてUSB接続し、Unlockしてください。
従来の `nape-studio.uf2` にはCombo編集機能がありません。

## 操作

1. Combo欄の「＋」を押します。
2. 同時押しするキーを2つ以上選び、発動させるBehaviorを設定します。
3. Timeout、Require prior idle、Slow release、対象レイヤーを設定します。
4. 「Apply」で実機へ反映して試します。すべてのキーを離して操作してください。
5. 問題がなければ、画面右上の保存ボタンで電源を切っても残るように保存します。

既存カードのクリックで編集できます。スロットをカードへドラッグすると動作を
置き換えます。Undo/Redoにも対応します。破棄ボタンは最後に保存した状態に戻します。
Restore Stock Settingsはキー割り当てとComboを両方とも標準状態に戻します。

位置図は常に0°を基準にしています。表面は上・中央・下、裏面は左から3・2・1です。
レイヤーの選択はComboを有効にする範囲です。「All layers」は全レイヤーで有効です。
最大16件、各Comboの同時押しは最大6キーです。

## 開発

Combo用ファームウェアはZMKのローカル `nape-console-runtime` ブランチで開発しています。
ベースは `9ebbeff0a8b69a42f14aec022cdf16c7a107b9e0`。まだGitHubには公開していません。
試作版は `5a79fe22bf7f99721bd8356910a4f0a57032a631` に固定し、専用ビルドターゲットでも照合します。
通信は既存StudioのUSB接続にNape専用の操作を追加しています。

ビルド: ワークスペースから `./local-build/zmk-build nape-console`。
Web: `nape-console` で `./node_modules/.bin/vite --host 0.0.0.0`。

プロトコルのテスト:

```sh
./node_modules/.bin/esbuild tests/combo-protocol.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/nape-combo-protocol-tests.cjs
node --test /tmp/nape-combo-protocol-tests.cjs
```

実機での発動、電源を切った後の保存内容、Restore Stock Settingsの最終確認は必要です。
