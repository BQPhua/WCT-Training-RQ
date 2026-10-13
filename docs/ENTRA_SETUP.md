# Microsoft Entra ID setup (one-time, by IT)

The app signs users in with their WCT Microsoft 365 account (OpenID Connect with PKCE) and uses Microsoft Graph to search the staff directory for the candidate picker.

## 1. Register the application

1. Go to **Entra admin centre → Identity → Applications → App registrations → New registration**.
2. Fill in the form:
   - **Name:** `WCT HR Forms – Training RQ`
   - **Supported account types:** *Accounts in this organizational directory only (single tenant)*
   - **Redirect URI:** platform **Web**, with the value
     `https://hrforms.wct.my/WCT-Training-RQ/api/auth/callback`
3. Click **Register**. Copy the **Application (client) ID** and the **Directory (tenant) ID**.

## 2. Client secret

1. Go to **Certificates & secrets → New client secret** and choose an expiry (24 months maximum).
2. Copy the secret **Value** immediately. It is shown only once.
3. Put a calendar reminder about a month before it expires. When it expires, sign-in stops working until a new secret is added to `.env`.

## 3. API permissions (Microsoft Graph)

| Type | Permission | Why |
|---|---|---|
| Delegated | `openid`, `profile`, `email`, `User.Read` | Sign-in, and reading the user's own name, job title and department |
| Application | `User.Read.All` | Server-side staff search for the candidate picker |

Click **Grant admin consent for WCT**. All rows must show a green tick.

> Without `User.Read.All`, the candidate picker still works, but it can only search people who have already signed in to the app. Manual entry is always available.

## 4. Optional: restrict who can sign in

To limit access to specific staff, go to **Enterprise applications → WCT HR Forms – Training RQ → Properties**, set **Assignment required = Yes**, then assign users or groups. Otherwise every account in the WCT tenant can sign in, and every signed-in user can raise requests.

## 5. Configure the server

In `/opt/wct-training-rq/.env`:

```env
ENTRA_TENANT_ID=<Directory (tenant) ID>
ENTRA_CLIENT_ID=<Application (client) ID>
ENTRA_CLIENT_SECRET=<secret value>
```

Then run `pm2 reload wct-training-rq --update-env`.

## How users are matched to departments

On every sign-in, the app reads the user's **Department** field from Microsoft 365. If it matches a department name in **Admin settings → Business units & departments** (case-insensitive), the user is placed there automatically. If it doesn't match, the user is asked to pick a department before their first submission, and admins can correct it under **Admin → Users**, where unmatched users are flagged. Name departments in the app exactly as they appear in Microsoft 365 to avoid manual fixes.
