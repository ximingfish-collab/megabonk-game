/**
 * Weapon fire logic — determines projectiles/effects created when each weapon fires.
 */

import type { EnemyState, PlayerState, ProjectileState, WeaponType, DamageEvent } from './types.ts';
import { WEAPON_STATS } from './config.ts';
import { distanceBetween, normalizeDirection } from './physics.ts';

/**
 * Fire a weapon, returning new projectiles to add.
 * For instant-hit weapons (lightning_staff), damage events are pushed to the provided array instead.
 * For flame_ring, returns empty (handled as AOE in tick).
 */
export function fireWeapon(
  weaponType: WeaponType,
  level: number,
  playerState: PlayerState,
  enemies: EnemyState[],
  nextProjectileId: number,
  damageEvents: DamageEvent[],
  damageMultiplier: number,
  critChance: number,
  critDamage: number,
): { projectiles: ProjectileState[]; nextId: number } {
  const stats = WEAPON_STATS[weaponType][level];
  if (!stats) return { projectiles: [], nextId: nextProjectileId };

  const projectiles: ProjectileState[] = [];
  let currentId = nextProjectileId;

  switch (weaponType) {
    case 'bone_bouncer': {
      const count = stats.projectileCount;
      for (let i = 0; i < count; i++) {
        // Find nearest enemy to target
        const target = findNearestEnemy(playerState.x, playerState.z, enemies, -1);
        let vx: number;
        let vz: number;

        if (target) {
          const dir = normalizeDirection(
            target.x - playerState.x,
            target.z - playerState.z,
          );
          vx = dir.x * stats.speed;
          vz = dir.z * stats.speed;
        } else {
          // Fire in player facing direction
          vx = Math.sin(playerState.rotation + i * 0.3) * stats.speed;
          vz = Math.cos(playerState.rotation + i * 0.3) * stats.speed;
        }

        const { finalDamage } = computeDamage(stats.damage, damageMultiplier, critChance, critDamage);

        projectiles.push({
          id: currentId++,
          weaponType: 'bone_bouncer',
          x: playerState.x,
          y: 0.5,
          z: playerState.z,
          vx,
          vy: 0,
          vz,
          damage: finalDamage,
          bouncesLeft: stats.bounces,
          pierceLeft: 0,
          lifetime: 5.0,
          radius: 0.3,
          fromPlayer: true,
          hitEnemyIds: [],
        });
      }
      break;
    }

    case 'lightning_staff': {
      // Instant hit: find nearest enemy in range, chain to nearby enemies
      const primaryTarget = findNearestEnemyInRange(
        playerState.x,
        playerState.z,
        enemies,
        stats.range,
      );

      if (primaryTarget) {
        const chainTargets = findChainTargets(
          primaryTarget,
          enemies,
          stats.chains,
          stats.range * 0.6,
        );

        // Damage primary target
        const { finalDamage, isCrit } = computeDamage(stats.damage, damageMultiplier, critChance, critDamage);
        primaryTarget.hp -= finalDamage;
        primaryTarget.hitFlashTimer = 0.15;
        damageEvents.push({
          x: primaryTarget.x,
          y: 1.0,
          z: primaryTarget.z,
          damage: finalDamage,
          isCrit,
          isPlayerDamage: false,
        });

        // Damage chain targets (reduced damage per chain)
        for (let i = 0; i < chainTargets.length; i++) {
          const chainTarget = chainTargets[i];
          const chainMult = 1 - (i + 1) * 0.1; // 10% less per chain
          const { finalDamage: chainDmg, isCrit: chainCrit } = computeDamage(
            stats.damage * Math.max(0.3, chainMult),
            damageMultiplier,
            critChance,
            critDamage,
          );
          chainTarget.hp -= chainDmg;
          chainTarget.hitFlashTimer = 0.15;
          damageEvents.push({
            x: chainTarget.x,
            y: 1.0,
            z: chainTarget.z,
            damage: chainDmg,
            isCrit: chainCrit,
            isPlayerDamage: false,
          });
        }
      }
      break;
    }

    case 'flame_ring': {
      // Handled directly in game tick as AOE — returns nothing
      break;
    }

    case 'void_orb': {
      const count = stats.projectileCount;
      for (let i = 0; i < count; i++) {
        // Fire forward in player facing direction with spread
        const angleOffset = count > 1 ? (i - (count - 1) / 2) * 0.4 : 0;
        const angle = playerState.rotation + angleOffset;
        const vx = Math.sin(angle) * stats.speed;
        const vz = Math.cos(angle) * stats.speed;

        const { finalDamage } = computeDamage(stats.damage, damageMultiplier, critChance, critDamage);

        projectiles.push({
          id: currentId++,
          weaponType: 'void_orb',
          x: playerState.x,
          y: 0.5,
          z: playerState.z,
          vx,
          vy: 0,
          vz,
          damage: finalDamage,
          bouncesLeft: 0,
          pierceLeft: stats.pierce,
          lifetime: 6.0,
          radius: stats.aoeRadius,
          fromPlayer: true,
          hitEnemyIds: [],
        });
      }
      break;
    }
  }

  return { projectiles, nextId: currentId };
}

