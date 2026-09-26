# Nape Consoleの使い方：キーマップを変更する

Nape Consoleは、Napeのキー割り当てをブラウザーから変更するツールです。最初に対応ファームウェアを書き込めば、以後のキーマップ変更にファームウェアの再ビルド・再書き込みは必要ありません。

このガイドはデスクトップ版Chrome／EdgeとUSB接続を対象にしています。スマートフォンのブラウザーやBluetooth経由の設定には対応していません。

<!-- スクリーンショット：Nape Consoleの画面全体 -->

## 準備するもの

- Nape本体と、データ通信ができるUSBケーブル
- デスクトップ版ChromeまたはEdge
- Nape Console対応の`nape-console.uf2`を書き込んだNape

対応UF2は[`zmk-config-nape`の`console-beta`ブランチ](https://github.com/menbou0202/zmk-config-nape/tree/console-beta)でビルドします。GitHub Releaseに配布用UF2がある場合はそれを使えます。Release公開前は[成功したGitHub Actionsの実行](https://github.com/menbou0202/zmk-config-nape/actions/runs/36231883233)から`firmware`成果物をダウンロードし、その中の`nape-console.uf2`を使ってください。Actionsの成果物のダウンロードにはGitHubへのログインが必要な場合があります。

従来の`nape.uf2`や`nape-studio.uf2`では、Nape Console独自のComboやランタイム設定を利用できません。UF2の書き込み方法は[Napeの組み立てガイド](https://github.com/menbou0202/Nape/blob/main/doc/build-guide.md)を参照してください。

## 1. Napeを接続してUnlockする

1. [Nape Console](https://menbou0202.github.io/nape-console/)を開きます。
2. NapeをUSBケーブルでパソコンへ接続します。
3. 画面の「USB」を押し、ブラウザーの接続確認画面でNapeのポートを選んで接続します。
4. 「Unlock To Continue」と表示されたら、Nape本体のStudio Unlockキーを押します。

出荷時のConsole版キーマップでは、**裏面Key2を押したまま、表面Key1を押す**とUnlockできます。裏面Key2はBluetooth Clearレイヤーを一時的に開き、そのレイヤーの表面Key1にStudio Unlockが割り当てられています。これらのキーを変更している場合は、ご自身で設定したUnlockの割り当てを使ってください。

<!-- スクリーンショット：USB接続画面とポート選択 -->
<!-- スクリーンショット：Unlockに使う裏面Key2・表面Key1 -->

「The port is already open」と出る場合は、同じポートを使っている別のタブやシリアル接続アプリを閉じ、ページを開き直して接続してください。

## 2. レイヤーとキーを選ぶ

左端の「Layers」から編集するレイヤーを選びます。0〜7はNapeの向きに対応し、選んだ角度に合わせて中央のNape図も回転します。8はBluetooth Select、9はBluetooth Clear、10はScroll、11はOrientationです。

レイヤー0〜11はNapeの基本動作に使うため、番号や順番を変えないでください。新しい用途のレイヤーが必要なら、Layersの「＋」で12以降を追加できます。追加したレイヤーを削除するには、そのレイヤーを選んでLayersの「−」を押し、確認画面で削除します。標準の0〜11は削除できません。

削除するとそのレイヤーのキー割り当ては使えなくなります。ほかのキーやComboからそのレイヤーを呼び出している場合は、それらの設定も確認してください。起動時レイヤーに指定している場合は、先に別の起動時レイヤーを選んでから削除します。追加・削除した内容を再起動後も残すには、画面右上の「Save」を押してください。

中央の「Front」は表面、「Back」は裏面です。表面のキーは0°で上からKey3・Key2・Key1。裏面は0°で左からKey3・Key2・Key1です。Nape図から線でつながった大きな四角が、各キーの割り当てを表示する編集ボタンです。

<!-- スクリーンショット：Layersの＋／−、Front／Back、キー番号 -->

## 3. キーの割り当てを変える

最も簡単なのは、左の「Key slots」から使いたい動作を探し、中央の編集ボタンへドラッグ＆ドロップする方法です。Mouse、Bluetooth、Shortcuts、Layersには、よく使う動作があらかじめ用意されています。ドロップすると編集ボタンの表示も新しい動作に変わります。

<!-- スクリーンショット：スロットをキーへドラッグ＆ドロップ -->

用意されていない動作は、Key slotsの「＋」でUserスロットを作れます。Behavior（動作の種類）を選び、必要なキー・レイヤーなどを設定して、**スロット編集画面の「Save」**を押してください。作ったスロットは左のUserカテゴリに入り、そのブラウザーに保存されます。キーへ割り当てるには、作成したスロットを編集ボタンへドラッグします。

編集ボタンを直接クリックして、割り当てだけを変更することもできます。この方法で編集しても、元のスロットには影響しません。

<!-- スクリーンショット：Userスロット作成画面 -->
<!-- スクリーンショット：編集ボタンを直接クリックした画面 -->

よく使うBehaviorの例：

| 画面の名前 | 動作 |
| --- | --- |
| Key Press | キーボードのキーを入力する |
| Mouse Key Press | マウスボタンを押す |
| Momentary Layer | 押している間だけ別レイヤーを使う |
| To Layer | 指定したレイヤーへ切り替える |
| Mod-Tap | 短押しでキー入力、長押しで修飾キーを使う |
| Layer-Tap | 短押しでキー入力、長押しで別レイヤーを使う |

## 4. 保存する

キーの変更はすぐにNapeで試せます。ただし、**電源を切った後も残すには、画面右上のフロッピーディスク形の「Save」を押す必要があります。** Userスロットの編集画面にある「Save」とは別です。

保存前なら、画面右上のUndo／Redoで編集を戻したり、ゴミ箱形の「Discard」で未保存の変更を破棄したりできます。保存したらUSBをつなぎ直し、割り当てが残っているか確認してください。

<!-- スクリーンショット：画面右上のUndo、Redo、Save、Discard -->

## Comboや起動時の向きも変えたい場合

「Combos」では、2つ以上のキーを同時に押したときの動作を編集できます。「＋」で押すキー、実行するBehavior、同時押しの待ち時間などを設定して「Apply」を押します。これも電源断後に残すには、最後に画面右上の「Save」が必要です。

起動時の向きは、Layersの0〜7に表示される家のアイコンから選べます。設定後に画面右上の「Save」を押してください。実際に起動時の向きが変わるのは、Napeを再起動した後です。DPIやHold-Tapのタイミングは左下の「Runtime settings」から変更できます。

<!-- スクリーンショット：Combo編集と起動時レイヤーの家アイコン -->

## 困ったときは

- **USBボタンが出ない・ポートを選べない：** デスクトップ版Chrome／EdgeでHTTPSの公開ページを開き、データ通信対応のUSBケーブルを使ってください。
- **Unlockできない：** 出荷時設定なら裏面Key2を押し続けながら表面Key1を押します。すでにキーマップを変更した場合は、その変更後のUnlockキーを確認してください。
- **再起動すると変更が消える：** スロット編集画面のSaveだけでなく、画面右上のSaveも押してください。
- **設定を初期状態に戻したい：** 画面上部のデバイス名を開き、「Restore Stock Settings」を選びます。本体に保存されたキーマップ、Combo、Hold-Tap、DPI設定などがファームウェアの初期値に戻ります。ブラウザーに保存したUserスロットは別管理です。
- **Console版で起動できない：** 動作を確認済みの従来版UF2に戻し、[Issue](https://github.com/menbou0202/nape-console/issues)で状況を教えてください。設定を全消去するとBluetoothのペアリングなども消えるため、むやみに行わないでください。

Nape Consoleは[ZMK Studio](https://github.com/zmkfirmware/zmk-studio)を基にしています。Nape固有の機能や操作について不明な点は、[Nape ConsoleのIssue](https://github.com/menbou0202/nape-console/issues)でお知らせください。
