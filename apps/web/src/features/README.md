# features

One directory per feature, using the same names as the backend's
`src/modules/` so a developer can move between repositories without
translating.

```
<feature>/
  api/      MODEL     — endpoints + contracts for this feature only
  model/    VIEWMODEL — use-*.ts: state and behaviour, never JSX
  ui/       VIEW      — props in, events out, never fetches
  styles/   this feature's CSS modules
  index.ts  the public API — the only importable path
```

## Rules

1. `ui/` may not import from `api/`. A view receives data from a viewmodel.
   This one rule is the difference between MVVM and three folders.
2. `app/` may import only a feature's `index.ts` and `shared/`.
3. No feature may reach into another feature's internals.
4. `shared/` may never import a feature.

Enforced by `.dependency-cruiser.cjs`, not by convention.
