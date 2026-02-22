---
name: new-item
description: >
  Scaffold a complete new Mega Knights item. Creates all required files:
  BP item JSON, item_texture.json registration, and lang entries in both
  packs. Use when the user wants to add a new tool, scroll, token, or
  other custom item to the add-on.
user-invocable: true
argument-hint: "<short-name> [display name]"
---

# New Item Scaffold

Create all required files for a new Mega Knights item.

## Arguments

$ARGUMENTS

If arguments were provided, parse them (e.g. "siege_horn Siege Horn"). If not, ask the user:
1. **Short name** (snake_case, no `mk_` prefix, e.g. `siege_horn`)
2. **Display name** (Title Case, e.g. `Siege Horn`)
3. **Max stack size** (default: 1 — most MK items are unique)
4. **Category** in creative menu: `items`, `equipment`, or `nature` (default: `items`)
5. **On-use behavior?** Does this item do something when used (right-clicked)? If yes, describe it briefly so the skill can decide whether to add `minecraft:use_duration` and remind the user to wire a scriptevent handler.

Once you have answers, proceed without further prompting.

---

## File Creation Steps

### Variables (derive from inputs)
- `SHORT_NAME` = input without `mk_` prefix (e.g. `siege_horn`)
- `IDENTIFIER` = `mk:mk_<SHORT_NAME>` (e.g. `mk:mk_siege_horn`)
- `ICON_KEY` = `mk_<SHORT_NAME>` (e.g. `mk_siege_horn`) — used in item_texture.json and minecraft:icon
- `TEXTURE_PATH` = `textures/items/<SHORT_NAME>` (no extension — Bedrock appends .png automatically)
- `DISPLAY_NAME` = input (e.g. `Siege Horn`)

---

### Step 1 — BP Item JSON (`MegaKnights_BP/items/tools/mk_<SHORT_NAME>.json`)

Base template for a non-wearable tool/scroll/token:
```json
{
  "format_version": "1.21.40",
  "minecraft:item": {
    "description": {
      "identifier": "mk:mk_SHORTNAME",
      "menu_category": {
        "category": "CATEGORY"
      }
    },
    "components": {
      "minecraft:icon": "mk_SHORTNAME",
      "minecraft:display_name": {
        "value": "item.mk:mk_SHORTNAME.name"
      },
      "minecraft:max_stack_size": STACKSIZE
    }
  }
}
```

If the item has **on-use behavior** (triggers a scriptevent or ability when right-clicked), also add:
```json
"minecraft:use_duration": 1.6,
"minecraft:use_animation": "eat"
```

> Do NOT add `minecraft:food` — the `eat` animation is used for activation feedback without making the item consumable.

---

### Step 2 — item_texture.json Registration

Read `MegaKnights_RP/textures/item_texture.json`.

Find the `"texture_data"` object and add a new entry. Keep entries alphabetical by key if possible:
```json
"mk_SHORTNAME": {
  "textures": "textures/items/SHORTNAME"
}
```

Note: The key is `ICON_KEY` (e.g. `mk_siege_horn`). The texture path has no file extension.

Use the Edit tool for a surgical insertion — do not rewrite the whole file.

---

### Step 3 — Lang Entries

Add this line to **both** lang files:
- `MegaKnights_BP/texts/en_US.lang`
- `MegaKnights_RP/texts/en_US.lang`

```
item.mk:mk_SHORTNAME.name=DISPLAY_NAME
```

Read each file first, then append after the last `item.mk:` entry to keep it organized.

---

### Step 4 — Texture Reminder

The texture PNG is not created by this skill. Remind the user:
> "Create `MegaKnights_RP/textures/items/<SHORT_NAME>.png` (16×16 or 32×32 px). You can copy the closest existing item texture as a starting point."

---

### Step 5 — On-Use Handler (if applicable)

If the item has on-use behavior, remind the user:
> "Wire up the handler in the relevant system file. Listen for `ItemUseOnBeforeEvent` or `ItemUseBeforeEvent` in `src/systems/<SystemName>.ts`, check `event.item.typeId === 'mk:mk_<SHORT_NAME>'`, then call `system.run(() => { ... })` for any world mutations."

---

### Step 6 — Build Verification

Run `npm run build` and report the result. Item files are JSON-only so TS errors are unlikely, but the build confirms the project still compiles cleanly.

---

## Summary Output

After creating files, print a checklist:
```
✓ MegaKnights_BP/items/tools/mk_<name>.json
✓ item_texture.json — entry added for mk_<name>
✓ Lang entry added to MegaKnights_BP/texts/en_US.lang
✓ Lang entry added to MegaKnights_RP/texts/en_US.lang
⚠ MegaKnights_RP/textures/items/<name>.png — NEEDS MANUAL CREATION
⚠ On-use handler — NEEDS WIRING IN SYSTEM FILE  (if applicable)
```
