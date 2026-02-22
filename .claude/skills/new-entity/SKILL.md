---
name: new-entity
description: >
  Scaffold a complete new Mega Knights entity. Creates all required files:
  BP behavior JSON, RP client entity JSON, lang entries in both packs, and
  optionally spawn rules for naturally-spawning enemies. Use when the user
  wants to add a new ally or enemy entity to the add-on.
user-invocable: true
argument-hint: "<short-name> [ally|enemy] [melee|ranged]"
---

# New Entity Scaffold

Create all required files for a new Mega Knights entity.

## Arguments

$ARGUMENTS

If arguments were provided, parse them (e.g. "trebuchet_operator enemy melee"). If not, ask the user:
1. **Short name** (snake_case, no `mk_` prefix, e.g. `trebuchet_operator`)
2. **Type**: `ally` or `enemy`
3. **Combat style**: `melee` or `ranged`
4. **Display name** (Title Case, e.g. `Trebuchet Operator`)
5. **HP** (default: 30)
6. **Attack damage** (default: 5)
7. **For enemies only**: Does it spawn naturally in the world? (default: yes, if it should appear outside of siege/camp scripts)

Once you have answers, proceed to create all files without further prompting.

---

## File Creation Steps

### Variables (derive from inputs)
- `SHORT_NAME` = input (e.g. `trebuchet_operator`)
- `IDENTIFIER` = `mk:mk_<SHORT_NAME>` (e.g. `mk:mk_trebuchet_operator`)
- `DISPLAY_NAME` = input (e.g. `Trebuchet Operator`)
- `FAMILY` = `mk_ally` for allies, `mk_enemy` for enemies
- `BP_FILE` = `MegaKnights_BP/entities/mk_<SHORT_NAME>.se.json`
- `RP_FILE` = `MegaKnights_RP/entity/mk_<SHORT_NAME>.ce.json`
- `SPAWN_FILE` = `MegaKnights_BP/spawn_rules/mk_<SHORT_NAME>.json` (enemies with natural spawn only)

---

### Step 1 — BP Behavior JSON (`MegaKnights_BP/entities/mk_<SHORT_NAME>.se.json`)

**For ally entities (melee):**
```json
{
  "format_version": "1.21.40",
  "minecraft:entity": {
    "description": {
      "identifier": "mk:mk_SHORTNAME",
      "is_summonable": true,
      "is_spawnable": false,
      "is_experimental": false
    },
    "component_groups": {
      "mk:despawn": {
        "minecraft:instant_despawn": {}
      },
      "mk:mode_guard": {
        "minecraft:behavior.follow_owner": {
          "priority": 4,
          "speed_multiplier": 0.0,
          "start_distance": 9999,
          "stop_distance": 9998
        }
      },
      "mk:mode_hold": {
        "minecraft:behavior.follow_owner": {
          "priority": 4,
          "speed_multiplier": 0.0,
          "start_distance": 9999,
          "stop_distance": 9998
        },
        "minecraft:behavior.random_stroll": {
          "priority": 6,
          "speed_multiplier": 0.0,
          "interval": 99999
        }
      }
    },
    "components": {
      "minecraft:type_family": { "family": ["mk_ally", "mob"] },
      "minecraft:health": { "value": HP, "max": HP },
      "minecraft:attack": { "damage": DMG },
      "minecraft:movement": { "value": 0.3 },
      "minecraft:collision_box": { "width": 0.6, "height": 1.9 },
      "minecraft:physics": {},
      "minecraft:pushable": { "is_pushable": true, "is_pushable_by_piston": true },
      "minecraft:navigation.walk": { "can_walk": true, "avoid_water": true, "can_pass_doors": true },
      "minecraft:movement.basic": {},
      "minecraft:jump.static": {},
      "minecraft:follow_range": { "value": 16 },
      "minecraft:is_tamed": {},
      "minecraft:behavior.float": { "priority": 0 },
      "minecraft:behavior.melee_attack": { "priority": 3, "speed_multiplier": 1.2, "track_target": true, "reach_multiplier": 1.5 },
      "minecraft:behavior.follow_owner": { "priority": 4, "speed_multiplier": 1.0, "start_distance": 10, "stop_distance": 2 },
      "minecraft:behavior.random_stroll": { "priority": 6, "speed_multiplier": 0.6, "interval": 120 },
      "minecraft:behavior.random_look_around": { "priority": 7 },
      "minecraft:behavior.hurt_by_target": { "priority": 1, "entity_types": [{ "filters": { "test": "is_family", "subject": "other", "value": "mk_enemy" } }] },
      "minecraft:behavior.nearest_attackable_target": {
        "priority": 2,
        "entity_types": [{ "filters": { "test": "is_family", "subject": "other", "value": "mk_enemy" }, "max_dist": 16 }],
        "scan_interval": 10,
        "must_see": true,
        "must_see_forget_duration": 8.0
      },
      "minecraft:knockback_resistance": { "value": 0.2 },
      "minecraft:nameable": { "always_show": false, "allow_name_tag_renaming": false },
      "minecraft:despawn": { "despawn_from_distance": { "max_distance": 128, "min_distance": 96 } }
    },
    "events": {
      "minecraft:entity_spawned": {},
      "mk:despawn": { "add": { "component_groups": ["mk:despawn"] } },
      "mk:set_mode_follow": { "remove": { "component_groups": ["mk:mode_guard", "mk:mode_hold"] } },
      "mk:set_mode_guard": {
        "remove": { "component_groups": ["mk:mode_hold"] },
        "add": { "component_groups": ["mk:mode_guard"] }
      },
      "mk:set_mode_hold": {
        "remove": { "component_groups": ["mk:mode_guard"] },
        "add": { "component_groups": ["mk:mode_hold"] }
      }
    }
  }
}
```

