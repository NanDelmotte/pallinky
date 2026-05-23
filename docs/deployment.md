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

Note: This repo currently commits native projects (`apps/mobile/ios` and `apps/mobile/android`), so native settings are source of truth for install identifiers. `app.config.js` identifier values may be ignored when native folders are present. We can revisit and migrate to a managed/CNG strategy later if desired.

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

### Mobile environment separation

The mobile app fails closed when public Supabase env vars do not match the selected build variant:

- `development` must use the development Supabase project.
- `production` must use the production Supabase project.
- Both variants use the same app identifier: `com.nancy.pallinky`.

The EAS profiles in `apps/mobile/eas.json` provide `EXPO_PUBLIC_APP_VARIANT`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Build and update commands run `validate-public-env.js` before publishing a bundle so a local override such as `.env.local` cannot silently point a development build at production. For local development, run `npm run mobile:development` from `apps/mobile` so the dev variant and dev Supabase project are explicit.
