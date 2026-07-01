# 車両運行日報管理アプリ - TODO

## Phase 1: 要件確認・スキーマ設計
- [x] プロジェクト初期化（React + TypeScript + Express + tRPC + Drizzle）
- [x] データベーススキーマ設計（drivers, vehicles, daily_records, monthly_cycles）
- [x] スキーマをDrizzleで定義
- [x] マイグレーションSQL生成・実行

## Phase 2: 運転者・車両情報管理
- [x] 運転者登録フォーム（名前、保持機能）
- [x] 車両登録フォーム（車両番号、保持機能）
- [x] 運転者・車両情報の取得・更新API（tRPC）
- [x] ローカルストレージ連携（セッション保持）

## Phase 3: 日次記録入力・計算・永続化
- [x] 日次記録入力フォーム（出発時間、終了時間、出発走行距離、終了走行距離）
- [x] 走行距離自動計算ロジック
- [x] 日次合計表示
- [x] 日次記録の保存API（tRPC）
- [x] 日次記録の取得API（tRPC）
- [x] 毎月16日〜翌15日サイクルの判定ロジック

## Phase 4: 月次レポート・A4印刷
- [x] 月次レポート表示コンポーネント（A4テーブル形式）
- [x] 月次データ集計API（tRPC）
- [x] 総走行距離計算・表示
- [x] ブラウザ印刷対応（CSS @media print）
- [x] A4サイズレイアウト調整

## Phase 5: エレガントなUIデザイン
- [x] グローバルスタイル設定（色、フォント、スペーシング）
- [x] ダッシュボードレイアウト構築
- [x] 入力フォームのスタイリング
- [x] レポート表示のスタイリング
- [x] iPhone/iPad対応レスポンシブデザイン
- [ ] 暗黒モード対応（オプション）

## Phase 6: UIの可視性改善・動作バグ修正
- [x] 運転者・車両情報の編集ボタンの可視性向上
- [x] 日次記録保存ボタンの動作確認・修正
- [x] 走行距離入力フィールドの初期値を削除
- [x] 月次レポートのA4印刷を1枚に收まるよう調整
- [ ] 日次記録の入力・保存・表示テスト
- [ ] 月次レポート生成テスト
- [ ] モバイルレスポンシブテスト
- [x] Vitest単体テスト作成（基本設定）

## Phase 7: 完成したアプリをユーザーに提供
- [ ] 最終確認テスト
- [ ] チェックポイント作成
- [ ] ユーザーへの提供

## Phase 8: UIの追加改善
- [x] 運転者名・車両番号の文字色を濃くする
- [x] ホーム画面保存時のアイコン（favicon/PWAアイコン）をアプリらしいデザインに変更

## Phase 9: PDF/画像出力機能
- [x] html2canvasライブラリの導入
- [x] jsPDFライブラリの導入
- [x] 月次レポートのPDFダウンロードボタン追加
- [x] 月次レポートの画像（PNG）ダウンロードボタン追加

## Phase 10: 文字色改善・不要機能削除
- [x] 本日の走行距離表示の文字色を濃くする（DailyRecordページ）
- [x] PDF出力ボタンを削除（MonthlyReportページ）
- [x] 画像出力ボタンを削除（MonthlyReportページ）
- [x] html2canvas/jsPDF関連コードを削除

## Phase 11: 過去の記録の編集機能
- [x] サーバー側にupdateRecord APIを追加（server/db.ts + server/routers.ts）
- [x] DailyRecordページに記録一覧の編集ボタンを追加
- [x] 編集モードのインラインフォームまたはモーダルを実装
- [x] 編集後のデータ保存・リスト更新処理
- [x] 削除機能も追加
- [x] Vitestテスト作成・全テストパス

## Phase 12: 記録編集時の日付修正バグ修正
- [x] 編集フォームの日付入力が反映されない問題を修正

