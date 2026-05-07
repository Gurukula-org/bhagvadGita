import { google } from "googleapis";
import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const home = homedir();
const serviceAccount = JSON.parse(
  readFileSync(resolve(home, "Downloads/sample-f6f12-firebase-adminsdk.json"), "utf-8")
);

const projectId = serviceAccount.project_id;
const domain = "sample-f6f12.web.app";

async function addAuthorizedDomain() {
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: [
      "https://www.googleapis.com/auth/firebase",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  // Get current config via REST
  const getRes = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
    { headers: { Authorization: `Bearer ${token.token}` } }
  );

  if (!getRes.ok) {
    const err = await getRes.text();
    console.error("GET config failed:", getRes.status, err);
    process.exit(1);
  }

  const config = await getRes.json();
  const currentDomains: string[] = config.authorizedDomains || [];
  console.log("Current authorized domains:", currentDomains);

  if (currentDomains.includes(domain)) {
    console.log(`Domain "${domain}" is already authorized.`);
    return;
  }

  const updatedDomains = [...currentDomains, domain];

  // Update config via REST with PATCH
  const patchRes = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=authorizedDomains`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ authorizedDomains: updatedDomains }),
    }
  );

  if (!patchRes.ok) {
    const err = await patchRes.text();
    console.error("PATCH config failed:", patchRes.status, err);
    process.exit(1);
  }

  const updated = await patchRes.json();
  console.log("Updated authorized domains:", updated.authorizedDomains);
}

addAuthorizedDomain().catch((err) => {
  console.error("Failed:", err.message || err);
  process.exit(1);
});
