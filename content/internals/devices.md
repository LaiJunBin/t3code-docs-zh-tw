---
title: 裝置
source: docs/internals/devices.md
source_hash: 7a082c17e150d3a9010d92458994a04cf7080ed9
---

Environment server 擁有模擬器（simulator 與 emulator）的方式，和它擁有終端機的方式一樣：探索、串流和 agent 的存取全都在那裡執行，每個 client 都是透過 environment 連線來使用它們。正因如此，Device 面板才能在 Tailscale 和 T3 Connect 上運作，包括由一台 SSH host 來執行裝置的情況。

## 兩個外部工具，一個接縫 {#two-external-tools-one-seam}

[expo-device-hub](../../apps/server/src/device/LocalDeviceHost.ts) 負責串流，[agent-device](../../apps/server/src/device/AgentDeviceShim.ts) 負責操作。兩者都是在 Device 面板裡各自對應的同意步驟完成之後，用 npm 以固定的版本安裝到 T3 home 裡。手動設定只會安裝並啟動 expo-device-hub；在授予 agent 存取權之前，agent-device 都不會安裝，也不會啟動。兩者都用 server 的 Node 來執行；如果用 `npx`，重新開機後的第一次 `device_open` 就得依賴 registry。Hub 是一個受監管的子行程，而不是被 import 進來的 middleware，因為 serve-sim 會透過一個原生 addon 載入私有的 CoreSimulator framework，而那裡當掉時不可以把 server 一起拖垮。

:::plain 兩個工具的分工
expo-device-hub 負責把模擬器的畫面送給你看；agent-device 是讓 agent 能夠操作模擬器的 CLI。前者在你同意使用裝置功能後就會裝，後者要等你另外同意讓 agent 存取才會裝。
:::

所有和平台相關的東西都放在 [`DeviceHost`](../../apps/server/src/device/DeviceHost.ts) 後面。Service、proxy 和 MCP 工具只會看到一個 hub origin 和一個 agent-device endpoint。SSH host 會把這兩個 endpoint 都轉送到 server 的 loopback。每個被代理的請求也都帶著 host id；光靠 device id 並不能在跨 host 時保證唯一。

## Hub 絕不對外公開 {#the-hub-is-never-exposed}

serve-sim 有一個可以執行 shell 的 route，它的 token 可以從它自己那個不需驗證的 `/api` 讀到；而 serve-emu 的動作 route 則完全沒有驗證。Hub 只綁定 loopback，唯一的入口是 [proxy](../../apps/server/src/device/DeviceHubProxy.ts)。Proxy 用允許清單（allowlist）只放行串流、設定和截圖的 route，並把每個請求都當成 environment session 來驗證。`<img>` 和 `WebSocket` 無法帶 header，所以 proxy 的驗證方式和 `/ws` upgrade 一樣：用 cookie，或是一張短效的 `wsTicket`，由 bearer 和 DPoP client 透過已驗證的 HTTP 取得。這張 ticket 會在請求到達 hub 之前被移除。

串流的回應帶有 `Cache-Control: no-transform`；否則壓縮用的 middleware 會去緩衝一個永遠不會結束的 MJPEG body。在瀏覽器開發模式下，Vite proxy 必須為 `/api` 轉送 WebSocket upgrade，而不是只轉送 `/ws`。

## 裝置設定絕不經過 hub {#device-settings-never-go-through-the-hub}

serve-sim 的預覽畫面是透過同一條 exec 通道送出 shell 指令，來驅動它的 Tools 面板。代理這條通道，即使加上允許清單，也等於把 host 上的任意指令執行能力交給任何一個 environment session，所以 T3 不這麼做。[`device.action`](../../apps/server/src/device/DeviceActions.ts) RPC 會透過 `DeviceHostReady.run`，自己去執行底層的 `simctl`、`adb` 和 serve-sim 的 helper 執行檔，每個控制項對應一個具型別的 action，並回傳它讀回來的設定。Proxy 的允許清單只會新增讀取用的 route（accessibility tree、前景 app、event log），而且除了截圖和串流調校之外，一律拒絕非 GET 的 method。

:::note 想加一個新的裝置控制項時
不要去代理 hub 的 exec route。做法是在 `device.action` 裡加一個具型別的 action，由 server 自己執行對應的工具。
:::

## Agent 透過 CLI 來操作 {#agents-drive-through-the-cli}

`device_*` 工具組刻意只有四個工具：list、open、screenshot 和 close。實際的操作是透過 `agent-device` CLI 進行的，它具備 agent 需要的語意化 snapshot 模型，而且會隨著它自己的發行版本保持更新。T3 會在 Provider 的 PATH 前面加上一個 shim 目錄。即使 environment server 本身無法執行模擬器，這個 CLI 還是會安裝在那台 server 上。Host 則是需要時才啟動。

那個環境在 Provider 子行程 spawn 的時候就固定下來了，所以 [`prepareMcpSession`](../../apps/server/src/orchestration-v2/ProviderSessionManager.ts) 只有在裝置支援和 agent 存取都已啟用、session 具有 `device` 能力、而且這台機器至少能執行一種平台時，才會啟動 agent-device。如果等到 `device_open` 才啟動，已經在執行的 agent 就會沒有這個 CLI 可用。

「怎麼操作裝置」的說明是由 `device_open` 回傳的，而不是放在一段永遠載入的 prompt 或 skill 裡：這樣在從來不開裝置的 Thread 裡不會有任何成本，也不會和固定版本的 CLI 產生落差。永遠啟用的那段 prompt 只有幾行，指向這些工具，並說明優先使用它們而不是直接用 `simctl` 和 `adb`；後兩者仍然可以用在工具沒有涵蓋的地方。

## Viewer 同時解碼兩種 vendored 協定 {#the-viewer-decodes-both-vendored-protocols}

Hub 內含（vendor）了兩個串流 server，它們的 wire format 不同。iOS 的影像是一個由 AVCC envelope 組成的 HTTP body，用 WebCodecs 解碼，輸入則走另一條二進位的 WebSocket；Android 則是把 SEMU 封裝的 H.264 和 JSON 手勢多工在同一條 WebSocket 上。[`deviceStream.ts`](../../apps/web/src/components/device/deviceStream.ts) 兩種都會講，所以一個面板就能涵蓋兩個平台。

模擬器編碼出來的是 H.264 High 5.1。有些機器上的硬體解碼器和所有 headless 瀏覽器都會拒絕這個 profile，而且 WebCodecs 只能在 secure context 裡使用，所以 viewer 會用 `isConfigSupported` 探測，在 iOS 上退而改用 MJPEG endpoint。Android 沒有 MJPEG；在那種情況下，面板會回報它無法解碼。