## Phase 13: 日付のタイムゾーンずれ修正
- [x] サーバー側のaddRecord/updateRecordで日付文字列をUTC変換せず、そのまま保存するよう修正
- [x] フロントエンドの日付表示でタイムゾーンずれが起きないよう修正

## Phase 14: iPhone印刷時のA4レイアウト最適化
- [x] 印刷用CSSをiPhoneのSafari印刷エンジンに対応させる
- [x] フォントサイズ・マージン・パディングをさらに縮小して1ページに収める

## Phase 15: iPhone印刷A4 1枚対応 - 根本修正
- [x] 印刷時に新規ウィンドウでスタンドアロンHTMLを生成して印刷（Tailwind/OKLCH完全排除）
- [x] 固定幅194mmでA4 1枚に確実に収まるレイアウト

## Phase 16: 印刷後の画面遷移修正
- [x] 印刷完了後に新規ウィンドウを自動で閉じる

## Phase 17: 2段階入力フロー（出発時保存・帰着後追加入力）
- [x] スキーマのendTime/endOdometerをNULL許容に変更（既にNULL許容か確認）
- [x] 入力フォームを「出発情報のみで保存可能」に変更
- [x] 記録一覧で未完了（帰着未入力）の記録に「帰着入力」ボタンを表示
- [x] 帰着入力フォームで終了時間・終了走行距離のみ追加入力できる
- [x] 未完了記録の視覚的な区別（バッジ等）
- [x] Vitestテスト追加（部分保存・帰着追加・全テストパス）

## Phase 18: 月次レポートの過去サイクル閲覧機能
- [x] DB: ユーザーの全サイクル一覧取得関数を追加（server/db.ts）
- [x] API: getCycles エンドポイントを追加（server/routers.ts）
- [x] フロントエンド: MonthlyReport.tsxにサイクル選択UIを追加（現在/過去を切り替え）
- [x] 選択したサイクルの記録を表示・印刷できるよう対応
- [x] Vitestテスト追加・全テストパス（10件）

## Phase 19: 帰着フォームを出発フォームの下に表示
- [x] 帰着ボタンを押すと出発フォームの下に帰着フォームが表示される
- [x] 帰着フォームには出発情報（日付・出発時間・出発距離）を参照表示
- [x] 帰着フォームには終了時間・終了走行距離のみ入力
- [x] 「キャンセル」ボタンで帰着フォームを閉じることができる
- [x] 記録一覧の帰着インラインフォームは削除（上部フォームに統合）
- [x] 帰着入力中の記録は一覧で「帰着入力中」バッジで視覚的に区別

## Phase 20: ホーム画面に帰着未入力の視覚的通知
- [x] API: 現在サイクルの帰着未入力件数を返すエンドポイントを追加
- [x] Home.tsx: 帰着未入力がある場合に「本日の記録を入力」カードをオレンジ色に変更
- [x] Home.tsx: カード内に「帰着未入力 ○件」のバッジ・テキストを表示
- [x] Home.tsx: 帰着未入力がない場合は通常の白いカード表示を維持
- [x] Home.tsx: ページ上部にオレンジの警告バナーも表示

## Phase 21: ブラウザプッシュ通知（毎日18時・帰着未入力時）
- [x] web-pushパッケージのインストールとVAPIDキー生成
- [x] DBにpush_subscriptionsテーブルを追加（ユーザーのPush購読情報を保存）
- [x] Service Worker（sw.js）の実装（push/notificationclickイベント処理）
- [x] フロントエンド: 通知許可リクエスト・Push購読・サーバーへの購読情報送信
- [x] サーバー: Push購読の保存・削除APIを追加
- [x] サーバー: 毎日18時に帰着未入力チェック→Web Push送信のスケジューラー実装
- [x] ホーム画面に通知ON/OFFトグルを追加

