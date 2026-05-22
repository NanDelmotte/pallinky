# Deployment

## Web App (Fly.io)

### Manual deploy

Run this from the repository root:

```bash
fly deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile -a pallinky-prod
```

### Automated deploy from GitHub Releases

This repository includes a GitHub Actions workflow at:

`/.github/workflows/fly-web-release.yml`

It deploys the web app when a GitHub Release is published (`release.published`), and can also be triggered manually from the Actions tab (`workflow_dispatch`).

The workflow runs:

```bash
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile -a pallinky-prod --remote-only
```

### Required GitHub secret

Set this repository secret for Actions:

- `FLY_API_TOKEN`: Fly.io deploy token with access to `pallinky-prod`

## Mobile App (Expo / EAS iOS)

### Current release flow

1. Update version values in `apps/mobile/app.config.js` (`version` and `runtimeVersion`).
2. Run a development iOS build and test on a real device.
3. After validation, run the production iOS build.

### Automated build from GitHub Actions

This repository includes a workflow at:

`/.github/workflows/mobile-ios-build.yml`

Run it from the Actions tab using `workflow_dispatch`:

- `profile=development` for test builds
- `profile=production` for release builds
  - Requires `confirm_production=release` as a safety check

The workflow runs EAS with:

```bash
EXPO_NO_CAPABILITY_SYNC=1 eas build --profile <development|production> --platform ios --non-interactive
```

### Required GitHub secret

- `EXPO_TOKEN`: Expo token with permission to run EAS builds for this project
