# Testing Guide

This project uses **vitest** for comprehensive testing of Bedrock add-on pack integrity, configuration, and compliance.

## Quick Stats

- **Test Files:** 9
- **Total Tests:** 49 ✓
- **Test Framework:** vitest v4.0.18
- **Coverage:** Pack validation & compliance focus

## Running Tests Locally

```bash
# Watch mode (re-runs on file changes)
npm run test

# CI mode (runs once, exits with code on failure)
npm run test:run

# With coverage reporting (generates HTML reports)
npm run test:coverage

# View coverage HTML report (macOS)
npm run test:coverage:report
```

## Test Categories & Coverage

### 1. Manifest Validation (5 tests)
**File:** `src/__tests__/manifest-validation.test.ts`
- Format version correctness (+2 packs)
- UUID format validation (v4 compliance)
- Version array structure [major, minor, patch]

### 2. Entity Configuration (4 tests)
**File:** `src/__tests__/entity-validation.test.ts`
- All required entity files present (9 entities)
- Despawn components for enemy memory efficiency
- Follow range optimization (16-36 range limits)
- mk: namespace prefix validation

### 3. JSON File Validation (5 tests)
**File:** `src/__tests__/json-validation.test.ts`
- Manifest parsing validation
- Entity JSON structure validation
- Spawn rule JSON validity
- Recipe JSON integrity
- All files parse without errors

### 4. Pack Compliance (3 tests)
**File:** `src/__tests__/compliance.test.ts`
- Spawn rules have `density_limit` (entity budgeting)
- Custom items use `mk:` prefix
- Language file has required keys

### 5. Armor Tier Progression (4 tests)
**File:** `src/__tests__/armor-tier.test.ts`
- All tier armor files (Page → Mega Knight)
- Blueprint recipe availability
- Valid armor durability values
- Proper enchantability settings

### 6. Performance & Constraints (7 tests)
**File:** `src/__tests__/performance.test.ts`
- Spawn rule weight optimization (<100 per rule)
- Entity follow_range limits for pathfinding efficiency
- Health values within reasonable range
- Attack damage balance (2-20)
- Movement speed constraints
- Enemy despawn for memory management
- Density limits enforced

### 7. Recipes & Loot Tables (6 tests)
**File:** `src/__tests__/recipes-loot.test.ts`
- All recipe JSON files valid
- Blueprint recipe structure validation
- Shaped recipe pattern validation
- No duplicate recipe results
- Loot table JSON validity
- Loot pool weights are positive

### 8. Items & UUID Uniqueness (9 tests)
**File:** `src/__tests__/items-uuid.test.ts`
- All items use mk: prefix
- Armor has repairable component
- Armor max stack size = 1
- Display names localized (config structure)
- Unique pack UUIDs
- Unique module UUIDs
- Different BP/RP UUIDs
- Valid icon references

### 9. Localization & i18n (6 tests)
**File:** `src/__tests__/localization.test.ts`
- Language file with pack metadata
- Valid locale file format
- Unique localization keys
- Armor localization structure ready
- Armor tier structure ready
- No hardcoded English text in JSON

## CI Integration

Tests run automatically on:
- **Push** to `main` branch
- **Pull requests** against `main` branch

### CI Workflow
1. **typecheck** job → Validates TypeScript compilation
2. **validate** job → Checks manifest/JSON structure
3. **test** job → Runs all 49 tests + coverage
4. Coverage reports uploaded to **Codecov**

## Test Configuration

- **Framework**: vitest v4.0.18
- **Environment**: Node.js
- **Globals**: Enabled (describe, it, expect)
- **Test discovery**: Automatically finds `*.test.ts` files in `src/__tests__/`
- **Excluded from build**: Test files excluded from `MegaKnights_BP/scripts/`
- **Excluded from linting**: Test files excluded from ESLint

## Coverage Reports

### Generating Coverage
```bash
npm run test:coverage
```

### Coverage Output
```
% Coverage report from v8
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
```

**Note:** These tests validate **pack configuration** (JSON), not TypeScript source code unit tests. Coverage reflects that correctly:
- 49 tests validate manifest, entities, items, recipes, spawn rules
- Tests ensure compliance with Bedrock add-on structure requirements
- Source code (systems, main.ts) is tested through game integration

## Important Notes

- All **49 tests** must pass before merging PRs
- Test files are **not compiled** to `MegaKnights_BP/scripts/` (excluded in tsconfig.json)
- Test files are **not linted** by ESLint (excluded in .eslintrc.json)
- Tests use file system access to validate generated pack content
- Coverage reports are generated in `coverage/` directory

## Writing New Tests

New tests should:
1. Be placed in `src/__tests__/` with `*.test.ts` suffix
2. Use vitest's `describe()` and `it()` functions
3. Import required utilities: `import { describe, it, expect } from "vitest"`
4. Test meaningful pack rules/compliance/structure
5. Include clear assertion messages for failures
6. Validate Bedrock pack structure expectations

### Example Test
```typescript
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Feature Name", () => {
  it("should validate something important", () => {
    const filePath = path.join(__dirname, "../../path/to/file.json");
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    
    expect(content.some_field).toBeDefined();
    expect(content.some_field).toMatch(/pattern/);
  });
});
```

## Troubleshooting

### Tests fail locally but pass in CI
- Ensure Node.js 20.x installed: `node --version`
- Delete `node_modules/` and reinstall: `npm ci`

### Coverage reports missing
- Coverage dir is gitignored by default
- Reports generated in `./coverage/` after `npm run test:coverage`

### Test file not detected
- Ensure file is in `src/__tests__/` with `.test.ts` suffix
- Run `npm run test:run` to see discovery output

