---
title: Composer 的座標與序列化
nav: Composer 座標
source: docs/internals/composer-editors.md
source_hash: 6ed0a8c2f7bf93cada361953d71f47478a8515a3
---

草稿 store 擁有 Markdown，而 Tiptap 擁有編輯中的文件。Rich-text 設定會改變安裝的 extension，所以切換這個設定時，會依照儲存的草稿重新掛載編輯器。純文字（plain）模式必須讓格式標記維持字面上的樣子。Rich 模式會保留空白和 chip 的原始文字，但會把支援的分隔符號正規化（`__` 變成 `**`、`_` 變成 `*`），核取方塊的大小寫也一樣（`[X]` 變成 `[x]`）。

Store 的游標位置不是 ProseMirror 的 position：收合（collapsed）座標把一個 chip 算成一個字元，展開（expanded）座標計算的是 chip 的原始文字，而 ProseMirror 還會把區塊邊界也算進去。請把轉換邏輯留在[文件模型](../../apps/web/src/composer-rich-text-doc.ts)裡。空段落雖然沒有文字，仍然需要真正的游標（caret）位置。顯示在已套用樣式的文字旁邊的標記是 decoration，所以落在它們裡面的位移會被夾到文字的邊緣。

:::plain 同一個游標，三種算法
訊息輸入框（composer）裡的同一個位置，會有三種不同的數字：

- 收合座標：一個 chip 只算 1 個字元。
- 展開座標：chip 要算它背後那整段原始文字的長度。
- ProseMirror position：除了文字，段落這類區塊的邊界也佔位置。

三者不能混用。需要換算時，一律走文件模型那個檔案，不要在別處自己加減。
:::

只有在受控的文字（controlled text）改變時，才替換編輯器的內容。為了移動游標而替換內容，會產生 undo 紀錄，並重新產生引用（citation）的身分。等待中的引用 popover 必須等到所要求的草稿已經進到編輯器之後，才去找它的 chip。

Rich 模式的 task 項目（帶核取方塊的清單項目）透過編輯器原生的 command 來分割，這樣 mark 和 chip 才能保留下來。字面清單則使用 [store 編輯](../../apps/web/src/composer-list-continuation.ts)。換行會變成段落分割：否則結尾的 hard break 會讓人覺得好像要按兩次才有效。由程式移動游標時，必須明確地把游標捲動到可見範圍內。

剪貼簿的文字必須來自 Markdown serializer，不能來自 DOM 文字：chip 的 label 省略了原始文字，而標記的 decoration 並不是內容。有結構化的 context record 可用時，它們會跟著那段文字一起放進剪貼簿。貼上時會補完結尾的 chip 分隔符號，並且在把 chip 直接插入到文字後面時，在前面加上一個邊界。
