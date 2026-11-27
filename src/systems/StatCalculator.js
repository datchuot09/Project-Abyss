// Pure final-stat computation (unit tested).
//   final = (base + sum(add)) * (1 + sum(mult))   per stat, then caps
// Buff stacks are clamped to each buff's maxStacks; stamina penalties are
// applied last as their own multipliers so they never stack with buffs wrongly.
export function computeStats(base, { buffs = {}, buffDefs = {}, stamina = null, caps = {} } = {}) {
  const add = {};
  const mult = {};
  for (const [id, stacks] of Object.entries(buffs)) {
    const def = buffDefs[id];
    if (!def?.stat || !(stacks > 0)) continue;
    const n = Math.min(stacks, def.maxStacks ?? stacks);
    const bucket = def.mode === 'add' ? add : mult;
    bucket[def.stat] = (bucket[def.stat] ?? 0) + def.value * n;
  }
  const out = { ...base };
  for (const stat of new Set([...Object.keys(add), ...Object.keys(mult)])) {
    out[stat] = ((base[stat] ?? 0) + (add[stat] ?? 0)) * (1 + (mult[stat] ?? 0));
  }
  for (const [stat, cap] of Object.entries(caps)) {
    if (out[stat] === undefined) continue;
    if (cap.max !== undefined) out[stat] = Math.min(out[stat], cap.max);
    if (cap.min !== undefined) out[stat] = Math.max(out[stat], cap.min);
    if (cap.maxOfBase !== undefined && base[stat] !== undefined) out[stat] = Math.min(out[stat], base[stat] * cap.maxOfBase);
  }
  if (out.maxHp !== undefined) out.maxHp = Math.round(out.maxHp);
  if (stamina) {
    out.outgoingMultiplier = (out.outgoingMultiplier ?? 1) * (1 - stamina.damagePenalty);
    out.movementSpeed = out.movementSpeed * (1 - stamina.speedPenalty);
  }
  return out;
}
