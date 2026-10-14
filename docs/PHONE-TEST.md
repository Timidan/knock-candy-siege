# Phone test: about 10 minutes per phone

A checklist for the owner, on a real iPhone (Safari) and a real Android phone (Chrome). So far every check has run in desktop Chrome at a phone-sized viewport. This test is the first on real hardware.

Scan the QR code to open the game: ![QR code for https://knock.timidan.xyz](knock-qr.png)

## Before you start

- **Use this address for the test:** **https://knock.timidan.xyz/?siegeStats**. It shows a live line at the top of the game: FPS, the quality tier (Q0 is full quality, Q3 the lowest), the number of enemies, and more.
- **iPhone:** turn silent mode off. Web Audio follows the silent switch, so you may hear nothing with it on.
- **Starter-grant limit:** the Candy Bank allows three new claims per network per UTC day, and 150 across everyone. If the home network has used its three today, claim over mobile data, not home Wi-Fi, or wait until 00:00 UTC (01:00 local time, UTC+1).
- **Relay funds:** the relay had 0.00849 test ETH at 03:43 UTC on 14 Oct. At 0.0005 ETH per grant, that pays about 16 more grants. Top it up before a long test.
- **Live stats:** your test runs count on the public `/stats` page. To keep them out, turn off **Share anonymous play stats** in Settings. Leave it on for one phone if you want to check that `/stats` updates (see step 10).
- **Fresh start:** for a clean guest wallet and save, use a private tab or clear the site's data. "Try as a holder" gives each guest wallet only one Chog until the nightly reset.

## The checks

Tick each box, or write down what you saw. Rough timings are in brackets.

### 1. Audio on the first tap (1 min)

| Check | What should happen | iOS | Android |
|---|---|---|---|
| Tap **Hold the porch →**: a full tap, press and release | The menu music starts within a second or two | ☐ | ☐ |
| Start a level | The music crossfades to the level theme. Building, hits and coins have sound. | ☐ | ☐ |
| Listen through the phone speaker during a wave, and tap a few menu buttons | Tower shots, hits, enemy deaths and your own actions are clearly audible over the music. Each menu button makes a short sound. | ☐ | ☐ |
| A boss enters (Lemon Lane's last wave, or any boss; Lemon Lane unlocks when you win Rosie Row in step 5) | The boss theme plays | ☐ | ☐ |
| Pause, then **Level select** | The menu music comes back | ☐ | ☐ |
| Switch to another app, then come back | The game is paused and the sound returns | ☐ | ☐ |
| Android only: look at the notification shade | Note whether a media notification appears for the music | n/a | ☐ |

### 2. Landscape fit and safe areas (1 min)

| Check | What should happen | iOS | Android |
|---|---|---|---|
| Hold the phone upright | "Turn your phone sideways for the best view" shows | ☐ | ☐ |
| Turn it sideways, then tap **Hold the porch →** | Android goes full screen and asks for landscape. iPhone Safari shows the "Add to Home Screen" tip once. | ☐ | ☐ |
| Title, level select, hero picker | Each start button is visible without scrolling | ☐ | ☐ |
| In a level, check the corners | Nothing is cut off by the notch, the camera hole, the home bar or the browser bars: jars and candy (top left), speed and pause (top right), the portrait and spells (bottom left), the traps (bottom right) | ☐ | ☐ |
| Rotate the phone during a level | The game pauses | ☐ | ☐ |

### 3. The hero picker (1 min)

| Check | What should happen | iOS | Android |
|---|---|---|---|
| Type `1481` in **Chog #** | "★ LEGENDARY ★". The preview dresses Pepe, and the kit list shows the weapon, special, ultimate, passive, headgear and trinket. | ☐ | ☐ |
| Tap **Random** a few times | A different Chog and kit each time. The preview keeps up. | ☐ | ☐ |
| The text fields and buttons | They're easy to hit. The keyboard doesn't push the start button out of reach. | ☐ | ☐ |

### 4. Try as a holder (1 min)

| Check | What should happen | iOS | Android |
|---|---|---|---|
| Tap **Try as a holder** | "Preparing holder demo…", then a Chog number (it gives up after 20 seconds). The picker shows **HOME ADVANTAGE** and "$CHOG holder". | ☐ | ☐ |
| Tap **Let's make mischief →** | The **Your $CHOG perks** card shows +25 starting candy and +10% candy from kills, plus Home advantage | ☐ | ☐ |
| Tap **Defend the porch →** | The level starts with "Sandbox: a demo copy of Monad, nothing is real" at the top | ☐ | ☐ |

If it says "The holder demo is taking a break", note the time. The sandbox allows five tries per network per hour.

### 5. A win (3 min)

Rosie Row is the quickest. Use **SKIP** on the tutorial card, set the speed to 3×, and call waves early.

| Check | What should happen | iOS | Android |
|---|---|---|---|
| Level start | The **CHOG #… · TRAITS ACTIVE** card pops up, holds, then shrinks into the portrait | ☐ | ☐ |
| Build, upgrade, drag a trap, cast Candy Rain, move the hero | Each responds on the first touch. Drags place where your finger lifts. | ☐ | ☐ |
| Win | The stars slam in one by one, each with a sound, and the score counts up. With 3 stars, candy confetti falls. A first win shows "Night 02 unlocked!". | ☐ | ☐ |
| The result buttons | **Next night →**, **Play again** and **Level select** fit on screen | ☐ | ☐ |

### 6. Sharing the share card (30 s)

| Check | What should happen | iOS | Android |
|---|---|---|---|
| Tap **Share your night ↗** | The phone's share sheet opens with a picture. If it doesn't, **Download image** saves it. | ☐ | ☐ |
| Open the picture | Your Chog, the stars, the score, "CHOG #…" and knock.timidan.xyz. The text isn't cut off. | ☐ | ☐ |

### 7. Frame rate during Witching Hour (3 min)

The last wave of Mint Mews (wave 7) is a Witching Hour with the boss Midas. Play Mint Mews at 3× and call waves early. Mint Mews unlocks when you win Lemon Lane, so on a fresh save, win Lemon Lane after step 5. Allow extra time for that.

| Check | What should happen | iOS | Android |
|---|---|---|---|
| Watch the stats line during the biggest crowd | Write down the lowest FPS you see, and the Q tier | FPS ___ Q__ | FPS ___ Q__ |
| How it feels | Enemies move smoothly, and taps still respond at once | ☐ | ☐ |
| Witching Hour warning | Arrows flash at the screen edges without covering the buttons. Then ghosts and bats pour in from those edges. | ☐ | ☐ |
| The boss entrance | The screen letterboxes, the banner drops, then play continues | ☐ | ☐ |
| The phone after a few minutes | Note it if the phone gets hot or the frame rate sinks over time | ☐ | ☐ |

If you lose before wave 7, write down the FPS from the biggest crowd you reached. If FPS stays under 45, try **Lite mode** in Settings and note the difference.

### 8. Vibration (Android, 30 s)

| Check | What should happen | iOS | Android |
|---|---|---|---|
| Settings → **Vibration** | Android: you can turn it on, with one short test buzz. iPhone: it's greyed out with "This browser can't vibrate." | ☐ | ☐ |
| In play, with Vibration on | A short buzz when a jar is stolen, a longer pattern when a boss falls, and one when the last result star lands | n/a | ☐ |

Vibration is off by default, so turn it on first.

### 9. The starter-grant claim (1 min)

Read the limit note at the top first.

| Check | What should happen | iOS | Android |
|---|---|---|---|
| Title → **Shop** | The shop opens. Choose **Use guest wallet**. | ☐ | ☐ |
| Tap **Claim 300 $KNOCK** | "Starter grant queued". The shop checks every 5 seconds. | ☐ | ☐ |
| Wait | It changes to "✓ Starter grant paid" with a "View grant transaction ↗" link, and the balance shows 300 $KNOCK | ☐ | ☐ |

- **If it stays queued for more than a few minutes:** the relay checks for claims every 10 seconds, so it is probably paused. It pauses when it runs low on test ETH or $KNOCK, and after 60 grants in an hour or 200 in 24 hours. Note the time and the wallet address.
- **If it says the Candy Bank "has reached its limit":** that's the per-network quota.
- **If it says "Today's starter grants are gone":** the 150 claims for the UTC day are used up.
- **Each wallet can claim only once, ever.**
- **Optional:** once it's paid, buy **A sweeter start** (200 $KNOCK). This checks the permit, the purchase and on-chain ownership end to end on testnet.

### 10. Optional: live stats (30 s)

With **Share anonymous play stats** on, finish one run, then open https://knock.timidan.xyz/stats. The run should show within about a minute. A paid grant should also add to "starter grants paid".

## If something fails

Write down:

- the phone model and the OS and browser versions;
- the step;
- what you saw, with a screenshot if possible.

For a slow game, also note the FPS and Q tier from the stats line.
