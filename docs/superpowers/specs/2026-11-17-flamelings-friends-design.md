# Flamelings 1.4 — online friends and playdates (design)

Gentry's sons (6 and 8) play on separate iPads and want to add each other as friends and have playdates. Other kids may use it too. Players are children: this is a privacy and abuse boundary.

## Goals

- Each pet has a 6-character friend code. Typing a friend's code adds them. Friendship is mutual: both sides type the other's code (kids do it side by side).
- A playdate: your pet's friend appears in your glade, they play together (dance, high-five, share a marshmallow), you get joy + sparks; your friend gets a "<pet> visited!" card next time they open the game, with a smaller reward.
- Friends' pets show their current look, level, stage and form.

## Anti-goals

- No free text ever leaves the device. Typed pet names stay local.
- No way to browse, list or search other players. No chat. No photos.
- No way for a stranger to make a child's game show anything except a pet look and a name from our own word list.

## What is stored online

`flPets/{code}` — the pet's public card. Fields exactly: `uid` (owner's Firebase anonymous uid), `look` map {colour, shape, eyes, hat, face, neck: closed enums incl. "none"}, `level` int 1–99, `stage` enum, `form` enum incl. "none", `nameId` int index into `ONLINE_NAMES`, `updatedAt` == request.time.

- `code` doc id matches `^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$` (no 0/O/1/I/L).
- Create: signed in, `uid == request.auth.uid`, doc must not exist, all fields valid.
- Update: owner only, `uid` unchanged, fields valid, at most once per 10 s (`request.time > resource.data.updatedAt + duration.value(10, 's')`).
- Delete: owner only.
- Read: `get` for any signed-in user; `list` denied (no browsing).

`flPets/{code}/visits/{fromCode_day}` — playdate inbox. Fields exactly: `from` (code), `day` (UTC yyyy-mm-dd == server day), `createdAt` == request.time.

- Create: signed in; `request.auth.uid == get(flPets/{from}).data.uid` (you own the visiting pet); doc id == `from + "_" + day`; the target pet exists; `from != code`. Doc id makes it at most one visit per friend pair per day; create only (no update).
- Read/list/delete: only the owner of `{code}` (`get(flPets/{code}).data.uid == request.auth.uid`).

## Names

`ONLINE_NAMES`: a curated list (~150) of kid-friendly names, kept in sync with `firestore.rules` by a test (as `lib/leaderboard/nickname.ts` is). A pet's online name is its typed name if that exactly (case-insensitively) matches a list name, otherwise a seeded pick; the owner can choose another from the list in the Friends screen.

## Client

- Auth: reuse `lib/leaderboard/auth.ts` (anonymous sign-up + refresh via REST) with its own storage key `flamelings:auth`; App Check header via the leaderboard path. No Firebase SDK on the page.
- Friends screen (from the shelf, per pet): my code (big, copyable), add a friend (big letter keypad, no system keyboard needed), friend list with their pets, Playdate button (one per friend per window locally; server limits one per day).
- Visits from codes not in my friend list are ignored and deleted. Remove friend = local only.
- Card sync: create on first open of Friends; update on look/level/stage/form change, debounced ≥ 10 s.
- Offline or signed-out: Friends shows a calm cloud-off icon; the rest of the game is unaffected.

## Analytics

`fl_friend` {action: add|playdate|visited}.

## Review

Spec review + adversarial security review of rules and client (enumeration, spoofing `from`, writing into other inboxes, field injection, oversized docs, rate limits, uid reuse), and a re-review after fixes. `npm run test:rules` covers every allow/deny case above.

## Follow-ups

- Admin tools: delete a card, ban a uid (like leaderboard bans).
- Cap cards per uid if spam appears.
