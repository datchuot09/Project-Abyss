import { Ghoul } from './enemies/Ghoul.js';
import { BoneArcher } from './enemies/BoneArcher.js';
import { AbyssMite } from './enemies/AbyssMite.js';

// Monster data picks its AI via the "ai" field; several monsters can share
// an AI with different stats/art (e.g. an elite ghoul in Phase 4).
const AI_CLASSES = {
  brute: Ghoul,
  archer: BoneArcher,
  skitter: AbyssMite
};

export function createEnemy(scene, def, x, y, ctx) {
  const Cls = AI_CLASSES[def.ai];
  if (!Cls) throw new Error(`[EnemyFactory] Unknown AI "${def.ai}" for monster "${def.id}"`);
  return new Cls(scene, x, y, def, ctx);
}