## Phase 22: 記録一覧の日付順ソート＋印刷レイアウト改善
- [x] サーバー側: getDailyRecordsByCycleを日付昇順でソートして返す
- [x] 月次レポート: 印刷用CSSを追加（A4用紙・余白・フォントサイズ・改ページ最適化）
- [x] 月次レポート: 印刷時にヘッダー・ナビゲーションを非表示にする
- [x] 月次レポート: 印刷時にテーブルが複数ページにまたがる場合の罫線・ヘッダーを維持
- [x] 印刷レイアウトに確認印・承認印の欄を追加

## Phase 23: 帰着未入力バナーをクリックすると帰着フォームが自動起動
- [x] ホーム画面の帰着未入力バナーをクリックすると記録入力ページに移動（?openArrival=1クエリパラメータ付き）
- [x] DailyRecord.tsxで?openArrival=1を検知した場合、最新の帰着未入力記録の帰着フォームを自動起動
- [x] 帰着フォームが開いたら自動スクロールしてフォームが画面に表示される
- [x] ホーム画面の帰着未入力カードも同様にクリックで帰着フォーム自動起動

## Phase 24: ホーム画面カードのアイコン視認性改善
- [x] 「本日の記録を入力」カードの「＋」アイコンを白アイコン＋青背景の丸ボタン形式に変更
- [x] 「月次レポート」カードのアイコンを白アイコン＋緑背景の丸ボタン形式に変更

## Phase 25: 帰着保存後にホーム画面へ自動リダイレクト
- [x] ?openArrival=1 経由で帰着保存した場合、保存後にホーム画面へ自動リダイレクト
- [x] 通常の帰着保存（一覧の帰着ボタンから）は現在のページに留まる

## Phase 26: 月次レポート印刷版にガソリン代計算欄を追加
- [x] 印刷版最下部に「※給与計算担当者記載」の注記とガソリン代計算欄を追加
- [x] 総走行距離数は自動計算した実数値を表示
- [x] 単価・合計金額は空白の記入欄として印刷
- [x] A4 1枚に収まるよう印刷用フォントサイズ・余白を調整

## Phase 27: 印刷版から印鑑欄削除・31日分A4 1枚対応
- [x] 確認印・承認印の印鑑欄を削除
- [x] 31日分の記録でもA4 1枚に収まるよう行の高さ・フォント・余白を最小化
- [x] ガソリン代計算欄は維持

## Phase 28: ブラウザプッシュ通知テスト送信ボタン追加・自動再購読
- [x] routers.tsにpush.sendTest APIを追加（購読情報無効時はDBから自動削除）
- [x] Home.tsxに「テスト送信」ボタンを追加（通知ON時のみ表示）
- [x] 送信結果（成功/失敗）をインラインで表示（4秒後自動消去）
- [x] 購読情報無効時はエラーメッセージで再購読を促す


## Phase 29: プッシュ通知機能を完全削除
- [x] Home.tsxから通知許可バナー・通知ON/OFFトグル・テスト送信ボタンを削除
- [x] usePushNotification.tsフックを削除
- [x] server/pushScheduler.tsを削除
- [x] server/_core/index.tsからpushScheduler起動コードを削除
- [x] server/routers.tsからpushルーターを削除
- [x] client/public/sw.jsを削除

## Phase 30: 緊急修正（月次レポート・日次記録）
- [x] 月次レポートのサイクル表記がおかしい問題を修正（UTC基準のYYYY-MM-DD文字列で統一）
- [x] 月次レポートのサイクル切り替えが遅い問題を修正（currentCycle/allCyclesを並列取得・useMemoで即時反映）
- [x] 前サイクルの記録を編集できるよう日次記録ページにサイクル切り替えUIを追加
- [x] 日次記録入力画面の最上部にホームへ戻るボタンを追加

## Phase 31: 月次レポートの重複サイクル問題修正
- [x] DBの重複サイクルレコードを調査・削除（cycleId=2の15件の日次記録をcycleId=1に移行して重複サイクルを削除）
- [x] サーバー側のgetOrCreateMonthlyCycleをuserId+cycleStartDateのみで一意判定するよう修正（driverId/vehicleId変更時はUPDATE）

