# Deployment

## Web App (Fly.io)

### Manual deploy

Run this from the repository root:

```bash
fly deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile -a pallinky-prod
```

### Manual deploy from GitHub Actions

This repository includes a GitHub Actions workflow at:

`/.github/workflows/fly-web-release.yml`

It deploys the web app when triggered manually from the Actions tab (`workflow_dispatch`).

The workflow runs:

```bash
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile -a pallinky-prod --remote-only
```

### Required GitHub secret

Set this repository secret for Actions:

- `FLY_API_TOKEN`: Fly.io deploy token with access to `pallinky-prod`

## Mobile App (Expo / EAS iOS)

### Manual build from GitHub Actions

This repository includes two workflows:

- `/.github/workflows/mobile-ios-dev-build.yml`
- `/.github/workflows/mobile-ios-prod-build.yml`

Run it from the Actions tab using `workflow_dispatch`:

1. Run `Mobile iOS Dev Build (EAS)` for test builds.
2. Validate on device.
3. Run `Mobile iOS Prod Build (EAS)` for release builds.
4. Set `confirm_production=release` for production runs.

The workflows run EAS with:

```bash
EXPO_NO_CAPABILITY_SYNC=1 eas build --profile development --platform ios --non-interactive
EXPO_NO_CAPABILITY_SYNC=1 eas build --profile production --platform ios --non-interactive
```

### Required GitHub secret

- `EXPO_TOKEN`: Expo token with permission to run EAS builds for this project

### Local build commands

Run from repository root:

```bash
npm run build:ios:development
npm run build:ios:production
npm run build:android:development
npm run build:android:production
```

These commands run EAS builds through `apps/mobile` with `EXPO_NO_CAPABILITY_SYNC=1`.
