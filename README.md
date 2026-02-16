# Azure WebApp Deployment Notes

This repository contains a built static single-page app (`index.html` + `*.js` + `*.css`).

If Azure Web App shows only the default Azure page, the app files are usually not served from `wwwroot` root, or `index.html` is not selected as default.

## Files added for Azure App Service (Windows/IIS)

- `web.config`: sets `index.html` as default document and rewrites SPA routes to `index.html`.

## Deploy checklist

1. Deploy files at the root of `wwwroot` (not inside a subfolder like `dist/`).
2. Confirm `index.html` exists in `/site/wwwroot`.
3. If your Web App is **Linux + Node**, set Startup Command:
   - `pm2 serve /home/site/wwwroot --no-daemon --spa`
4. Restart the Web App after deployment.
