# Saved-ship fixtures

Real-shaped saves that every future build must still load. They are checked by
`../__tests__/fixtures.test.ts`.

- `templates/` every template, serialised as a save stores it.
- `legacy/` hand-built ships at schema versions v1 to v6 (the v6 one has bulkheads). Never regenerated.
- `share/` share-link payloads (the text after `#ship=`), one of them in an old format.
- `*.expected.json` part count and key stats for the fixture beside it.

Attach point ids are part of the save format. If this test fails after a change
to point ids, geometry or rules, add a schema migration rather than editing the
fixtures to match.

After an intended change, regenerate templates, share links and expectations:

```bash
UPDATE_FIXTURES=1 npx jest fixtures
```

Commit the result. A normal `npm test` only compares.
