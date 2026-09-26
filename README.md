# Nape Console

Napeのキーマップを、ファームウェアを書き直さずに変更するための設定画面です。現在はβ版です。

[Nape Consoleを開く](https://menbou0202.github.io/nape-console/)（デスクトップ版Chrome／Edge）

接続・Unlockからキーやレイヤーの編集、保存までの手順は、[Nape Consoleの使い方（HOW_TO_USE.md）](HOW_TO_USE.md)をご覧ください。

## 使い始める

1. [Nape Console β1 Release](https://github.com/menbou0202/zmk-config-nape/releases/tag/nape-console-beta.1)に添付された`nape-console.uf2`をNapeに書き込みます。自分でビルドする場合は[`zmk-config-nape`の`console-beta`ブランチ](https://github.com/menbou0202/zmk-config-nape/tree/console-beta)を使えます。
2. 上のWebページを開き、NapeをUSB接続して「USB」を選びます。ほかのシリアル接続アプリがポートを開いている場合は閉じてください。
3. Unlock画面が出たら、ファームウェアに設定されたStudio Unlockキーを押します。
4. 左のスロットをキーへドラッグするか、キーの編集ボタンをクリックして割り当てます。Combos欄では同時押し、Runtime settingsではDPIやHold-Tap設定を変更できます。
5. 変更を電源断後も残すには、画面右上の「Save」を押します。

通常の`nape.uf2`や従来の`nape-studio.uf2`では、Nape独自のCombo／ランタイム設定RPCは使用できません。対応ファームウェアのソースは[`zmk-config-nape`の`console-beta`](https://github.com/menbou0202/zmk-config-nape/tree/console-beta)、ハードウェア設計は[`Nape`](https://github.com/menbou0202/Nape)にあります。

ZMK StudioのUSB RPCを基に、以下を実装しています。

- USB接続
- レイヤー0〜11の表示・編集と、追加レイヤーの作成・削除
- キーマップの読み込みと変更
- Layer-Tap、Mod-Tap、定義済みカスタムビヘイビアの割り当て
- 変更の保存・破棄・初期設定への復元
- Napeの表裏ワイヤフレームとレイヤー0〜7に合わせた表示の回転
- スロットによるキーマップ作成とドラッグ＆ドロップ割り当て
- キャンバスのパン・ズーム
- 起動時の角度レイヤー（0〜7）とレイヤー別トラックボールDPIの設定
- Hold-Tapのタイミングなど、ランタイム設定の保存・復元
- Comboの追加・編集・削除

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
