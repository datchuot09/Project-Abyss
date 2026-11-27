# PROJECT ABYSS

Action Roguelite · Dark Fantasy · Pixel Art · Top-down — **Phaser 3.90 + JavaScript ES Modules + Vite 7**

> Trạng thái hiện tại: **Giai đoạn 3 – HUD, EXP, Stamina, Level Up, Game Over (hoàn thành)**, kèm kỹ năng Q/E/R và hiệu ứng trạng thái. Xem [Trạng thái giai đoạn](#trạng-thái-giai-đoạn).

## Chạy dự án

Yêu cầu: Node.js ≥ 20.19.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # bản production -> dist/
npm run preview    # chạy thử bản production
npm test           # unit test (logic thuần, không cần trình duyệt)
npm run smoke      # test end-to-end trong Chromium: GĐ1-3 (cần Playwright, xem dưới)
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
| Q / LB | Rune Rush – lướt xuyên kẻ địch, gây sát thương vật lý, bất tử khi lướt (hồi 6s) |
| E / RB | Frost Sigil – ấn phù băng tại điểm ngắm, nổ AOE: sát thương băng + Slow, 30% Freeze (hồi 9s) |
| R / Y | Abyssal Eclipse (Ultimate) – tụ lực rồi nổ bóng tối quanh người: sát thương lớn + Stun (hồi 40s) |
| ESC / Start | Pause Menu (Resume / Abandon Run) |
| Enter / Space / A | Chọn trong menu, chọn buff khi lên cấp |
| A/D hoặc chuột | Chuyển giữa các thẻ buff |
| F11 | Bật/tắt fullscreen |
| F3 | Debug overlay (FPS, scale, vị trí, trạng thái, HP, số quái, hitbox) |

Bảng phím đầy đủ có trong `src/data/inputBindings.js`, remap qua `InputManager.rebind()`.
I (Inventory) và F (Interact) chưa có chức năng (GĐ5/GĐ4).

## Kiến trúc

```
public/
  assets/            PNG/XML thật, nạp qua manifest (thay bằng file Aseprite cùng tên là dùng được ngay)
  data/
    asset-manifest.json   Khai báo mọi asset, nhóm "core", danh sách nhân vật, floors, animation dùng chung
    characters/*.json     Chỉ số, hitbox, sprite, animation, combo/dodge/cast của nhân vật (data-driven)
    monsters/*.json       Chỉ số, AI (brute/archer/skitter), tầm phát hiện, đòn đánh, kỹ năng của quái
    skills/projectiles.json  Tốc độ, bán kính va chạm, thời gian sống, hiệu ứng của đạn
    skills/status_effects.json  Burn, Poison, Slow, Freeze, Stun, Root (loại, thời lượng tối đa, miễn nhiễm)
    progression/levels.json     Đường cong EXP: expToNext = round(20 × level^1.35)
    progression/buffs.json      9 buff khi lên cấp (giá trị, số stack tối đa) + giới hạn chỉ số
    progression/stamina.json    Các mốc Stamina và hình phạt
    dungeons/*.json       Tilemap định dạng Tiled (mở/sửa trực tiếp bằng Tiled)
src/
  core/      constants, EventBus, Events, SceneKeys, SceneRouter, PixelScaler, math, services
  managers/  AssetManager, InputManager, DisplayManager, SettingsManager
  world/     DungeonMap (Tiled), MapValidator, FlowField (thuần), Navigation, CameraController, LightingLayer
  systems/   DamageCalculator, Health, StateMachine, StatusEffects, Stamina, StatCalculator, RunState (thuần),
             CombatSystem, ProjectileSystem, EffectsSystem
  managers/  … + RunManager (điểm duy nhất thay đổi EXP / buff / Stamina)
  entities/  Combatant (nền chung), Player, Enemy (AI nền), enemies/ (Ghoul, BoneArcher, AbyssMite), EnemyFactory
  ui/        HUD (avatar, HP/EXP/Stamina, buff, thanh kỹ năng, overlay kiệt sức), MenuList, DebugOverlay, theme
  scenes/    … + LevelUpScene, PauseScene (overlay), GameOverScene
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

### Tiến trình trong Run (GĐ3)
- **EXP:** hạ quái nhận EXP (Ghoul 12, Archer 10, Mite 6). Đủ EXP → game **tạm dừng**, hiện 3 buff ngẫu nhiên
  (không trùng, không hiện buff đã đầy stack), chọn 1, áp dụng ngay rồi chơi tiếp; nhiều cấp cùng lúc được
  xử lý lần lượt. Buff chỉ tồn tại trong Run.
- **Chỉ số cuối:** `(gốc + tổng cộng) × (1 + tổng %)` cho từng chỉ số, stack bị giới hạn theo `maxStacks`, sau đó
  áp giới hạn (Attack Speed ≤ 1.6, Crit ≤ 50%, CDR ≤ 40%, Move Speed ≤ 130% gốc). Max HP tăng thì hồi phần chênh.
- **Stamina** (mục 5.3) – chỉ thay đổi qua `RunManager.changeStamina()`, sát thương thường **không** làm giảm:

  | Stamina | Hiệu ứng |
  |---|---|
  | > 50 (kể cả 50) | Bình thường |
  | < 50 | −30% sát thương gây ra |
  | ≤ 0 | −50% sát thương (thay thế mức −30%, không cộng dồn) |
  | ≤ −50 | thêm −20% tốc độ di chuyển |
  | ≤ −100 | viền đỏ nhấp nháy 4 góc + vết nứt màn hình, duy trì khi tiếp tục âm |

  "Giảm 30 / 50 sát thương" trong spec được hiểu là **phần trăm** (trừ thẳng 30 điểm sẽ đưa mọi đòn về 0);
  đổi trong `stamina.json` nếu cần. Các nguồn làm giảm Stamina (bẫy, lời nguyền, bàn thờ) đến ở GĐ4/GĐ7.
- **Trạng thái:** áp lại thì làm mới thời gian (lấy dài hơn) và giữ mức mạnh hơn – không cộng dồn; Freeze/Stun
  có 2s miễn nhiễm sau khi hết để không bị khống chế liên hoàn; DoT bỏ qua i-frame nhưng không gây khựng.
- **Cái chết (mục 5.4):** nhân vật ngã → quái vừa hạ gục thực hiện đòn kết liễu theo loại (Ghoul cắn xé,
  Archer bắn phát kết liễu, Mite đục khoét) kèm máu và vũng máu → Game Over với tóm tắt Run → "Rise Again"
  bắt đầu Run mới.

## Trạng thái giai đoạn

### Giai đoạn 1 – Core Framework ✅
Scene flow, Asset/Input/Display Manager, tilemap Tiled có kiểm tra spawn, di chuyển + camera,
pixel-perfect integer scaling + letterbox + fullscreen, Loading Screen, ánh sáng cơ bản.

### Giai đoạn 2 – Player and Combat ✅
Combo kiếm, Arcane Bolt, dodge i-frame, hitbox/hurtbox thật, knockback/hitstun, sát thương vật lý/phép/chí
mạng/phòng thủ, 3 AI quái riêng biệt (Ghoul, Bone Archer, Abyss Mite) có dẫn đường tránh vật cản; bổ sung ở
lượt này: **kỹ năng Q/E/R + Ultimate, sát thương nguyên tố, hiệu ứng trạng thái, AOE**.

### Giai đoạn 3 – HUD ✅
| Hạng mục | Trạng thái |
|---|---|
| HUD góc trên trái: avatar + cấp, thanh HP, EXP, Stamina | Xong |
| HP: animation giảm máu, cảnh báo HP thấp, Death Sequence khi về 0 | Xong |
| EXP từ quái, Level Up tạm dừng game, 3 buff chọn 1, stacking + giới hạn | Xong |
| Stamina với đủ các mốc, hình phạt tính đúng, overlay ≤ −100 | Xong |
| Death Sequence: kết liễu theo loại quái + máu, Game Over + tóm tắt Run | Xong |
| Pause Menu (ESC) | Xong |
| Thanh kỹ năng + hồi chiêu, hàng buff đang có | Xong |

### Chưa triển khai (theo lộ trình)
- Nguồn trừ Stamina (bẫy GĐ4, lời nguyền/bàn thờ GĐ7); EXP từ Boss/Event (GĐ7/GĐ8).
- HP/Stamina mang sang tầng tiếp theo: lưu trong RunState khi có chuyển tầng (GĐ4).
- Resonance theo nguyên tố (GĐ6) – hệ nguyên tố và trạng thái đã sẵn sàng để dùng.
- Inventory (I), tương tác (F), phòng/rương (GĐ4–5); Skill Tree & nâng cấp vĩnh viễn (GĐ9).
- Scene Hub, Boss, Victory (GĐ8/9); âm thanh (GĐ10); Save IndexedDB, lưu kết quả Run (GĐ11); Electron (GĐ12).

### Hạn chế đã biết
- Quái chỉ có sprite một hướng (lật trái/phải). Art vẫn là placeholder tự vẽ, hoàn thiện ở GĐ10.
- Ngắm bằng tay cầm (right stick) và nút tay cầm cho Q/E/R đã viết nhưng chưa kiểm thử với tay cầm thật.
- Nhân vật vẽ đè lên khối cột khi đứng phía trên cột; tường hai bên chưa có viền (GĐ4/GĐ10).
