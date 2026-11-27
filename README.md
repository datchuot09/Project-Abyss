# PROJECT ABYSS

Action Roguelite · Dark Fantasy · Pixel Art · Top-down — **Phaser 3.90 + JavaScript ES Modules + Vite 7**

> Trạng thái hiện tại: **Giai đoạn 1 – Core Framework (hoàn thành)**. Xem [Trạng thái giai đoạn](#trạng-thái-giai-đoạn).

## Chạy dự án

Yêu cầu: Node.js ≥ 20.19.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # bản production -> dist/
npm run preview    # chạy thử bản production
npm test           # unit test (logic thuần, không cần trình duyệt)
npm run smoke      # test end-to-end trong Chromium (cần Playwright, xem dưới)
npm run assets     # tạo các asset placeholder còn thiếu (không ghi đè file đã có)
```

Smoke test dùng Playwright nhưng không đưa vào dependency để bản cài nhẹ. Cài khi cần:
`npm i -D playwright && npx playwright install chromium`, sau đó `npm run smoke` (dev) hoặc
`npm run build && npm run smoke -- --prod` (production). Thêm `--shots <thư mục>` để lưu ảnh chụp.

### Điều khiển (Giai đoạn 1)

| Phím | Hành động |
|---|---|
| WASD / Mũi tên / D-pad / Left stick | Di chuyển |
| Enter / Space / Gamepad A | Chọn trong menu |
| F11 | Bật/tắt fullscreen |
| F3 | Debug overlay (FPS, renderer, scale, vị trí, tile, hitbox) |
| ESC | Về Main Menu (tạm thời, đến khi có Pause Menu) |

Toàn bộ bảng phím theo thiết kế (chuột trái/phải, Q/E/R, I, F…) đã được khai báo trong
`src/data/inputBindings.js` và có thể remap qua `InputManager.rebind()` (lưu vào LocalStorage);
các action chiến đấu chỉ có tác dụng từ Giai đoạn 2.

## Kiến trúc

```
public/
  assets/            PNG/XML thật, nạp qua manifest (thay bằng file Aseprite cùng tên là dùng được ngay)
  data/
    asset-manifest.json   Khai báo mọi asset, nhóm "core", danh sách nhân vật, floors, animation dùng chung
    characters/*.json     Chỉ số, hitbox, sprite, animation của từng nhân vật (data-driven)
    dungeons/*.json       Tilemap định dạng Tiled (mở/sửa trực tiếp bằng Tiled)
src/
  core/      constants, EventBus, Events, SceneKeys, SceneRouter, PixelScaler, math, services
  managers/  AssetManager, InputManager, DisplayManager, SettingsManager
  world/     DungeonMap (Tiled), MapValidator (thuần), CameraController, LightingLayer
  entities/  Player
  ui/        MenuList, DebugOverlay, theme
  scenes/    Boot, Preload, MainMenu, Loading, Dungeon (+ index.js đăng ký scene)
  data/      inputBindings (bảng phím mặc định)
tools/       generate-placeholder-assets.mjs, smoke-test.mjs
tests/       unit test (node:test)
```

Nguyên tắc:
- **Không phụ thuộc vòng tròn.** Hệ thống giao tiếp qua `EventBus` + hằng `Events`; singleton
  (settings, display) lấy qua `core/services.js`, không import `main.js`.
- **Data-driven.** Thêm nhân vật = thêm JSON + spritesheet + 1 dòng trong manifest; không sửa code.
- **Logic thuần tách khỏi Phaser** (`PixelScaler`, `math`, `MapValidator`) nên kiểm thử được bằng Node.
- **Không rò rỉ khi đổi scene.** `listen()` và `InputManager` tự huỷ khi scene shutdown; AssetManager
  bỏ qua asset đã có trong cache và có `releaseFloor()` để giải phóng dữ liệu tầng cũ.

### Hiển thị pixel-perfect
- Độ phân giải logic 480×270, `pixelArt: true`, `roundPixels`, canvas `image-rendering: pixelated`.
- `DisplayManager` chọn hệ số phóng **nguyên theo pixel vật lý** (có tính `devicePixelRatio`) và
  letterbox phần dư; không bao giờ kéo giãn méo hình. Tuỳ chọn "Fit Screen" cho phép phóng lẻ.
- Tileset được extrude 1px (margin 1, spacing 2) để không bị lem viền ở mọi mức zoom.

### Tilemap
`DungeonMap` yêu cầu các layer: `Floor`, `Decor`, `Walls` (tile có thuộc tính bool `collides`),
`Spawns` (object: `player_spawn`, `enemy_spawn`, `exit`), `Lights` (object `torch`).
Khi nạp, map được kiểm tra: mọi điểm spawn phải nằm trên ô đi được và tới được từ `player_spawn`;
nếu spawn nằm trong vật cản sẽ tự dời sang ô an toàn gần nhất và ghi cảnh báo.

### Asset placeholder
`tools/generate-placeholder-assets.mjs` vẽ pixel art gốc (không dùng tài nguyên có bản quyền):
nhân vật "The Wanderer" 24×24 (idle/walk × 3 hướng), tileset dungeon 16×16, đuốc động, ánh sáng,
font bitmap pixel tự thiết kế, và tilemap thử nghiệm. Đây là **placeholder có tổ chức cho giai đoạn
phát triển**; Giai đoạn 10 thay bằng art hoàn chỉnh. Script không ghi đè file đã tồn tại trừ khi `--force`.

## Trạng thái giai đoạn

### Giai đoạn 1 – Core Framework ✅
| Hạng mục | Trạng thái |
|---|---|
| Phaser 3 + Vite, cấu trúc thư mục | Xong |
| Scene Management (Boot → Preload → MainMenu → Loading → Dungeon, chuyển cảnh fade) | Xong |
| Asset Manager (manifest, cache-aware, release theo tầng) | Xong |
| Input Manager (action, remap + lưu, keyboard/mouse/gamepad, API cho touch) | Xong |
| Dungeon Tilemap thử nghiệm (Tiled JSON, va chạm, kiểm tra spawn) | Xong |
| Player di chuyển (gia tốc, chuẩn hoá đường chéo, 3 hướng + lật, idle/walk) | Xong |
| Camera follow (bounds, deadzone, round pixels) | Xong |
| Pixel-perfect rendering, integer scaling + letterbox, fullscreen, resize | Xong |
| Loading Screen (tên tầng, mô tả, progress + spinner góc dưới phải) | Xong |
| Ánh sáng cơ bản (ambient, đuốc nhấp nháy, đèn quanh nhân vật) | Bản cơ bản (hoàn thiện ở GĐ 10) |

### Chưa triển khai (theo lộ trình)
- Scene `HubScene`, `BossScene`, `GameOverScene`, `VictoryScene`: đã giữ key trong `SceneKeys.js`,
  **chưa đăng ký** — sẽ làm ở GĐ 3/8/9.
- Animation Run/Attack/Skill/Dodge/Hit/Death, chiến đấu, quái vật, AI: GĐ 2.
- HUD (HP/EXP/Stamina), Pause Menu, Settings UI (remap phím, âm lượng): GĐ 3 và GĐ 16-UI.
- Âm thanh: GĐ 10. Save IndexedDB: GĐ 11. Electron/Capacitor: GĐ 12.

### Hạn chế đã biết
- Nhân vật luôn vẽ đè lên khối cột khi đứng phía trên cột (chưa có layer "overhead"); xử lý cùng y-sort
  môi trường ở GĐ 4.
- Tường hai bên chưa có cạnh viền riêng (chỉ có mặt tường phía Nam); sẽ có tileset autotile ở GĐ 10.
- Fullscreen chọn bằng phím Enter trong menu và F11 đều hoạt động; trên một số trình duyệt nhúng có thể
  bị từ chối — khi đó game ghi cảnh báo và giữ nguyên chế độ cửa sổ.
