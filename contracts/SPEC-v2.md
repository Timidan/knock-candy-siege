# Knock.sol v2: what changes from v1

Everything in [SPEC.md](SPEC.md) (v1) stays unless this file changes it: same file (`src/Knock.sol`), same tests file (`test/Knock.t.sol`). The v1 game numbers stay as named constants. Add the new numbers below as named constants too.

## Outcome numbers (pinned; the app and the relay index by them)
`TREAT 0, BOUNCE 1, TRICK 2, CLEAN 3, RAID 4, CAUGHT 5`. Keep this order.

## Delegates (session keys)
- **`setDelegate(uint256 id, address key, uint64 expiry)`:** owner only. It stores `{key, expiry, ownerAtGrant}`, and `key = address(0)` revokes. Emit `DelegateSet(id, key, expiry)`.
- **Who may act for Chog `id`:** its current owner, or `delegate.key` while `block.timestamp < expiry` and `ownerAtGrant == chog.ownerOf(id)`. That last check means a sale cancels the delegate.
- **Player actions (owner or delegate):** knock, raid, hitBoss, claimBoss, craft, setTrap, wear, and the friend clean.
- **Owner only:** setDelegate, joinCrew, stockBowl, emptyBowl and the paid self-clean.
- **Where $CHOG goes:** emptying a bowl returns its $CHOG to `chog.ownerOf(id)`. $CHOG won in treats and raids goes to the visiting Chog's own wallet (TBA), as in v1. Nothing ever goes to the delegate key.
- **"Own target" checks compare owners:** `chog.ownerOf(to) != chog.ownerOf(from)`, not `msg.sender`. Otherwise a delegate could knock on its owner's other Chogs.

## Days, activity and themed nights
- **`today = block.timestamp / 1 days`,** as in v1.
- **`activeChogs[day]`** goes up once per Chog, on its first action of the day (inside the existing day rollover).
- **`nightTheme(day)` view returns `day % 4`:**

| Value | Theme | Effect |
|---|---|---|
| 0 | QUIET | No change |
| 1 | BLOOD_MOON | Crew points double |
| 2 | CANDY_RAIN | The daily ration doubles: 10 candy and 6 eggs |
| 3 | COSTUME_NIGHT | A Chog wearing a costume it still holds gets +1 knock that night |

## Tonight's route
- **`routeOf(uint256 id, uint256 day) view returns (uint256[3])`:** three distinct token ids from 1 to 1969, none owned by the same wallet as `id`, because you can't knock on your own Chogs. Derive them from `keccak256(abi.encode(day, id, i))`, re-hashing to skip duplicates and same-owner houses.
- **Progress:** the house stores `routeDay` and `routeMask` (3 bits). In `knock` and `raid`, if `to` is one of from's stops for today, set that bit. Reset the mask when `routeDay != today`.
- **Completion:** the first time in a day the mask becomes complete (`0b111`), mint `ROUTE_BONUS_CANDY = 10` candy to from's TBA and emit `RouteCompleted(from, day)`.
- **View:** `routeProgress(id) returns (uint8 mask, uint256 day)`.

## Crews
- **`joinCrew(uint256 id, uint8 crew)`:** crew 1–4 means GHOSTS, WITCHES, PUMPKINS, BATS. Owner only, and once per Chog, with no switching. Emit `CrewJoined(id, crew)`.
- **Points:** `crewPoints[day][crew]`, earned per confirmed action by a crew member:

| Action | Points |
|---|---|
| TREAT | +1 |
| TRICK | +2 |
| RAID | +2 |
| Friend CLEAN | +1 |
| Boss hit | +damage |
| BOUNCE, CAUGHT | 0 |

  Points double on BLOOD_MOON. Chogs without a crew score nothing.
- **Winner bonus:** when a Chog rolls into a new day, if its crew had strictly the most points the day before (a tie means no winner), add 3 candy to its ration. Emit `CrewBonus(id, day - 1)`. Only Chogs that joined before today get it (`crewSince[id] < today`), so nobody can join the winners the next morning and collect.
- **Views:** `crewOf(id)`, `crewPoints(day, crew)`.

## The Great Pumpkin (a boss every night)
- **`bossHouse(day)` view:** a token id from 1 to 1969, from `keccak256(abi.encode("boss", day))`. The app draws the boss in front of that house.
- **`bossHp(day)` view:** `clamp(2 * activeChogs[day - 1], 10, 60)`. Health scales with the previous night's players, so a quiet night still gets a beatable boss.
- **`hitBoss(uint256 from, uint256 item)`:** a player action.
  - **Cost:** one knock, under the same daily limit and day rollover as `knock`. The revenge knock doesn't apply.
  - **Item:** a trick (2–4) held by from's TBA; burn it.
  - **Damage:** egg 1, toilet paper 2, mustache paint 3. Add it to `bossDamage[day]` and `damageBy[day][from]`; crew points go up by the damage.
  - **Defeat:** revert if the boss is already down that day. When the total reaches `bossHp(day)`, mark it defeated and emit `BossDefeated(day)`.
  - **Event:** emit `BossHit(from, day, damage)`.
