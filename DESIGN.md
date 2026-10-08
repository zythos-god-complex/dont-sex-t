# GoofyAhhTalk: design direction

One sentence: **a candy-bright sticker toybox with Instagram-DM-level craft.** Goofy in personality, precise in execution. It should feel like a toy you want to poke, not a template.

## Non-negotiables

- No explanatory or instructional copy. Labels, placeholders, states only. Lowercase. Short. Funny where it is free.
- Never use the em dash or en dash characters anywhere.
- No AI slop: no purple/indigo default gradients, no gradient text, no glassmorphism crutch, no sparkle emoji, no emoji as UI icons, no Inter/Roboto/Poppins, no uniform card soup with soft grey shadows, no centered marketing hero.
- Everything live must *look* live: presence dots breathe, arrivals pop in, leavers shrink out, typing dots bounce, counts tick.
- 60 fps. Animate `transform` and `opacity` only. Respect `prefers-reduced-motion` (swap motion for fades).
- Phones first (thumb zone, safe areas, keyboard), then a real desktop layout (not a stretched phone).

## Signature element: Goofy Faces

Every user is a procedurally generated **goofy face** derived from a hash of their lowercase username (same name, same face, everywhere). Built as pure SVG (`src/ui/GoofyFace.tsx`), deterministic, cheap.

- **Blob**: one of ~8 squishy silhouettes (rounded square, bean, egg, cloud-ish, wobbly circle, tall pill, wide pill, lumpy star), drawn on a 100x100 viewBox, filled with one color from the face palette, with a 3px darker-ink outline at ~12% opacity for sticker crispness.
- **Eyes**: googly eyes (white sclera, ink pupil). Variants: equal pair, mismatched sizes, one squint, three eyes (rare), sleepy half-lids, wide shocked. Pupils sit at an offset that can be driven by props (`look={{x,y}}` in -1..1) so faces can look at things. Optional blink (scaleY on lids every 3 to 7 s, random per face, off when reduced motion).
- **Mouth**: grin, tiny o, wavy, tongue out, teeth, smirk, big D, flat line. Optional extras: blush cheeks, freckles, single tooth, antenna, sprout leaf, eyebrows.
- **Palette** (blob fills; all must keep the ink features readable): `#FFC83D` butter, `#FF8A3D` tangerine, `#FF5C7A` watermelon, `#FF9ECF` bubblegum, `#B6E35A` lime, `#4FD1A5` mint, `#5BC0FF` sky, `#8FA8FF` periwinkle, `#C69CFF` lilac, `#FFB4A2` peach, `#9EE6E0` aqua, `#F2E8CF` oat.
- Sizes used: 28 (inline), 40 (rows, header), 56 (lobby list desktop), 96 to 120 (lobby cards), 160 to 200 (onboarding hero, empty states).
- On onboarding the hero face is generated live from what you type and its pupils track the caret / pointer. It reacts: mouth opens while typing, shocked eyes on `username_taken`, big grin when valid.
- Presence dot sits bottom-right of the face: 26% of the face size, `--online` color, 3px ring in the surface color, gentle breathing scale (1 to 1.12, 2.4 s). Away = hollow ring in `--muted`.

## Brand tokens (app chrome)

Chrome follows the system color scheme. Chat surfaces follow the chat theme (below).

```css
:root {
  --bg: #FBF5EC;            /* warm cream paper */
  --bg-2: #F4ECDF;          /* sunken areas, input wells */
  --surface: #FFFFFF;
  --ink: #17131F;           /* text, primary buttons */
  --ink-2: #5E5869;         /* secondary text */
  --muted: #A39CAE;
  --line: #EADFCF;          /* hairlines */
  --accent: #FF5C39;        /* goofy tangerine-red: badges, primary moments */
  --accent-ink: #FFFFFF;
  --sun: #FFC83D;           /* highlight, stickers */
  --online: #1FCB6B;
  --male: #3E8BFF;
  --female: #FF4FA0;
  --danger: #E5383B;
  --shadow-pop: 0 1px 0 rgba(23,19,31,.06), 0 8px 24px -8px rgba(23,19,31,.18);
  --r-sm: 12px; --r-md: 18px; --r-lg: 26px; --r-xl: 34px; --r-pill: 999px;
  --ease-out: cubic-bezier(.2,.8,.2,1);
  --ease-spring: cubic-bezier(.34,1.56,.64,1);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121016; --bg-2: #1A171F; --surface: #1F1B25; --ink: #F6F1EA; --ink-2: #B9B2C3;
    --muted: #6F6879; --line: #2B2632; --shadow-pop: 0 1px 0 rgba(0,0,0,.4), 0 10px 30px -10px rgba(0,0,0,.6);
  }
}
```