For **ranged allies**, replace `minecraft:behavior.melee_attack` with `minecraft:behavior.ranged_attack` and add `minecraft:shooter` with an appropriate projectile.

**For enemy entities (melee):**
```json
{
  "format_version": "1.21.40",
  "minecraft:entity": {
    "description": {
      "identifier": "mk:mk_SHORTNAME",
      "is_summonable": true,
      "is_spawnable": false,
      "is_experimental": false
    },
    "component_groups": {
      "mk:despawn": {
        "minecraft:instant_despawn": {}
      },
      "mk:camp_guard": {
        "minecraft:despawn": {
          "despawn_from_distance": { "max_distance": 128, "min_distance": 96 }
        }
      }
    },
    "components": {
      "minecraft:type_family": { "family": ["mk_enemy", "monster", "mob"] },
      "minecraft:health": { "value": HP, "max": HP },
      "minecraft:attack": { "damage": DMG },
      "minecraft:movement": { "value": 0.3 },
      "minecraft:collision_box": { "width": 0.6, "height": 1.9 },
      "minecraft:physics": {},
      "minecraft:pushable": { "is_pushable": true, "is_pushable_by_piston": true },
      "minecraft:navigation.walk": { "can_walk": true, "avoid_water": true, "can_pass_doors": true },
      "minecraft:movement.basic": {},
      "minecraft:jump.static": {},
      "minecraft:follow_range": { "value": 16 },
      "minecraft:behavior.float": { "priority": 0 },
      "minecraft:behavior.melee_attack": { "priority": 3, "speed_multiplier": 1.2, "track_target": true, "reach_multiplier": 1.5 },
      "minecraft:behavior.random_stroll": { "priority": 6, "speed_multiplier": 0.8, "interval": 120 },
      "minecraft:behavior.random_look_around": { "priority": 7 },
      "minecraft:behavior.hurt_by_target": {
        "priority": 1,
        "entity_types": [{ "filters": { "any_of": [
          { "test": "is_family", "subject": "other", "value": "player" },
          { "test": "is_family", "subject": "other", "value": "mk_ally" }
        ]}}]
      },
      "minecraft:behavior.nearest_attackable_target": {
        "priority": 2,
        "scan_interval": 10,
        "entity_types": [{
          "filters": { "any_of": [
            { "test": "is_family", "subject": "other", "value": "player" },
            { "test": "is_family", "subject": "other", "value": "mk_ally" }
          ]},
          "max_dist": 16
        }],
        "must_see": true,
        "must_see_forget_duration": 8.0
      },
      "minecraft:experience_reward": { "on_death": "q.last_hit_by_player ? 10 : 0" },
      "minecraft:loot": { "table": "loot_tables/entities/mk_SHORTNAME.json" },
      "minecraft:knockback_resistance": { "value": 0.2 },
      "minecraft:despawn": { "despawn_from_distance": { "max_distance": 54, "min_distance": 32 } }
    },
    "events": {
      "minecraft:entity_spawned": {},
      "mk:despawn": { "add": { "component_groups": ["mk:despawn"] } },
      "mk:become_camp_guard": { "add": { "component_groups": ["mk:camp_guard"] } }
    }
  }
}
```

