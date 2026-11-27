# PROJECT ABYSS

Action Roguelite · Dark Fantasy · Pixel Art · Top-down — **Phaser 3.90 + JavaScript ES Modules + Vite 7**

> Trạng thái hiện tại: **Giai đoạn 2 – Player and Combat (hoàn thành)**. Xem [Trạng thái giai đoạn](#trạng-thái-giai-đoạn).

## Chạy dự án

Yêu cầu: Node.js ≥ 20.19.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # bản production -> dist/
npm run preview    # chạy thử bản production
npm test           # unit test (logic thuần, không cần trình duyệt)
npm run smoke      # test end-to-end trong Chromium: GĐ1 + combat/AI GĐ2 (cần Playwright, xem dưới)
npm run assets     # tạo các asset placeholder còn thiếu (không ghi đè file đã có)
```

Smoke test dùng Playwright nhưng không đưa vào dependency để bản cài nhẹ. Cài khi cần:
`npm i -D playwright && npx playwright install chromium`, sau đó `npm run smoke` (dev) hoặc
`npm run build && npm run smoke -- --prod` (production). Thêm `--shots <thư mục>` để lưu ảnh chụp.

### Điều khiển

| Phím | Hành động |
|---|---|
| WASD / Mũi tên / D-pad / Left stick | Di chuyển (giữ > 0.45s để chạy) |
| Chuột | Ngắm (tay cầm: right stick; chỉ bàn phím: ngắm theo hướng nhìn) |
| Chuột trái / RT | Chém kiếm – combo 3 đòn, đòn 3 mạnh và đẩy lùi xa |
| Chuột phải / LT | Arcane Bolt – đạn phép (sát thương phép, hồi chiêu 0.7s) |
| Space / A | Lộn tránh (i-frame 0.24s, huỷ được phần hồi đòn của nhát chém) |
| Enter / Space / A | Chọn trong menu; "Rise again" khi gục ngã |
| F11 | Bật/tắt fullscreen |
| F3 | Debug overlay (FPS, scale, vị trí, trạng thái, HP, số quái, hitbox) |
| ESC | Về Main Menu (tạm thời, đến khi có Pause Menu) |

Bảng phím đầy đủ theo thiết kế (Q/E/R, I, F…) có trong `src/data/inputBindings.js`, remap qua
`InputManager.rebind()`; Q/E/R/I/F chưa có chức năng (xem trạng thái).

## Kiến trúc

```
public/
  assets/            PNG/XML thật, nạp qua manifest (thay bằng file Aseprite cùng tên là dùng được ngay)
  data/
    asset-manifest.json   Khai báo mọi asset, nhóm "core", danh sách nhân vật, floors, animation dùng chung
    characters/*.json     Chỉ số, hitbox, sprite, animation, combo/dodge/cast của nhân vật (data-driven)
    monsters/*.json       Chỉ số, AI (brute/archer/skitter), tầm phát hiện, đòn đánh, kỹ năng của quái
    skills/projectiles.json  Tốc độ, bán kính va chạm, thời gian sống, hiệu ứng của đạn
    dungeons/*.json       Tilemap định dạng Tiled (mở/sửa trực tiếp bằng Tiled)
src/
  core/      constants, EventBus, Events, SceneKeys, SceneRouter, PixelScaler, math, services
  managers/  AssetManager, InputManager, DisplayManager, SettingsManager
  world/     DungeonMap (Tiled), MapValidator, FlowField (thuần), Navigation, CameraController, LightingLayer
  systems/   DamageCalculator, Health, StateMachine (thuần), CombatSystem, ProjectileSystem, EffectsSystem
  entities/  Combatant (nền chung), Player, Enemy (AI nền), enemies/ (Ghoul, BoneArcher, AbyssMite), EnemyFactory
  ui/        HUD (avatar + HP), MenuList, DebugOverlay, theme
  scenes/    Boot, Preload, MainMenu, Loading, Dungeon (+ index.js đăng ký scene)
  data/      inputBindings (bảng phím mặc định)
tools/       generate-placeholder-assets.mjs (+ art/), smoke-test.mjs (+ e2e/combat.mjs)
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

### Chiến đấu
- **Một điểm vào duy nhất cho sát thương:** `CombatSystem.applyHit` → `calculateDamage` (thuần) →
  `Health` (thuần). Công thức: `base × hệ số ± 10%`, chí mạng × critMultiplier, giảm theo
  `defense / (defense + 40)` (tối đa 75%), `damageReduction` (tối đa 80%), tối thiểu 1.
- **Va chạm thật:** hitbox cận chiến là hình quạt (bán kính + góc) kiểm tra với *physics body* của mục
  tiêu (circle-vs-AABB + góc); mỗi hitbox trúng một mục tiêu tối đa một lần. Đạn là Arcade body, va
  chạm tường và hurtbox, được pooling (tối đa 96).
- **Player:** máy trạng thái move / attack / cast / dodge / hit / dead; input buffer giữ lệnh đánh trong
  suốt nhát chém; không lao xuyên qua kẻ địch; i-frame khi lộn và sau khi trúng đòn.
- **AI quái (mỗi loại một hành vi):**
  - *Ghoul* (brute): đuổi → báo hiệu đỏ 0.45s → lao cắn (super armor) → hồi; dưới 40% HP gầm (skill
    Frenzy) và nhanh hơn.
  - *Bone Archer* (archer): giữ khoảng cách, lùi theo flow field khi bị áp sát, đi ngang khi nạp tên,
    ngắm có vạch báo hiệu; mỗi phát thứ 3 là loạt 3 mũi (skill Volley).
  - *Abyss Mite* (skitter): lượn vòng quanh người chơi, rung báo hiệu rồi lao xuyên qua.
  - Trạng thái chung: Idle, Patrol, Alert (Detect), Chase, Attack, Skill, Retreat, Hit, Death, Return.
- **Dẫn đường:** một flow field Dijkstra 8 hướng (không cắt góc) hướng về người chơi, dùng chung cho mọi
  quái, tính lại tối đa 5 lần/giây; đi thẳng khi có đường thông (kiểm tra theo bề rộng thân), tách đàn,
  tự phát hiện và gỡ kẹt; quái mất dấu theo *khoảng cách đường đi*, không theo đường chim bay.

### Asset placeholder
`tools/generate-placeholder-assets.mjs` vẽ pixel art gốc (không dùng tài nguyên có bản quyền):
nhân vật "The Wanderer" 24×24 (idle/walk × 3 hướng), tileset dungeon 16×16, đuốc động, ánh sáng,
font bitmap pixel tự thiết kế, và tilemap thử nghiệm. Đây là **placeholder có tổ chức cho giai đoạn
phát triển**; Giai đoạn 10 thay bằng art hoàn chỉnh. Script không ghi đè file đã tồn tại trừ khi `--force`.

## Trạng thái giai đoạn

### Giai đoạn 1 – Core Framework ✅
Scene flow, Asset/Input/Display Manager, tilemap Tiled có kiểm tra spawn, di chuyển + camera,
pixel-perfect integer scaling + letterbox + fullscreen, Loading Screen, ánh sáng cơ bản.

### Giai đoạn 2 – Player and Combat ✅
| Hạng mục | Trạng thái |
|---|---|
| Player: animation idle/walk/run/attack/cast/dodge/hit/death × 3 hướng | Xong |
| Tấn công: combo kiếm 3 đòn theo hướng ngắm + Arcane Bolt (đạn phép) | Xong |
| Dodge roll với i-frame, cooldown, huỷ phần hồi đòn | Xong |
| Hitbox/Hurtbox thật, Knockback, Hitstun, Invincibility Frames, Projectile | Xong |
| Sát thương vật lý/phép, chí mạng, phòng thủ, giảm sát thương (data-driven) | Xong |
| Enemy AI: 3 loại hành vi khác nhau, có Skill/Retreat, dẫn đường tránh vật cản, gỡ kẹt | Xong |
| HUD: avatar + thanh HP (vệt sát thương, cảnh báo HP thấp) | Xong (EXP/Stamina ở GĐ3) |
| Hiệu ứng: số sát thương, chí mạng, hit flash, screen shake, tia lửa, vệt chém, vệt đạn, nổ khi chết | Xong |
| Gục ngã: animation chết → màn "You have fallen" → Enter chơi lại tầng | Bản tạm (Game Over + kết liễu ở GĐ3) |
| Thông báo khi dọn sạch quái | Xong (điều kiện Clear phòng ở GĐ4) |

### Chưa triển khai (theo lộ trình)
- Kỹ năng Q/E, Ultimate R, Skill Tree: chưa có (GĐ9 cho Skill Tree; kỹ năng chủ động sẽ thêm cùng
  hệ thống kỹ năng). Inventory (I), tương tác (F): GĐ5/GĐ4.
- Elemental Damage và Status Effects (Burn, Slow, Freeze…): trường `element` đã có trong dữ liệu
  sát thương, hiệu ứng triển khai cùng Resonance ở GĐ6.
- Death Sequence đầy đủ (quái kết liễu, máu) và GameOverScene: GĐ3. EXP/Level Up/Stamina: GĐ3.
- Scene Hub, Boss, Victory: GĐ8/9. Âm thanh: GĐ10. Save: GĐ11. Electron/Capacitor: GĐ12.

### Hạn chế đã biết
- Quái chỉ có sprite một hướng (lật trái/phải). Art vẫn là placeholder tự vẽ, hoàn thiện ở GĐ10.
- Ngắm bằng tay cầm (right stick) đã viết nhưng chưa kiểm thử với tay cầm thật (môi trường test không có).
- Nhân vật vẽ đè lên khối cột khi đứng phía trên cột; tường hai bên chưa có viền (GĐ4/GĐ10).
