# Configuration

This project is a Cloudflare Worker API that connects to Google Sheets and Apps Script using OAuth and service-account credentials.

## Project config

The Worker is defined in `wrangler.jsonc` and currently uses:

```jsonc
{
  "name": "natures-api",
  "main": "worker.js",
  "compatibility_date": "2026-10-06",
  "durable_objects": {
    "bindings": [
      {
        "name": "STOCK_UPDATE_LOCK",
        "class_name": "StockUpdateCoordinator",
      },
    ],
  },
  "migrations": [
    {
      "tag": "v1-stock-update-lock",
      "new_sqlite_classes": ["StockUpdateCoordinator"],
    },
  ],
  "secrets_store_secrets": [
    {
      "binding": "API_EMAIL_STORE",
      "store_id": "64da724ad0c54d46b8bcb0a0f3a2d4b3",
      "secret_name": "API_EMAIL",
    },
    {
      "binding": "API_PRIVATE_KEY_STORE",
      "store_id": "64da724ad0c54d46b8bcb0a0f3a2d4b3",
      "secret_name": "API_PRIVATE_KEY",
    },
    {
      "binding": "API_CLIENT_ID_STORE",
      "store_id": "64da724ad0c54d46b8bcb0a0f3a2d4b3",
      "secret_name": "API_CLIENT_ID",
    },
    {
      "binding": "API_CLIENT_SECRET_STORE",
      "store_id": "store id ",
      "secret_name": "API_CLIENT_SECRET",
    },
    {
      "binding": "API_REFRESH_TOKEN_STORE",
      "store_id": "64da724ad0c54d46b8bcb0a0f3a2d4b3",
      "secret_name": "API_REFRESH_TOKEN",
    },
  ],
}
```

## Required environment variables

These values are expected by the code in `worker.js` and `utils/googleConfig.js`.

- `APINAME_EMAIL` — Google service-account email used to sign JWT tokens.
- `APINAME_PRIVATE_KEY` — Google service-account private key used for JWT-based access tokens.
- `APINAME_CLIENT_ID` — Google OAuth client ID used for OAuth authorization and token exchange.
- `APINAME_CLIENT_SECRET` — Google OAuth client secret used during OAuth flow.
- `APINAME_REFRESH_TOKEN` — OAuth refresh token used to obtain access tokens for Apps Script calls.

Do not commit real secrets to the repository. Store them as Cloudflare Worker secrets or in a local `.dev.vars` file that is excluded from version control.

Example local `.dev.vars` format:

```env
API_EMAIL="your-service-account@project.iam.gserviceaccount.com"
API_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----"
API_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
API_CLIENT_SECRET="your-google-client-secret"
API_REFRESH_TOKEN="your-oauth-refresh-token"
```

## Google-related constants

These values are hardcoded in the app and should be reviewed if the Google project changes:

- `GOOGLE_SCRIPT_ID` — Apps Script project ID used for script execution
- `GOOGLE_REDIRECT_URI` — OAuth callback URL used by Google login flow
- `GOOGLE_SCOPES` — requested OAuth scopes

## Spreadsheet IDs

The project also references spreadsheet IDs in `utils/googleConfig.js` for operational data access:

- `SPREADSHEET_ID`
- `USER_MASTER_SPREADSHEET_ID`
- `APPS_SCRIPT_SPREADSHEET_ID`
- `CREDIT_ACTIVITY_SPREADSHEET_ID`
- `CREDIT_ACTIVITY_MASTER_SHEET_ID`

These values should be kept in sync with the Google Sheets used by the app.

## Local development

Run the worker locally with:

```bash
npm install
npm run dev
```

## Security note

- Keep all production credentials in Cloudflare secret storage or environment variables managed outside the repo.
- Rotate the OAuth client secret and refresh token if they are exposed.
- Treat the service-account private key as a highly sensitive credential.
