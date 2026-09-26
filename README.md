# Nape Console

Napeのキーマップを、ファームウェアを書き直さずに変更するための設定画面です。β版です。

公開予定のWeb版: <https://menbou0202.github.io/nape-console/>
公開が完了するまではローカル開発版を使用してください。

デスクトップ版のChromeまたはEdgeでページを開き、**Nape Console対応UF2**を書き込んだNapeをUSB接続します。通常の`nape.uf2`や従来の`nape-studio.uf2`ではNape独自のCombo／ランタイム設定RPCは使用できません。変更を電源断後も残すには画面右上のSaveが必要です。

現段階ではZMK StudioのUSB RPCを利用し、以下を実装しています。

- USB接続
- レイヤー0〜11と追加レイヤーの表示・編集
- キーマップの読み込みと変更
- Layer-Tap、Mod-Tap、定義済みカスタムビヘイビアの割り当て
- 変更の保存・破棄・初期設定への復元
- Napeの表裏ワイヤフレームとレイヤー0〜7に合わせた表示の回転
- スロットによるキーマップ作成とドラッグ＆ドロップ割り当て
- キャンバスのパン・ズーム
- 起動時の角度レイヤー（0〜7）とレイヤー別トラックボールDPIの設定
- Hold-Tapのタイミングなど、ランタイム設定の保存・復元

今後の作業は[todo.md](todo.md)にまとめています。

## 開発

```sh
npm install
npm run dev
```

同じTailnet上の別端末から試す場合：

```sh
npm run dev:tailscale
```

起動後、Mac miniのTailscale IPと表示されたポートへアクセスします。

公開用ビルドのパスは `/nape-console/` です。ローカルの開発サーバーは `/` のままです。

## 制限と復旧

- 設定用の接続はUSBです。Bluetooth設定やスマートフォンのブラウザー操作はβ版の対象外です。
- 設定はNape本体の不揮発領域に保存され、通常のUF2再書き込みでは消えません。
- Console版が起動しない場合は、動作を確認済みの従来版`nape.uf2`に戻し、Issueで状況を報告してください。全設定消去はBluetoothペアリング等も消えるため、むやみに行わないでください。

## Upstream

Nape Consoleは[ZMK Studio](https://github.com/zmkfirmware/zmk-studio)をベースにしています。元のコードはApache License 2.0です。
