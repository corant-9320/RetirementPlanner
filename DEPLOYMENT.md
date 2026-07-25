# Deployment — Retirement Planner on S3

## Live URL

**http://retirement-planner.s3-website-eu-west-1.amazonaws.com/**

## What's Deployed

The contents of `dist/` folder after running `npm run build`:
- `index.html` — entry point (11.7 KB)
- `assets/index-*.css` — bundled CSS (5 KB, minified)
- `assets/index-*.js` — bundled JS (18 KB, minified)

Total: ~34 KB (8 KB gzipped)

## AWS Setup

**S3 Bucket**: `retirement-planner`
- **Region**: eu-west-1
- **Static website hosting**: enabled (index.html as default document, error handler)
- **Public access**: allowed (BlockPublicPolicy disabled)
- **Bucket policy**: allows `s3:GetObject` for `*` (public read)
- **Cache control**: 1 hour (max-age=3600)

## How to Update the Deployment

After making code changes:

```bash
npm run build
aws s3 sync dist/ s3://retirement-planner --delete --region eu-west-1 --cache-control "public, max-age=3600"
```

The `--delete` flag removes old files from S3 so only the latest build artifacts remain.

## Notes

- All data is stored in **localStorage** — no backend needed, no database
- Scenarios are saved locally in the browser; they do not sync across devices
- Users can export scenarios by saving them, then loading them on a different browser (manual copy-paste of localStorage data if needed)
- The app is read-only from an S3 perspective — no write operations to S3
