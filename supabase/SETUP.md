# FINBIZ private capital document storage

The capital portal uses Supabase Auth and a **private** Storage bucket. It accepts legal, financial, operational, and collateral documents. It does not use Google Drive or the existing lead-form Apps Script endpoint.

## Configure a Supabase project

1. Create a Supabase project and enable email authentication. Configure the email provider and delivery limits before launch.
2. In **Authentication → URL Configuration**, add `https://fin-biz.github.io/FIN-BIZ/ket-noi-von.html` to the allowed redirect URLs.
3. Open the SQL Editor and run [`capital-portal.sql`](./capital-portal.sql).
4. In **Project Settings → API**, copy the Project URL and the public `anon`/publishable key into `url` and `anonKey` in [`../assets/finbiz-supabase-config.js`](../assets/finbiz-supabase-config.js).
5. Deploy the site and test with a non-sensitive sample document and two different email accounts. Confirm each account cannot access the other account's records or files.

The browser configuration must contain only the project URL and public anon/publishable key. **Never put a `service_role` key, database password, or other secret in this repository.** The SQL creates a private bucket with a server-enforced 20 MB per-file limit, allowed document/image types, row-level security for application records, category-specific storage paths, and owner-folder policies for files. Company files remain private and the portal does not create public or signed download links. The browser UI limits each request to 30 files and 200 MB total; that aggregate limit is client-side, not server-enforced.

Before accepting identity documents and bank statements, configure an appropriate privacy notice, staff access controls, and a document-retention/deletion process for the business. Until Supabase is configured, the page intentionally disables submissions and directs businesses to contact FINBIZ. Applications and categorized documents are separate records in Supabase; the Supabase project owner can review them in the project dashboard. No internal staff dashboard or automatic loan decisioning is included.
