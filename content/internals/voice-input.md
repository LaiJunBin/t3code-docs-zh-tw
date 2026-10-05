---
title: 語音輸入
source: docs/internals/voice-input.md
source_hash: 55e3007a48721a35fc0bcebdb3874a416f145a5a
---

語音轉文字編輯的是訊息輸入框（composer）裡的草稿。它不會送出一個 agent turn。音訊是 client 端暫時性的輸入，只有一般的訊息送出動作才會把轉出來的文字送出去。目前的實作是在支援的 iOS 裝置上於本機進行轉錄；由 environment 支援的轉錄尚未實作。

[共用的 controller](../../packages/client-runtime/src/voice-input/controller.ts) 擁有整個操作，client 則提供錄音和轉錄。準備階段會把 transcriber 和解析出來的語系（locale）綁定在整段錄音上。草稿的歸屬、文字和 revision 會在錄音之前先記下來，並在插入之前再檢查一次，所以晚到的轉錄結果不會蓋掉一份已經被編輯或換掉的草稿。

:::plain 晚到的結果怎麼處理
開始錄音前，先記下「現在是哪一份草稿、內容是什麼、第幾版」。轉錄結果回來、要插進去之前再比對一次；如果草稿在這段期間被改過或換掉了，就不插入。
:::

取消會立刻讓結果失效，但資源會一直被持有，直到底層的工作塵埃落定為止。Apple 的原生轉錄呼叫一旦開始就無法中斷。如果在 abort signal 觸發的當下就釋放 session 或刪除錄音，會和那項工作互相競爭。因此[轉錄合約](../../packages/client-runtime/src/voice-input/transcription.ts)要求實作必須在自己的工作停止之後才能 settle；[Apple binding](../../apps/mobile/src/native/voiceTranscription.ios.ts) 會在原生呼叫之間檢查取消狀態，並丟棄晚到的結果。