/**
 * Apply bounce logic: find next bounce target for a bone_bouncer projectile.
 * Returns the new target enemy or null if no valid target exists.
 */
export function applyBounce(
  projectile: ProjectileState,
  enemies: EnemyState[],
  bounceRange: number = 8,
): EnemyState | null {
  if (projectile.bouncesLeft <= 0) return null;

  let nearest: EnemyState | null = null;
  let nearestDist = bounceRange;

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (enemy.hp <= 0) continue;
    // Don't bounce back to an enemy we just hit
    if (projectile.hitEnemyIds.indexOf(enemy.id) !== -1) continue;

    const dist = distanceBetween(projectile.x, projectile.z, enemy.x, enemy.z);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }

  return nearest;
}

// --- Helper functions ---

function findNearestEnemy(
  x: number,
  z: number,
  enemies: EnemyState[],
  excludeId: number,
): EnemyState | null {
  let nearest: EnemyState | null = null;
  let nearestDist = Infinity;

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (enemy.hp <= 0 || enemy.id === excludeId) continue;

    const dist = distanceBetween(x, z, enemy.x, enemy.z);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }

  return nearest;
}

function findNearestEnemyInRange(
  x: number,
  z: number,
  enemies: EnemyState[],
  range: number,
): EnemyState | null {
  let nearest: EnemyState | null = null;
  let nearestDist = range;

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (enemy.hp <= 0) continue;

    const dist = distanceBetween(x, z, enemy.x, enemy.z);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }

  return nearest;
}

function findChainTargets(
  primary: EnemyState,
  enemies: EnemyState[],
  maxChains: number,
  chainRange: number,
): EnemyState[] {
  const targets: EnemyState[] = [];
  const hitIds = new Set<number>([primary.id]);
  let lastX = primary.x;
  let lastZ = primary.z;

  for (let c = 0; c < maxChains; c++) {
    let nearest: EnemyState | null = null;
    let nearestDist = chainRange;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.hp <= 0 || hitIds.has(enemy.id)) continue;

      const dist = distanceBetween(lastX, lastZ, enemy.x, enemy.z);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    if (!nearest) break;

    targets.push(nearest);
    hitIds.add(nearest.id);
    lastX = nearest.x;
    lastZ = nearest.z;
  }

  return targets;
}

function computeDamage(
  baseDamage: number,
  damageMultiplier: number,
  critChance: number,
  critDamage: number,
): { finalDamage: number; isCrit: boolean } {
  const isCrit = Math.random() < critChance;
  let finalDamage = baseDamage * damageMultiplier;
  if (isCrit) {
    finalDamage *= critDamage;
  }
  return { finalDamage: Math.round(finalDamage), isCrit };
}
