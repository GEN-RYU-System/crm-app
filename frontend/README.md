# CRM frontend source

React + Vite の開発ソースです。GAS に配布するのは `npm run build:gas` が生成する `src/ReactPoc.html` のみです。

## Commands

- `npm ci`
- `npm run build:gas`

生成物は単一HTMLであり、実行時にローカルJavaScript/CSSアセットを参照しません。Apps ScriptのDEV画面では `?page=frontend-poc` から確認します。
