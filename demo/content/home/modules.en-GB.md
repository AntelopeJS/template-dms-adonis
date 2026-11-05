## The modules, and what they change in a real project

A module installs in one command (or from the store) and brings its screens, data and automations — without touching the project's code.

| Module | What it does | In a real case |
| --- | --- | --- |
| **SaaS** | Self-service sign-up, plans, Stripe subscriptions, customer settings, the publisher's back office | Sell your business tool as a subscription to many companies |
| **Automation** | Visual procedures: triggers, actions, conditions | "An urgent ticket arrives → the on-call technician is assigned and notified" |
| **Mailing** | Block-based editable email templates, sending, statistics | Quote sent, invoice issued, reminder — no developer needed to change a text |
| **Marketing** | Cookieless analytics, heatmaps, funnels, A/B tests | See where your users click and where they drop off |
| **Media library** | Files in folders, per-folder permissions, image variants | Site photos, datasheets, documents shared with clients |
| **Translations** | Languages and translations of the dashboard and content | A platform in French, Dutch and English |
| **Database** | Explorer, schemas, queries, row-by-row fixes | Diagnose a record without opening a Mongo client |
| **API** | Route catalogue, logs, health, live testing | Follow a client's integrations and their errors |
| **Assistant** | An AI agent that knows your project and its modules | Add a page or fix a form just by asking |
| **Builder** | Edit pages, tables and forms from the interface | Adjust a screen without redeploying |

### The SaaS module, enabled on this demo

Helio is not just a back office: with the **SaaS** module, it becomes a **product you can sell**.

- **Public pages** — `/pricing` and `/register`: a visitor compares plans and creates an account and a first workspace, with or without a card depending on the plan.
- **Plans that drive permissions** — a plan lists a workspace's permissions: moving from Starter to Business opens new screens, automatically.
- **Stripe billing** — subscriptions, invoices, credit notes, trials, seats; payment errors are explained to the customer.
- **Customer settings** — in *Settings › Workspace*: members, seats, plan changes, payment, data export.
- **The publisher's back office** — in *Modules › SaaS*: recurring revenue, workspaces by status, plan migrations, billing rules.

> [!TIP]
> On this demo Stripe is not connected (placeholder keys): signing up for the free plan works without a card, and paid plans clearly explain that payment requires Stripe. With real keys, the full flow switches on without any code change.
