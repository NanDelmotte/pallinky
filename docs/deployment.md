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
