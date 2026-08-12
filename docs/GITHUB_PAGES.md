# GitHub Pages 公開手順

公開先は `fuzita-boop/vehicle_operation_app` を想定しています。GitHub Pagesは、リポジトリが非公開でも利用可能な契約であれば、公開されたサイト自体はインターネット上から閲覧可能です。機密情報や個別の移行JSONは、リポジトリや公開成果物に含めてはいけません。[1]

現在のリポジトリは非公開です。GitHub FreeでGitHub Pagesを利用する場合、公式ドキュメント上はリポジトリを公開にする必要があります。非公開のまま公開したい場合は、GitHubアカウントのプランとPagesの利用可否をGitHub上で確認してください。[2]

## 初回設定

GitHubの対象リポジトリで **Settings** → **Pages** を開き、公開元として **GitHub Actions** を選択します。リポジトリには`.github/workflows/deploy-pages.yml`を含め、`main`ブランチへの反映時に静的PWAをビルドし、生成物をPagesへデプロイする構成にします。[1]

初回公開後、GitHub Pagesの反映には数分かかる場合があります。公開URLは一般的に `https://fuzita-boop.github.io/vehicle_operation_app/` です。GitHubのPages画面に表示される **Visit site** のURLを正として確認してください。[2]

このリポジトリでは、2026年8月12日にPages設定画面で公開元を **GitHub Actions** に設定しました。以降は`main`ブランチへの更新または手動実行で`.github/workflows/deploy-pages.yml`が静的PWAを公開します。

## 参照

[1]: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site "Configuring a publishing source for your GitHub Pages site"
[2]: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site "Creating a GitHub Pages site"
