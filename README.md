# IQA Learning

## ローカル確認

```bash
npm install
npm run dev
```

ブラウザで `http://127.0.0.1:5174/` を開くと確認できます。

別の開発サーバーが同じポートを使っている場合は、Viteが `5175` など次のポートを表示します。その場合はターミナルに表示されたURLを開いてください。

## よく使うデモアカウント

- 開発者: `dev@iqa-learning.example` / `dev12345`
- メンター: `mentor@iqa-learning.example` / `mentor123`
- 受講者: `learner@iqa-learning.example` / `learner1`

## 開発中のリセット

画面の状態はブラウザのlocalStorageに保存されます。設定を初期状態で見直したいときは、開発者ツールからlocalStorageの `iqa_learning_` で始まるキーを削除してください。

## VPSへの自動デプロイ

`main` ブランチへpushすると、GitHub Actionsがビルドして `dist/` の内容をVPSへ同期します。

GitHubリポジトリの `Settings` → `Secrets and variables` → `Actions` に以下を登録してください。

- `VPS_HOST`: `85.131.248.107`
- `VPS_PORT`: SSHポート。未設定の場合は `22`
- `VPS_USER`: `root`
- `VPS_SSH_KEY`: VPSへ接続できるデプロイ用秘密鍵
- `VPS_TARGET_DIR`: `/var/www/iqa-learning`

初回だけVPS側でWebサーバーの公開先を設定します。

```bash
apt update
apt install -y nginx rsync

mkdir -p /var/www/iqa-learning

cat > /etc/nginx/sites-available/iqa-learning.eclo.info <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name iqa-learning.eclo.info;

    root /var/www/iqa-learning;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:css|js|mjs|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$ {
        try_files $uri =404;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

ln -sfn /etc/nginx/sites-available/iqa-learning.eclo.info /etc/nginx/sites-enabled/iqa-learning.eclo.info
nginx -t
systemctl reload nginx
```
