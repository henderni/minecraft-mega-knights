# Microsoft Marketplace Submission Checklist

Use this checklist when preparing Mega Knights for submission to the Microsoft Bedrock Marketplace.

## Pre-Submission Testing

### Platform Testing

- [ ] Tested on Nintendo Switch (primary target)
- [ ] Tested on Windows 10/11
- [ ] Tested on mobile (iOS/Android) if possible
- [ ] No crashes during 100-day progression
- [ ] No crashes during final siege
- [ ] No console errors in `/reload`
- [ ] All in-game commands work (`/scriptevent mk:*`)

### Content Validation

- [ ] All manifests have unique UUIDs
- [ ] Manifest versions bumped to [1, 0, 1] or higher
- [ ] `min_engine_version` set to [1, 21, 50]
- [ ] All JSON files validate (run `npm run build`)
- [ ] All entity spawn rules have `minecraft:density_limit`
- [ ] All enemy entities have `minecraft:despawn` component
- [ ] No placeholder or debug assets
- [ ] No third-party IP or copyrighted content

### Gameplay Testing

- [ ] `/scriptevent mk:start` initializes successfully
- [ ] Day progression works smoothly
- [ ] Armor tier unlocks at correct days (5, 20, 40, 60, 85)
- [ ] Army recruitment works at 30% rate
- [ ] Castle structures place correctly
- [ ] Milestone raids trigger as scheduled
- [ ] Day 100 siege completes with boss fight
- [ ] Progress persists across world reloads
- [ ] Entity count stays under 40 (normal), 60 (siege), 80 (max)

### Performance Validation

- [ ] Frame rate stays above 20 FPS on Switch during siege
- [ ] No input lag during combat
- [ ] No pathfinding stalls (units standing still)
- [ ] No visible stuttering during army recruitment

### Multiplayer Testing (if applicable)

- [ ] Works with multiple players
- [ ] Army ownership tracked correctly per player
- [ ] HUD updates don't cause desync
- [ ] No conflicts with overlapping scoreboard data

## Store Assets

### Required

- [ ] **Icon** (256×256 PNG)
  - Clear, recognizable Mega Knights imagery
  - Legible at small sizes
  - File: `/store/icon.png`

- [ ] **Screenshots** (3-5 minimum)
  - 1920×1080 resolution minimum
  - Show progression (Page → Mega Knight armor)
  - Show army units
  - Show castle structures
  - Show siege battle
  - Files: `/store/screenshots/screenshot_1.png` through `_5.png`

### Optional

- [ ] **Promotional Banner** (1920×800 or higher)
  - Catch eye on storefront
  - File: `/store/banner.png`

## Store Listing Information

### Title

```text
Mega Knights - 100-Day Knight Progression
```

### Short Description (1-2 sentences)

```text
Command an army and build your empire in this 100-day medieval progression add-on. 
Rise from Page to Mega Knight, recruit allies, and survive the final siege.
```

### Full Description (3-5 paragraphs)

Include:

- Core gameplay loop
- Progression system (5 armor tiers)
- Army/castle mechanics
- Key milestone events
- Target audience (all ages, adventure/strategy)

### Category

- Adventure / Progression / RPG

### Age Rating

- [ ] PEGI 3 / ESRB E (All audiences)
- Reason: Medieval fantasy combat, no graphic violence

### Supported Platforms

- [x] Windows 10/11
- [x] Nintendo Switch
- [x] Mobile (iOS/Android)
- [x] Xbox
- [x] PlayStation
- [x] Dedicated Server

### System Requirements

- Minecraft Bedrock 1.21.50 or higher
- ~50 MB available storage
- Sufficient RAM for entity rendering (especially on older devices)

### Key Features (Bullet list)

- 100-day timed progression quest
- 5 armor tiers with unique stats
- Army recruitment system (30% chance from defeated enemies)
- 3 castle structures with capacity bonuses
- Dynamic milestone events
- 5-wave final siege + boss battle
- 8 unique custom entity types (allies + enemies)
- Debug console commands for testing

## Publishing Workflow

### 1. Creator Portal Setup

- [ ] Create Microsoft account if needed
- [ ] Register on [Microsoft Minecraft Creator Portal](https://www.minecraft.net/creator/)
- [ ] Accept Creator Agreement
- [ ] Complete identity verification
- [ ] Set payment method (if monetized)

### 2. Create Store Listing

- [ ] Upload icon (256×256 PNG)
- [ ] Upload 3-5 screenshots
- [ ] Fill in all metadata fields
- [ ] Write store description
- [ ] Set age rating
- [ ] Select supported platforms
- [ ] Set pricing (free or paid)

### 3. Upload Content

- [ ] Run `npm run package` to generate `.mcaddon`
- [ ] Upload `.mcaddon` file
- [ ] Verify file size (should be under 200 MB)
- [ ] Creator Portal validates pack

### 4. Expert Review

- [ ] Submit for review (wait 1-2 weeks)
- [ ] Monitor email for feedback/rejections
- [ ] Address any issues and resubmit
- [ ] Once approved, content goes live

## Content Policies

Ensure compliance with Microsoft Bedrock guidelines:

- ✓ No real-money gambling or loot boxes
- ✓ No misleading content or clickbait
- ✓ No hate speech, discrimination, or offensive content
- ✓ No copyright/trademark violations
- ✓ No exploits or unintended game-breaking mechanics
- ✓ Age rating accurately reflects content
- ✓ Performance acceptable on all platforms

## Post-Submission Update Process

When releasing updates:

1. Update version in both manifests:

   ```json
   "version": [1, 0, 1]
   ```

2. Update README.md with changelog

3. Run `npm run package` to create new `.mcaddon`

4. Resubmit through Creator Portal

5. Wait for review (~1-2 weeks)

## Support & Troubleshooting

**If rejected or flagged:**

- Check email from Creator Portal for specific issues
- Review content policies above
- Make corrections and resubmit
- Contact Microsoft Creator Support if unclear

**Regional Availability:**

- Marketplace is not available in all regions
- Can still distribute directly via `.mcaddon` file to worldwide audience
- Direct distribution: No approval but full control

## Common Rejection Reasons

- [ ] Pack size too large (split if needed)
- [ ] Performance issues on low-end devices
- [ ] Missing or low-quality store assets
- [ ] Confusing/misleading description
- [ ] Bugs on specific platform (usually Switch)
- [ ] Content policy violation
- [ ] Copied content/inadequate unique features

## Approval Pathways

### Direct Distribution (No Approval)

- Create `.mcaddon`
- Upload to website, Discord, or GitHub releases
- Users download and install manually
- Instant availability worldwide

### Marketplace (Requires Approval)

- Submit through Creator Portal
- Wait 1-2 weeks for review
- More visibility but regional limitations
- Revenue sharing if monetized

---

**Last Updated**: February 18, 2026
**Contact**: See SECURITY.md for support inquiries