- **Type**: `Bricolage Grotesque Variable` (self-hosted via `@fontsource-variable/bricolage-grotesque`) for the wordmark, headings, names, buttons, labels. Use its width/weight personality: wordmark 800, headings 700, names 650, UI labels 600. Chat message text uses the system stack (`ui-sans-serif, -apple-system, system-ui, "Segoe UI", sans-serif`) at 16px/1.35 for native-feeling readability and zero font-swap on the hottest path. Numbers use `font-variant-numeric: tabular-nums`.
- **Scale**: 12 / 13 / 15 / 17 / 20 / 24 / 32 / 44 / 64. Tight letter spacing on big sizes (-0.02em to -0.035em).
- **Wordmark**: `goofy` + `ahh` + `talk` in Bricolage 800. `ahh` sits inside a little sun-yellow sticker pill rotated -6deg with a 2px ink outline, slightly overlapping, like a sticker slapped on. Never a gradient.
- **Icons**: custom inline SVG set in `src/ui/icons.tsx`, 24px grid, 2.25px stroke, round caps and joins, slightly chunky and friendly. Needed: back (chevron), send (paper plane, tilted), dm (chat bubble with tail), gear, bell, bell-off, check, check-double, close, arrow-right, male symbol, female symbol, smile, more. Filled variants for active states where useful.
- **Surfaces**: cream background, white sheets and rows. Depth comes from color steps and `--shadow-pop` only on floating things (sheets, toasts, composer). Hairline `--line` separators. Big friendly radii.
- **Buttons**: primary = `--ink` pill, `--bg` text, 52 to 56px tall on mobile, Bricolage 700. Pressed: scale .96 with a spring back. Accent variant for the hero start button: `--accent` fill with a 0 4px 0 darker-accent "toy" bottom edge that compresses on press (translateY 3px, edge shrinks). Icon buttons: 44px hit area minimum, round, `--bg-2` on hover/press.
- **Focus**: 3px `--sun` ring with 2px offset, keyboard only (`:focus-visible`).

## Motion

- Default spring: `{ type: 'spring', stiffness: 520, damping: 34, mass: 0.8 }`. Gentle spring for large things (sheets): stiffness 380, damping 36.
- Arrivals in lists: pop from scale .85 + y 12 + opacity 0, staggered 30 ms. Departures: scale .8 + opacity 0 then height collapse (layout animation so neighbours slide).
- Message bubbles: mine slide in from bottom-right (x 12, y 8, scale .96); theirs from bottom-left. 160 to 220 ms feel.
- Typing indicator: three dots, each bouncing (y -4px) staggered 120 ms, 1.1 s loop, inside a peer-colored bubble that grows in.
- Filter tabs: sliding pill indicator with `layoutId`.
- Mobile screen transitions: push = new screen slides from right 100% with the old one parallaxing -25% and dimming; pop reverses. Desktop: crossfade + 8px slide.
- Theme change: the chat background crossfades (400 ms) and bubbles re-tint via CSS variable transition.
- Haptic-feeling micro feedback: buttons squish, toggles overshoot slightly, badges pop (scale 1.3 to 1) when counts increase.

## Layout

### Mobile (< 960px)
Screens: onboarding, lobby (home), inbox, chat. One at a time. Headers are compact (56px + safe-area-top), sticky, cream with a hairline on scroll. Primary actions within the bottom 40% of the screen when possible.

### Desktop (>= 960px)
Two panes in a centered app frame (max 1280px wide, full height, 20px gutter from the window edge on big screens, rounded `--r-xl` frame with `--shadow-pop` on a slightly darker cream backdrop):
- **Left rail, 360px**: wordmark + me (face + name) at top, then the **dms** list (inbox) filling the column.
- **Main pane**: route `/` shows the **live** board (lobby grid of face cards, filter tabs at top). Route `/dm/:username` shows the chat. A small "live" button in the chat header area or rail returns to the board.

## Screens

### 1. Onboarding (`/` without a session)
- Background: cream with a few faces of people who are online right now (from lobby presence) floating slowly and bobbing at the edges (desktop: more of them; mobile: 3 to 4, low opacity, small). If nobody is online, a couple of decorative random faces.
- Top: live counter pill `● 7 online` (dot breathes; number ticks when it changes). Hidden when nobody is online.
- Center stack: hero GoofyFace (160 mobile / 200 desktop) generated from the current input (or a default face while empty), wordmark under it.
- Form (bottom-weighted on mobile): one big input (`pick a username`), 60px tall, `--surface`, `--r-lg`, Bricolage 600 20px, centered text, max 20 chars; live validation (invalid chars are simply rejected as you type). Below: two big gender chips side by side (`♂ male`, `♀ female` using the icon set, not text glyphs), selected chip fills with its gender color and the face winks. Then the accent **start** button (disabled until username valid and gender chosen).
- Errors appear inline under the input in `--danger`, short: `taken, try another`, `3 to 20 letters, numbers, _ or .` (only after blur or submit). Input does a 300 ms shake on error.
- Submitting: button shows a bouncing three-dot loader, then the whole screen transitions into the lobby (faces fly into place).

