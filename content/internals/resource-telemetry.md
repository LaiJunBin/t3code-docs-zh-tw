---
title: 資源遙測
source: docs/internals/resource-telemetry.md
source_hash: 3ce3a60719489e24cb6e74dffb7c99684b70764c
---

行程的計數器來自一個使用 `sysinfo` 的[獨立 Rust monitor](../../native/resource-monitor/src/main.rs)。Electron main 提供 host 的電源資訊和 Electron 行程的指標。把原生的收集工作放在 Node 之外，可以隔離收集器的當機，也避免了 Node / Electron addon 的 ABI 組合矩陣。Desktop 和 CLI 的 server 使用相同的子行程協定。收集器不存在或失敗時，server 仍然會繼續執行。

:::plain 為什麼另外寫一支 Rust 程式
收集各個行程計數器的工作，交給一支獨立的小程式去做，server 把它當成子行程啟動、透過協定跟它拿資料。這樣它當掉不會拖垮 server，也不必為各種 Node 和 Electron 版本各自編譯原生 addon。沒有這支程式時，server 照常運作，只是少了這些數字。
:::

## 收集的成本 {#collection-cost}

取樣和有界的記憶體內歷史紀錄由原生子行程負責。Server 只有在診斷功能（diagnostics）有即時訂閱者時，才會要求連續的 snapshot；歷史紀錄則是需要時才抓取。為了背景排程而取用 host 電源資訊，不可以讓即時診斷一直維持開啟。沒有遙測資料庫，也沒有定期執行 shell 探測的 fallback。

歷史紀錄在時間長度、snapshot 數量、行程列數和保留的位元組數上，各有獨立的上限。當命令列的長度各不相同時，光靠數量上限並不能限制記憶體用量。因此，很大的行程樹會縮短可用的歷史時間範圍。Linux 的 task 列舉是停用的，因為走訪每一個 `/proc/<pid>/task/<tid>` 目錄，會讓取樣本身變得很昂貴。

Electron 的電源更新是透過私有的、繼承而來的 pipe 傳送，和 renderer 的連線無關。診斷功能關閉時，電源 event 和慢速的 heartbeat 仍然會繼續；`app.getAppMetrics()` 只在有即時需求時才執行。接收端的過期期限（stale deadline）必須超過「設定中最慢的 heartbeat 加上排程的寬限時間」，否則刻意安排的閒置輪詢，會讓背景政策在受限與不受限兩種狀態之間來回擺盪。Headless server 會讓無法取得的電源資料維持未知。

## 量測上的陷阱 {#measurement-traps}

- 行程的身分包含啟動時間，因為作業系統會重複使用 PID。Electron 和原生端的啟動時間精確度不同，所以合併時容許一個小的誤差。對行程送訊號時，會用一次新的取樣重新檢查原生端的身分。
- Snapshot 的序號屬於某一個 monitor 世代（generation）。跨重啟去比較序號，會把新 monitor 的取樣都丟掉，直到它的序號追上來為止。
- 取樣可能會漏掉在兩次取樣之間啟動又結束的行程。對於跨越多次取樣都有觀察到的行程，累計計數器仍然能算出差值（delta）。
- Windows 的行程 I/O 包含的不只是磁碟流量。Unix 的計數器回報的是儲存裝置 I/O，因為作業系統有快取，它可能和應用程式邏輯上的讀寫量不同。請把自行埋點量到的邏輯 I/O 和這些計數器分開。
- 群組的總計是從遙測啟動之後觀察到的差值累加而來。個別行程的累計計數器，涵蓋的則是該行程在作業系統裡的整個存活期間。
- 歷史重播使用的是原生的取樣，不含目前的 Electron CPU 或記憶體指標。把最新的 Electron 數值合併進去，會蓋掉過去的資料。

:::plain 為什麼不能只用 PID 認行程
一個行程結束之後，作業系統之後可能把同一個 PID 發給另一個全新的行程。只看 PID 的話，會把兩個不相干的行程當成同一個。所以這裡用「PID 加上啟動時間」來認；要對行程送訊號之前，還會重新取樣確認一次，避免送錯對象。
:::

WSL backend 需要一個 Linux 版的 monitor，即使 Electron 是在 Windows 上執行也一樣。Windows 的 desktop 套件目前只提供 Windows 的執行檔，所以 WSL backend 的原生行程遙測無法使用。繼承而來的 Electron 電源資料來源仍然可以運作。
