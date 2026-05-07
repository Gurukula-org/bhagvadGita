import { google } from "googleapis";
import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const home = homedir();
const serviceAccount = JSON.parse(
  readFileSync(resolve(home, "Downloads/sample-f6f12-firebase-adminsdk.json"), "utf-8")
);

const projectId = serviceAccount.project_id;
const storageBucket = "sample-f6f12.appspot.com";

async function getToken() {
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/firebase", "https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  return (await client.getAccessToken()).token;
}

async function deployRuleset(
  token: string,
  rulesFile: string,
  fileName: string,
  releaseName: string,
  label: string
) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const rulesContent = readFileSync(resolve(process.cwd(), rulesFile), "utf-8");
  console.log(`\n=== Deploying ${label} rules ===\n${rulesContent}`);

  const createRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ source: { files: [{ name: fileName, content: rulesContent }] } }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error(`Create ${label} ruleset failed:`, createRes.status, err);
    return false;
  }

  const ruleset = await createRes.json();
  const rulesetName = ruleset.name;
  console.log(`Created ${label} ruleset:`, rulesetName);

  const fullReleaseName = `projects/${projectId}/releases/${releaseName}`;

  let releaseRes = await fetch(
    `https://firebaserules.googleapis.com/v1/${fullReleaseName}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ release: { name: fullReleaseName, rulesetName } }),
    }
  );

  if (!releaseRes.ok && releaseRes.status === 404) {
    releaseRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ name: fullReleaseName, rulesetName }),
      }
    );
  }

  if (!releaseRes.ok) {
    const err = await releaseRes.text();
    console.error(`Release ${label} failed:`, releaseRes.status, err);
    return false;
  }

  console.log(`${label} rules deployed successfully!`);
  return true;
}

async function main() {
  const token = await getToken();

  await deployRuleset(token, "firestore.rules", "firestore.rules", "cloud.firestore", "Firestore");
  await deployRuleset(token, "storage.rules", "storage.rules", `firebase.storage/${storageBucket}`, "Storage");
}

main().catch((err) => {
  console.error("Failed:", err.message || err);
  process.exit(1);
});
