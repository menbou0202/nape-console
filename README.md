# Nape Console

Napeのキーマップを、ファームウェアを書き直さずに変更するための設定画面です。

現段階ではZMK StudioのUSB RPCを利用し、以下を実装しています。

- USB接続
- レイヤー0〜11の固定表示
- キーマップの読み込みと変更
- Layer-Tap、Mod-Tap、定義済みカスタムビヘイビアの割り当て
- 変更の保存・破棄・初期設定への復元
- Napeの表裏ワイヤフレームとレイヤー0〜7に合わせた表示の回転
- スロットによるキーマップ作成とドラッグ＆ドロップ割り当て
- キャンバスのパン・ズーム

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

ChromeまたはEdgeで開き、Studio対応ファームウェアを書き込んだNapeをUSB接続します。

## Upstream

Nape Consoleは[ZMK Studio](https://github.com/zmkfirmware/zmk-studio)をベースにしています。元のコードはApache License 2.0です。