- **`claimBoss(uint256 id, uint256 day)`:** a player action. It requires that day's boss defeated, `damageBy[day][id] > 0` and no earlier claim. Mint `min(5 + 2 * damageBy, 25)` candy to id's TBA (candy only). Emit `BossLooted(id, day, candy)`.
- **Views:** `bossState(day) returns (uint256 house, uint256 hp, uint256 damage, bool defeated)`, `damageBy(day, id)`, `claimed(day, id)`.

## Treat or raid
- **`raid(uint256 from, uint256 to)`:** a player action.
  - **Cost:** one regular knock, under the daily limit. The free revenge knock can't be used, or two players could trade free raids forever.
  - **Requirement:** to's bowl must hold candy (otherwise revert with "nothing to raid").
- **CAUGHT,** if `to` has a trap and `from` isn't wearing a ghost sheet it still holds:
  - the trap is used up;
  - up to 2 candy are burned from from's TBA and added to to's bowl;
  - `to` gets a revenge knock on `from`;
  - record the visit and emit `Knocked(from, to, 0, CAUGHT)`.
- **RAID,** otherwise:
  - take up to 3 candy from the bowl (minted to from's TBA);
  - take up to `3 * chogPerTreat` $CHOG from the bowl, into from's TBA;
  - `to` gets a revenge knock on `from`;
  - counters: `raidsLanded` for `from`, `timesRaided` for `to`;
  - record the visit and emit `Knocked(from, to, 0, RAID)`.
- **`knock` keeps v1's treat, trick and bounce rules,** plus the route, crews, themed nights and haunted houses.

## Haunted houses
- **Only in `knock`:** when the bowl is empty, the normal trap bounce does not apply, and the target has never played (`_houses[to].day == 0`), a haunted house decides the outcome. Raids, boss hits and cleans are unchanged.
- **Roll after `_useVisitKnock`:** `uint256 roll = uint256(keccak256(abi.encode(blockhash(block.number - 1), block.timestamp, from, to, visitor.knocksUsed, visitor.revengeReady))) % 100;`.
- **`roll < HAUNT_TREAT_PERCENT = 40`: TREAT.** Mint exactly 1 candy to `tba(from)`, keep the trick item, increment the target's `treatsGiven`, and score `TREAT_POINTS`. No bowl candy or $CHOG moves.
- **`roll < HAUNT_TREAT_PERCENT + HAUNT_BOUNCE_PERCENT` (60): BOUNCE.** `HAUNT_BOUNCE_PERCENT = 20`. Mark the visitor with `_mark(from, item, to)` and burn the trick item. Award no points and consume no trap, including one bypassed by a ghost.
- **Otherwise: TRICK,** with the normal mark, item burn, counters and `TRICK_POINTS`.
- Emit `Haunted(uint256 indexed from, uint256 indexed to)` whenever the haunted rule decides any of these three outcomes. Normal bowl treats, trap bounces and knocks on played houses do not emit it. Receiving visits does not wake a house; once its `day != 0`, its empty, trap-free house gives a normal TRICK.
- Route progress, crew scoring, visit records and `Knocked` apply as usual; outcome numbers remain pinned. The block-derived roll is gameplay randomness, not manipulation-resistant randomness.

## Events (the relay listens to these)
- `Knocked(from, to, item, outcome)` as in v1, with the extended outcome numbers;
- `Haunted(from, to)` for outcomes decided by a haunted house;
- `RouteCompleted(id, day)`;
- `BossHit(id, day, damage)`, `BossDefeated(day)`, `BossLooted(id, day, candy)`;
- `CrewJoined(id, crew)`, `CrewBonus(id, day)`;
- `DelegateSet(id, key, expiry)`.

## Contract size
- **v1 is 22.5 KB, and v2 will be bigger.** Turn the optimizer on (runs 200) first and report the size.
- **If it's still over 24,576 bytes,** turn off forge's size limit for tests in foundry.toml and say so. Don't edit `scripts/fork.sh`; the lead adds the anvil flag.
- **Monad mainnet's size limit must be verified** before we rely on it.

## Tests
Write one small test per feature, and keep the six v1 tests passing:
1. **Delegates:** a delegate can knock for the Chog; a transfer cancels the delegate; a delegate can't `stockBowl`; payouts go to the owner.
2. **Route:** knocking the three route houses completes the route once and mints the bonus; another route knock doesn't mint again.
3. **Crews:** points add up per outcome; the previous day's winner gets the bonus at rollover; a tie gives none.
4. **Boss:** hits lower its health; it falls at `bossHp`; a claim pays once; a hit after defeat reverts; health is 10 after a day with no activity.
5. **Raid:** RAID takes candy and $CHOG; a trap gives CAUGHT and moves candy into the bowl.
6. **Themed nights:** CANDY_RAIN doubles the ration, and COSTUME_NIGHT gives a costumed Chog an extra knock. Warp to the right day.
7. **Haunted houses:** vary visitors, days and blocks to see all three outcomes; check candy, item retention or burn, marks and `Haunted`; wake a target and verify its empty house gives TRICK without `Haunted`.