For **ranged enemies**, replace melee_attack with `minecraft:behavior.ranged_attack` and add `minecraft:shooter`.

---

### Step 2 — RP Client Entity JSON (`MegaKnights_RP/entity/mk_<SHORT_NAME>.ce.json`)

For melee humanoids (most entities):
```json
{
  "format_version": "1.10.0",
  "minecraft:client_entity": {
    "description": {
      "identifier": "mk:mk_SHORTNAME",
      "materials": { "default": "entity" },
      "textures": { "default": "textures/entity/mk_SHORTNAME" },
      "geometry": { "default": "geometry.humanoid.custom" },
      "animations": {
        "walk": "animation.humanoid.move",
        "look_at_target": "animation.humanoid.look_at_target.default",
        "idle": "animation.mk.idle",
        "attack": "animation.mk.attack_melee"
      },
      "scripts": {
        "animate": ["walk", "look_at_target", "idle", { "attack": "q.is_delayed_attacking" }]
      },
      "render_controllers": ["controller.render.mk_entity"]
    }
  }
}
```

For ranged entities, change `"attack": "animation.mk.attack_melee"` to `"animation.mk.attack_ranged"`.

> **Important**: Use `"materials": { "default": "entity" }` (opaque). Only use `entity_alphatest` if the texture requires transparency.

---

### Step 3 — Lang Entries

Add this line to **both** lang files:
- `MegaKnights_BP/texts/en_US.lang`
- `MegaKnights_RP/texts/en_US.lang`

```
entity.mk:mk_SHORTNAME.name=DISPLAY_NAME
```

Read each lang file first and append the line after the last `entity.mk:` entry to keep them organized.

---

### Step 4 — Spawn Rules (enemies with natural spawning only)

Create `MegaKnights_BP/spawn_rules/mk_<SHORT_NAME>.json`:
```json
{
  "format_version": "1.18.0",
  "minecraft:spawn_rules": {
    "description": {
      "identifier": "mk:mk_SHORTNAME",
      "population_control": "monster"
    },
    "conditions": [
      {
        "minecraft:spawns_on_surface": {},
        "minecraft:brightness_filter": { "min": 0, "max": 7, "adjust_for_weather": true },
        "minecraft:herd": { "min_size": 1, "max_size": 1 },
        "minecraft:weight": { "default": 10 },
        "minecraft:biome_filter": {
          "any_of": [
            { "test": "has_biome_tag", "value": "plains" },
            { "test": "has_biome_tag", "value": "forest" },
            { "test": "has_biome_tag", "value": "taiga" },
            { "test": "has_biome_tag", "value": "extreme_hills" }
          ]
        },
        "minecraft:density_limit": { "surface": 1 }
      }
    ]
  }
}
```

---

### Step 5 — Texture Reminder

The texture PNG is **not auto-generated** by this skill. Remind the user:
> "Create `MegaKnights_RP/textures/entity/mk_<SHORT_NAME>.png` — you can copy the closest existing texture and edit it, or run `python3 tools/generate_textures.py` if it supports this entity type."

---

### Step 6 — Build Verification

Run `npm run build` and report any TypeScript errors. The entity files are JSON-only so TS errors are unlikely, but the build validates the full project still compiles cleanly.

---

## Performance Constraints (auto-check before writing)

Before writing any file, verify the values respect Switch budget:
- `follow_range` ≤ 16 for basic mobs, ≤ 24 for elites, ≤ 32 for bosses only
- `max_dist` on `nearest_attackable_target` matches `follow_range`
- `scan_interval` ≥ 10 on all `nearest_attackable_target`
- `minecraft:density_limit` present in all spawn rules
- `minecraft:despawn` present in all enemy entities
- Material is `entity` (opaque) not `entity_alphatest` unless required

If the user provides values that violate these, warn them and suggest the correct values.

---

## Summary Output

After creating files, print a checklist showing what was created and what still needs manual work:
```
✓ MegaKnights_BP/entities/mk_<name>.se.json
✓ MegaKnights_RP/entity/mk_<name>.ce.json
✓ Lang entry added to MegaKnights_BP/texts/en_US.lang
✓ Lang entry added to MegaKnights_RP/texts/en_US.lang
✓ MegaKnights_BP/spawn_rules/mk_<name>.json  (if applicable)
⚠ MegaKnights_RP/textures/entity/mk_<name>.png — NEEDS MANUAL CREATION
⚠ MegaKnights_BP/loot_tables/entities/mk_<name>.json — NEEDS CREATION (enemies only)
```