### 2. Lobby / live board (`/`)
- Header (mobile): wordmark (small, 22px) left. Right: dm icon button with an accent unread badge (count, pops), then my face (32px).
- Filter: segmented control `all 7` / `male 3` / `female 4` with live counts, sliding indicator, sticky under the header.
- Board: grid of **face cards**. Mobile: 2 columns. Desktop main pane: auto-fill, min 180px. Card: `--surface`, `--r-lg`, padding 16, face 96 to 112 centered with presence dot, username (Bricolage 650, 17px, ellipsis), a tiny meta line: gender icon in gender color + `here 4m` (or `typing to you...` in accent when they are typing in your conversation, or `away` when they are away). Cards tilt very slightly (+-1.5deg, from hash) and straighten on hover/press for the sticker feel. Unread from that person: small accent badge on the card corner.
- Tapping a card opens the chat. Hover (desktop): lift 2px and the face looks at the cursor.
- Empty board: big sleepy face (closed eyes, `z` floating), text `nobody's here rn` and below in `--ink-2` `they'll pop up here`. That is a state, not an instruction: keep it to that.
- Filtered empty: `no girls online rn` / `no guys online rn` style copy.

### 3. Inbox (`/dm` on mobile, left rail on desktop)
- Header: back chevron (mobile), title `dms`.
- Rows (72px): face 48 with presence dot (only if online), username (Bricolage 650), last message preview in `--ink-2` (`you: lol ok`), or `typing...` in accent italic-free bold, or theme events `changed the theme`. Right column: relative time (`now`, `5m`, `2h`, `tue`, `12 mar`) and an accent unread count pill. Unread rows: name and preview in `--ink` weight up.
- Active conversation row (desktop) highlighted with `--bg-2` and a 3px accent bar on the left edge.
- Empty: small face + `no dms yet`.

### 4. Chat (`/dm/:username`)
- Whole chat area uses the conversation theme (background + ambient layer + bubble colors). The header and composer are tinted by theme tokens too.
- Header: back (mobile), face 40 + presence dot, username (Bricolage 700 17px), status line under it: `typing...` (accent, animated dots) > `online` > `active 5m ago` > nothing. Right: gear icon (opens settings sheet).
- Messages: grouped by sender within 3 minutes; time separators centered small caps-like `today 9:41 pm` when the gap > 30 min. Bubble max-width 75% (mobile) / 60% (desktop); radius 22; grouped corners shrink to 6 on the joined side. Mine use the theme's sent gradient with `background-attachment: fixed` so the gradient spans the viewport and each bubble shows its slice (Instagram effect). Theirs use the theme's received color. Emoji-only messages (1 to 3 emoji) render large without a bubble. Long words wrap (`overflow-wrap: anywhere`). Links auto-detected and underlined.
- Peer face (28) shows next to the last bubble of each of their groups.
- Under my last message: `sent` / `seen` (`seen` when peer_last_read_at >= its time) in tiny `--theme-meta` text; failed messages show a red `!` and `tap to retry`.
- Theme system lines: centered pill, small: `you changed the theme to cherry blossom` / `sam changed the theme to midnight`.
- Typing bubble at the bottom when peer is typing (with their face).
- Empty chat: peer face large (120) with pupils looking down at the composer, their username, `here 4m` or `active 2h ago`, and a big quick-send chip `👋 say hi` (sends "hi 👋"). Emoji inside message content and quick chips is fine; never as interface icons.
- Composer: floating pill above the safe area, `--theme-composer` bg, auto-grow textarea up to 5 lines, placeholder `message...`. Send button: round 40px, theme accent, paper plane icon; scales in when there is text (out when empty). Enter sends on desktop, Shift+Enter newline; on touch devices Enter inserts newline and the button sends. Keep focus after send so the keyboard stays up. Scroll to bottom on send; if user scrolled up and a new message arrives, show a small `new message ↓` pill instead of yanking.
- Scrolling up loads older messages seamlessly (preserve scroll position).

### 5. Chat settings sheet (gear)
- Mobile: bottom sheet with grabber, drag to dismiss, max 85dvh. Desktop: a right-side panel sliding over the chat (380px).
- Top: peer face 64 + username.
- `theme`: grid of theme swatch tiles (3 columns mobile, 2 in the desktop panel... or 3 if it fits). Each tile is a mini live preview: theme background with two tiny bubbles (one received, one sent with the gradient) and the theme name under it. Selected tile has a 3px ink ring and a check badge. Tapping applies instantly (optimistic) for both people.
- `notifications`: one row with bell icon, label `notifications`, and a toggle. Under it, only when needed, one tiny line: `add to home screen to turn on` (iOS not installed) or `blocked in browser settings` (denied).