## Phase 32: 4月16日にサイクルが切り替わらない問題修正
- [x] サイクル判定ロジックをJST基準のYYYY-MM-DD文字列計算に全面修正（getCurrentCycle・getIncompleteCount）
- [x] getOrCreateMonthlyCycleのDB検索もYYYY-MM-DD文字列比較に変更（タイムゾーンズれ防止）
- [x] DBに4月サイクル（2026/04/16〜2026/05/15）を手動作成（userId=1）
- [x] 重複サイクルを再度一括削除

## Phase 33: 月次レポートPDFダウンロード機能
- [x] pdfkit + @types/pdfkit + NotoSansCJKjpフォントをインストール
- [x] server/pdfGenerator.tsで日本語対応のA4 PDF生成ロジックを実装
- [x] server/pdfRoutes.tsで認証付き/api/pdf/monthly-reportエンドポイントを実装
- [x] MonthlyReportに緑色のPDFダウンロードボタンを追加

## Phase 34: 印刷とPDFのレイアウト統一
- [x] pdfGenerator.tsを印刷HTMLと同じ構成に全面書き直し（タイトル・運転者名・車両番号・対象期間帯・テーブル・合計行・ガソリン代欄・フッター）

## Phase 35: JST日付管理強化（月次切り替わりの確実化）
- [x] shared/jst.tsを新規作成（todayJST/getCycleDatesForDate/getCurrentCycleDates/dateStrToNoonUTC/toDateStrを集約）
- [x] server/routers.tsをshared/jst.ts経由に全面リファクタリング（サイクル判定の重複コードを削除）
- [x] server/db.tsのgetIncompleteArrivalsByUserもJST基準に修正
- [x] monthlyCyclesテーブルに(userId, cycleStartDate)UNIQUE制約を追加（重複サイクルを事前削除）
- [x] server/jst.test.tsでサイクル判定ロジックのユニットテストを追加（15件）→全件25件パス

## Phase 36: 備考欄の追加（日次記録・月次レポート・印刷・PDF）
- [x] dailyRecordsテーブルにnotes列を追加・マイグレーション実行
- [x] server/db.tsのaddDailyRecord/updateDailyRecordにnotes対応
- [x] server/routers.tsのaddRecord/updateRecordにnotes対応
- [x] DailyRecord入力画面に備考テキストエリアを追加（出発フォーム・編集フォーム・記録カード表示）
- [x] MonthlyReportの一覧テーブルに備考列を追加
- [x] 印刷HTMLに備考列を追加（A4縦に収まるよう列幅調整）
- [x] pdfGenerator.tsに備考列を追加（A4縦に収まるよう列幅調整）

## Phase 37: 備考欄→稼働件数に変更・帰着時入力に移動
- [x] DBのnotes列をjobCount（整数型）に変更（ALTER TABLE実行）
- [x] server/db.ts・routers.ts・pdfRoutes.tsのnotes→jobCount対応
- [x] DailyRecord.tsxの出発フォームから稼働件数欄を削除
- [x] DailyRecord.tsxの帰着フォームに稼働件数（数値）入力欄を追加
- [x] DailyRecord.tsxの編集フォーム・記録カード表示も「稼働件数」に変更
- [x] MonthlyReport.tsxの列名を「稼働件数」に変更
- [x] 印刷HTMLの列名を「稼働件数」に変更
- [x] pdfGenerator.tsの列名を「稼働件数」に変更
- [x] 全テスト25件パス

## Phase 38: 出発フォームに日付手動入力欄を追加（過去日付の記録対応）
- [x] DailyRecord.tsxの出発フォームの初期日付をJST基準（todayJST()）に修正
- [x] 保存後のリセット時もtodayJST()を使用
- [x] 出発フォームに日付入力欄は既存実装済みであることを確認（初期値のUTCズレのみ修正）
- [x] 全テスト25件パス
