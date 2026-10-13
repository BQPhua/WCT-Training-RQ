# Power Automate notification flow

The app decides **who** is notified and **what** the message says. Power Automate only delivers it. Every approval and rejection happens inside the app; emails contain an **Open request** button and are never used to approve.

> **Licence:** the *When an HTTP request is received* trigger is a **Premium** connector. The flow owner needs a Power Automate Premium (or Per-flow) licence.

## What the app sends

On every workflow event (submitted, approved, rejected, cancelled, commented), the server sends a `POST` with this JSON body:

```json
{
  "event": "REJECTED",
  "refNo": "TRQ-2026-0007",
  "title": "Advanced Contract Administration",
  "status": "RETURNED",
  "statusLabel": "Returned",
  "requester": { "name": "Aisyah Rahman", "email": "aisyah@wct.my" },
  "actor": { "name": "Nurul Izzah", "email": "nurul@wct.my" },
  "remark": "Please attach the provider quotation.",
  "to": ["aisyah@wct.my", "buadmin.land@wct.my"],
  "cc": [],
  "subject": "[Training RQ] TRQ-2026-0007 – Rejected (sent back to Requester): Advanced Contract Administration",
  "messageHtml": "<div>…ready-to-send HTML email body…</div>",
  "link": "https://hrforms.wct.my/WCT-Training-RQ/requests/7d0f…"
}
```

`event` is one of `SUBMITTED`, `RESUBMITTED`, `HOD_APPROVED`, `LND_APPROVED`, `FINAL_APPROVED`, `REJECTED`, `CANCELLED` or `COMMENTED`. All user-entered text inside `messageHtml` is already HTML-escaped.

## Build the flow (about 10 minutes)

1. Go to **Power Automate → Create → Instant cloud flow** and name it `HR Forms – Training RQ notifications`. Skip the trigger picker, then add the trigger **When an HTTP request is received** (Request connector).
   - **Who can trigger the flow:** *Anyone*. The flow URL contains a signature and must be treated as a secret; it is stored only in the server's `.env`.
   - **Request Body JSON Schema:** paste the following.

   ```json
   {
     "type": "object",
     "properties": {
       "event": { "type": "string" },
       "refNo": { "type": "string" },
       "title": { "type": "string" },
       "status": { "type": "string" },
       "statusLabel": { "type": "string" },
       "requester": { "type": "object", "properties": { "name": { "type": "string" }, "email": { "type": "string" } } },
       "actor": { "type": "object", "properties": { "name": { "type": "string" }, "email": { "type": "string" } } },
       "remark": { "type": ["string", "null"] },
       "to": { "type": "array", "items": { "type": "string" } },
       "cc": { "type": "array", "items": { "type": "string" } },
       "subject": { "type": "string" },
       "messageHtml": { "type": "string" },
       "link": { "type": "string" }
     },
     "required": ["event", "to", "subject", "messageHtml", "link"]
   }
   ```

2. Add the action **Office 365 Outlook → Send an email from a shared mailbox (V2)**. This is recommended so emails come from e.g. `hrforms@wct.my`; *Send an email (V2)* sends from the flow owner instead.
   - **Original Mailbox Address:** `hrforms@wct.my`
   - **To:** expression `join(triggerBody()?['to'], ';')`
   - **CC:** expression `join(triggerBody()?['cc'], ';')`
   - **Subject:** dynamic content `subject`
   - **Body:** dynamic content `messageHtml` (the body is HTML)
   - **Importance:** Normal

3. *(Optional)* Add a Teams message:
   - Add **Apply to each** over `triggerBody()?['to']`.
   - Inside it, add **Microsoft Teams → Post message in a chat or channel**: Post as *Flow bot*, Post in *Chat with Flow bot*, Recipient *Current item*.
   - Message: `@{triggerBody()?['subject']}<br><a href="@{triggerBody()?['link']}">Open request</a>`

4. Add **Response** with Status code `202`. This lets the app know delivery was accepted.

5. **Save.** Copy the trigger's **HTTP POST URL** and put it in the server's `.env`:

   ```env
   POWER_AUTOMATE_FLOW_URL=https://prod-xx.southeastasia.logic.azure.com:443/workflows/…
   ```

   Then run `pm2 reload wct-training-rq --update-env`.

## Reliability

- Every send is logged under **Admin settings → Notifications**, with its status, attempts and last error.
- Failed sends are retried automatically every 5 minutes (up to 3 attempts) by the server crontab, and admins can click **Retry**.
- A notification failure never blocks or undoes an approval.

## Testing

Submit a test request as yourself, then check that the email arrives and that the flow's **Run history** shows a successful run. If the app's notification log shows `HTTP 401/403`, the flow URL is wrong or was regenerated. Copy it again.