### 6. In-app toast
- When a message arrives for a conversation that is not open: a banner drops from the top (below the safe area), `--surface`, `--shadow-pop`, `--r-lg`: face 36, username bold, preview one line. Tap opens the chat, swipe up or 4 s timeout dismisses. Stack max 2.

## Chat themes

Each theme defines CSS custom properties applied on the chat container (`data-theme` or inline vars), plus an optional ambient layer component. Required variables:

```
--theme-bg            background (can be a layered gradient/pattern)
--theme-ink           text on the background (system lines, empty states)
--theme-meta          tiny meta text (seen, times)
--theme-header        header background (usually translucent version of bg)
--theme-sent          sent bubble background (gradient allowed; rendered with background-attachment: fixed)
--theme-sent-ink      sent bubble text
--theme-recv          received bubble background
--theme-recv-ink      received bubble text
--theme-accent        send button, typing, links
--theme-accent-ink
--theme-composer      composer pill background
--theme-composer-ink
scheme: 'light' | 'dark'   (sets color-scheme for scrollbars, caret)
ambient: none | petals | stars | bubbles | rain | sparkles(as tiny dots, not emoji) | aurora | grid | leaves | hearts | scanlines
```

Theme list (ids are fixed by the DB whitelist):

| id | name | vibe |
| --- | --- | --- |
| `goofy` | goofy | Default. Cream paper, ink received-text on white bubbles, sent = tangerine to watermelon gradient. Sticker energy. |
| `cherry` | cherry blossom | Soft blush pink to warm white; sent = sakura pink to rose; slow falling petals ambient. |
| `midnight` | midnight | Deep navy to near-black; sent = electric blue to violet-blue (deep, not purple slop); twinkling stars. Dark scheme. |
| `matcha` | matcha latte | Creamy green and oat; sent = matcha green to moss; very calm, tiny leaf ambient. |
| `peach` | peach fuzz | Peach and apricot; sent = apricot to coral. Fuzzy noise texture. |
| `lagoon` | lagoon | Teal and aqua; sent = turquoise to deep teal; rising bubbles. |
| `lavender` | lavender haze | Hazy lilac with soft grain; sent = lilac to periwinkle; slow drifting blur blobs. |
| `terminal` | terminal | Black with phosphor green; bubbles monospace; sent = green outline-ish fill; scanlines; dark. |
| `bubblegum` | bubblegum | Hot pink and baby blue Y2K candy; sent = pink to sky; little hearts float. |
| `citrus` | lemonade | Lemon yellow and lime; sent = lemon to lime with ink text. |
| `aurora` | aurora | Dark with slowly moving green/teal/pink aurora gradient; sent = mint to teal. Dark. |
| `noir` | noir | Pure monochrome. White bg, black sent bubbles, grey received. Ultra clean. |
| `strawberry` | strawberry milk | Milky pink and cream with tiny strawberry dot pattern; sent = berry red to pink. |
| `forest` | forest | Dark pine green; sent = fern to emerald; falling leaves. Dark. |
| `sunset` | sunset | Orange to magenta sky gradient background; sent = gold to orange; warm. |
| `y2k` | y2k chrome | Silver/chrome iridescent background; sent = chrome-blue iridescent; sparkle dots. |

Ambient layers: pure CSS or a tiny canvas, max ~20 particles, `pointer-events: none`, paused when the tab is hidden, disabled under reduced motion. They must never reduce text contrast (keep them behind a subtle scrim if needed). Received and sent text must hit WCAG AA (4.5:1) on their bubbles.

## Copy deck (complete; use these strings)

- Onboarding: input placeholder `pick a username`; chips `male`, `female`; button `start`; errors `taken, try another`, `3 to 20 letters, numbers, _ or .`, `something broke, try again`; counter `{n} online`.
- Lobby: filters `all`, `male`, `female`; card meta `here {t}`, `typing to you...`, `away`; empty `nobody's here rn` / `they'll pop up here`; filtered empty `no guys online rn`, `no girls online rn`.
- Inbox: title `dms`; preview prefix `you: `; theme preview `changed the theme`; `typing...`; empty `no dms yet`.
- Chat: placeholder `message...`; status `typing...`, `online`, `active {t} ago`; meta `sent`, `seen`, `tap to retry`; system `you changed the theme to {name}`, `{username} changed the theme to {name}`; empty quick chip `👋 say hi`; jump pill `new message ↓`.
- Settings: section labels `theme`, `notifications`; hints `add to home screen to turn on`, `blocked in browser settings`.
- Connection lost (thin banner at the top): `reconnecting...`.
- Document title: `GoofyAhhTalk`, with unread count prefix `(3) GoofyAhhTalk`.
