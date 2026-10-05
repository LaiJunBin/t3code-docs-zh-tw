# T3 Code 中文文件（非官方）

[T3 Code](https://github.com/pingdotgg/t3code) 官方英文文件的繁體中文翻譯，另外加上給新手的範例與說明。

網站：<https://laijunbin.github.io/t3code-docs-zh-tw/>

## 請先留意

- **非官方。** 與 T3 Code 的維護者無關，也不由他們提供支援。
- **由 AI 翻譯並補充，未經逐頁人工校對。** 可能有錯誤，請以英文原文為準。每一頁下方都有原文的連結。
- **可能已經過時。** 譯文依據的是 upstream 的某一個 commit（記在 `site.config.mjs` 的 `upstream`，網站首頁下方也會顯示）。T3 Code 還在早期版本，變動很快。
- 標示「本站補充」的區塊不在原文裡，網站右上角的「補充」按鈕可以把它們全部隱藏。

發現翻譯錯誤，歡迎開 issue 或直接送 PR。

## 建置

不需要安裝任何套件，只要有 Node 和一份 upstream 的 checkout：

```bash
git clone https://github.com/pingdotgg/t3code ../t3code
git -C ../t3code checkout "$(node -p "require('node:fs').readFileSync('site.config.mjs','utf8').match(/upstream: \"(\w+)\"/)[1]")"

node build.mjs          # 產生 dist/，開 dist/index.html 即可瀏覽
node build.mjs status   # 列出尚未翻譯、或原文已更新的頁面
node build.mjs stamp content/user/install.md   # 譯文更新後，記錄它對應的原文版本
```

upstream 放在別的位置時，用 `T3CODE_REPO=/path/to/t3code node build.mjs`。

建置需要 upstream，是為了檢查譯文對應的原文是否還在、是否已更新，以及文件裡指向原始碼的連結是否有效。

## 目錄

| 路徑              | 內容                                                              |
| ----------------- | ----------------------------------------------------------------- |
| `content/`        | 繁中 Markdown。路徑與 upstream 的 `docs/` 一對一；`guide/` 是本站自己寫的。 |
| `screenshots/`    | 截圖。檔名對上 `:::screenshot 名稱` 才會顯示；還沒有圖的位置不會出現在頁面上。 |
| `theme/`          | 樣式與前端腳本。                                                  |
| `site.config.mjs` | 側邊欄的分組與順序，以及譯文依據的 upstream commit。              |
| `TRANSLATING.md`  | 翻譯與補充的規範。                                                |
| `dist/`           | 產生的網站，不進版控；由 GitHub Actions 建置並部署到 GitHub Pages。 |

## 跟上 upstream

1. 把 upstream 的 checkout 更新到新的 commit，執行 `node build.mjs status` 看哪些頁面的原文變了。
2. 對照 `git -C ../t3code diff <舊 commit>..HEAD -- docs/<檔案>` 更新譯文。
3. `node build.mjs stamp <譯文檔>`，把 `site.config.mjs` 的 `upstream` 改成新的 commit，再 `node build.mjs`。

## 授權

原文 © T3 Tools Inc.，以 MIT 授權釋出。譯文、補充內容與網站產生器同樣以 MIT 授權釋出，見 [LICENSE](LICENSE)。
