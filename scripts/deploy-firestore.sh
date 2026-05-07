#!/bin/bash
###############################################################################
# Bhagavad Gita App — Full Firestore + Storage Setup Script
#
# Deploys ALL Firestore collections, documents, security rules, and storage
# rules to a NEW GCP/Firebase environment.
#
# Usage:
#   1. Open GCP Cloud Shell (https://console.cloud.google.com/cloudshell)
#   2. Paste this entire script
#   3. It will prompt for your target project ID
#
# What it creates:
#   Collections:
#     - gita_config/admin_emails        (admin allow-list)
#     - gita_config/chapter_visibility   (which chapters are public)
#     - gita_images/*                    (14 image metadata docs)
#
#   Security rules:
#     - Firestore rules (gita_config + gita_images)
#     - Storage rules (images/ + audio/)
#
#   Indexes: NONE required (all queries are doc-by-ID or full-collection)
#
# Storage config:
#   Bucket: gs://sample-f6f12.appspot.com
#   Folder: bhagvad-gita/images/
###############################################################################

set -euo pipefail

# ═══════════════════════════════════════════════════════════════════
# CONFIGURATION — Edit these for your target environment
# ═══════════════════════════════════════════════════════════════════
TARGET_PROJECT_ID="${TARGET_PROJECT_ID:-sample-f6f12}"
DATABASE="(default)"
STORAGE_BUCKET="sample-f6f12.appspot.com"
STORAGE_FOLDER="bhagvad-gita"

# Image base URL: all gita_images URLs will point here
IMAGE_BASE_URL="https://storage.googleapis.com/${STORAGE_BUCKET}/${STORAGE_FOLDER}/images"

echo "══════════════════════════════════════════════════════"
echo " Bhagavad Gita — Firestore Deployment"
echo " Target Project : ${TARGET_PROJECT_ID}"
echo " Storage Bucket : gs://${STORAGE_BUCKET}"
echo " Image Folder   : ${STORAGE_FOLDER}/images/"
echo "══════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════════
# 0. Set project & enable APIs
# ═══════════════════════════════════════════════════════════════════
echo "► Setting GCP project..."
gcloud config set project "${TARGET_PROJECT_ID}"

echo "► Enabling required APIs..."
gcloud services enable firestore.googleapis.com firebaserules.googleapis.com storage.googleapis.com

# ═══════════════════════════════════════════════════════════════════
# 1. Create Firestore database (if it doesn't exist)
# ═══════════════════════════════════════════════════════════════════
echo "► Ensuring Firestore database exists..."
if gcloud firestore databases describe --database="${DATABASE}" &>/dev/null; then
  echo "  Database already exists — skipping."
else
  echo "  Creating Firestore database (nam5 / US multi-region)..."
  gcloud firestore databases create \
    --database="${DATABASE}" \
    --location=nam5 \
    --type=firestore-native
fi

ACCESS_TOKEN=$(gcloud auth print-access-token)
BASE_URL="https://firestore.googleapis.com/v1/projects/${TARGET_PROJECT_ID}/databases/${DATABASE}/documents"

# ═══════════════════════════════════════════════════════════════════
# Helper: create a Firestore document via REST API
# ═══════════════════════════════════════════════════════════════════
create_doc() {
  local COLLECTION="$1"
  local DOC_ID="$2"
  local FIELDS_JSON="$3"
  local DESC="$4"
  local FORCE="${5:-false}"

  echo "► ${COLLECTION}/${DOC_ID} — ${DESC}"

  local HTTP_CODE
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    "${BASE_URL}/${COLLECTION}/${DOC_ID}")

  if [ "$HTTP_CODE" = "200" ] && [ "$FORCE" != "true" ]; then
    echo "  Already exists — skipping."
    return
  fi

  curl -s -X PATCH \
    "${BASE_URL}/${COLLECTION}/${DOC_ID}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"fields\": ${FIELDS_JSON}}" > /dev/null

  echo "  ✓ Created."
}

# ═══════════════════════════════════════════════════════════════════
# 2. COLLECTION: gita_config
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Collection: gita_config"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# --- gita_config/admin_emails ---
# Schema:
#   emails: string[]          — individual admin email addresses
#   allowed_domains: string[] — email domains allowed as admin (e.g. "gurukula.com")
create_doc "gita_config" "admin_emails" \
'{
  "emails": {
    "arrayValue": {
      "values": []
    }
  },
  "allowed_domains": {
    "arrayValue": {
      "values": [
        { "stringValue": "gurukula.com" }
      ]
    }
  }
}' \
"Admin email allow-list"

# --- gita_config/chapter_visibility ---
# Schema:
#   visible: number[] — array of chapter numbers visible to users
create_doc "gita_config" "chapter_visibility" \
'{
  "visible": {
    "arrayValue": {
      "values": [
        { "integerValue": "12" }
      ]
    }
  }
}' \
"Visible chapters (default: [12])"

# ═══════════════════════════════════════════════════════════════════
# 3. COLLECTION: gita_images
#
# Schema per document:
#   url: string        — public URL to the image
#   caption: string    — image caption/alt text
#   updatedAt: timestamp
#   updatedBy: string  — email of uploader
#
# Document ID format: <imageKey> (e.g. "ch12_v1_meaning", "home_hero")
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Collection: gita_images (14 documents)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

create_image_doc() {
  local DOC_ID="$1"
  local IMAGE_PATH="$2"
  local CAPTION="$3"

  create_doc "gita_images" "${DOC_ID}" \
"{
  \"url\": {
    \"stringValue\": \"${IMAGE_BASE_URL}/${IMAGE_PATH}\"
  },
  \"caption\": {
    \"stringValue\": \"${CAPTION}\"
  },
  \"updatedAt\": {
    \"timestampValue\": \"${NOW}\"
  },
  \"updatedBy\": {
    \"stringValue\": \"deploy-script\"
  }
}" \
"Image: ${DOC_ID}" "true"
}

# Chapter 12 Verse 1 images
create_image_doc "ch12_v1_detailed_meaning" \
  "ch12_v1_detailed_meaning/ch12v1-saguna-nirguna.webp" \
  "The two paths — saguṇa (with form) and nirguṇa (formless) — both lead to the same truth"

create_image_doc "ch12_v1_kids_explain" \
  "ch12_v1_kids_explain/ch12v1-kids-explain.webp" \
  "A parent explaining devotion to a child with a Krishna idol"

create_image_doc "ch12_v1_kids_story" \
  "ch12_v1_kids_story/ch12v1-kids-sun.webp" \
  "Two children thinking about the sun in different ways"

create_image_doc "ch12_v1_meaning" \
  "ch12_v1_meaning/ch12v1-meaning.webp" \
  ""

create_image_doc "ch12_v1_modern_life" \
  "ch12_v1_modern_life/ch12v1-modern-life.webp" \
  "A modern professional contemplating two different approaches"

create_image_doc "ch12_v1_more_stories_0" \
  "ch12_v1_more_stories_0/ch12v1-king-ministers.webp" \
  "A king listening to two ministers offering different advice"

create_image_doc "ch12_v1_more_stories_1" \
  "ch12_v1_more_stories_1/ch12v1-ramakrishna.webp" \
  "Sri Ramakrishna teaching about different paths to the Divine"

create_image_doc "ch12_v1_more_stories_2" \
  "ch12_v1_more_stories_2/ch12v1-sage-meditation.webp" \
  "A sage in deep meditation experiencing the formless Brahman"

create_image_doc "ch12_v1_story_0" \
  "ch12_v1_story_0/ch12v1-story-bhishma.webp" \
  "Bhishma lying on the bed of arrows with his mind fixed on Krishna"

create_image_doc "ch12_v1_story_1" \
  "ch12_v1_story_1/ch12v1-story-kunti.webp" \
  "Queen Kunti praying to Krishna for constant remembrance"

# Global / shared images
create_image_doc "chapter_bg" \
  "chapter_bg/gita-chapter-bg.webp" \
  "Chapter background image"

create_image_doc "home_hero" \
  "home_hero/gita-hero.webp" \
  "Home page hero image"

create_image_doc "home_kids" \
  "home_kids/gita-kids-banner.webp" \
  "Kids section banner"

create_image_doc "home_meditation" \
  "home_meditation/gita-meditation.webp" \
  "Meditation section image"

# ═══════════════════════════════════════════════════════════════════
# 4. Deploy Firestore Security Rules
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Deploying Firestore Security Rules"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FIRESTORE_RULES=$(cat <<'RULES_EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /gita_config/{doc} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email.matches('.*@gurukula[.]com');
    }
    match /gita_images/{imageId} {
      allow read: if true;
      allow write: if request.auth != null
        && exists(/databases/$(database)/documents/gita_config/admin_emails)
        && (
          request.auth.token.email in get(/databases/$(database)/documents/gita_config/admin_emails).data.emails
          || request.auth.token.email.matches('.*@gurukula[.]com')
        );
    }
  }
}
RULES_EOF
)

RULES_JSON=$(python3 -c "
import json, sys
rules = sys.stdin.read()
print(json.dumps(rules))
" <<< "${FIRESTORE_RULES}")

echo "► Creating Firestore ruleset..."
RULESET_RESPONSE=$(curl -s -X POST \
  "https://firebaserules.googleapis.com/v1/projects/${TARGET_PROJECT_ID}/rulesets" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"source\": {\"files\": [{\"name\": \"firestore.rules\", \"content\": ${RULES_JSON}}]}}")

RULESET_NAME=$(echo "${RULESET_RESPONSE}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || true)

if [ -n "${RULESET_NAME}" ]; then
  echo "► Applying Firestore ruleset: ${RULESET_NAME}"

  # Try PATCH first (update existing release), fall back to POST (create new release)
  RELEASE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    "https://firebaserules.googleapis.com/v1/projects/${TARGET_PROJECT_ID}/releases/cloud.firestore" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"release\": {\"name\": \"projects/${TARGET_PROJECT_ID}/releases/cloud.firestore\", \"rulesetName\": \"${RULESET_NAME}\"}}")

  if [ "$RELEASE_CODE" != "200" ]; then
    curl -s -X POST \
      "https://firebaserules.googleapis.com/v1/projects/${TARGET_PROJECT_ID}/releases" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"release\": {\"name\": \"projects/${TARGET_PROJECT_ID}/releases/cloud.firestore\", \"rulesetName\": \"${RULESET_NAME}\"}}" > /dev/null
  fi

  echo "  ✓ Firestore rules deployed."
else
  echo "  ⚠ Could not deploy rules via API."
  echo "  Fallback: run 'firebase deploy --only firestore:rules' from your repo."
  echo "  Response: ${RULESET_RESPONSE}"
fi

# ═══════════════════════════════════════════════════════════════════
# 5. Deploy Storage Security Rules
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Deploying Storage Security Rules"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

STORAGE_RULES=$(cat <<'STORAGE_RULES_EOF'
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /bhagvad-gita/images/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /bhagvad-gita/audio/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
STORAGE_RULES_EOF
)

STORAGE_RULES_JSON=$(python3 -c "
import json, sys
rules = sys.stdin.read()
print(json.dumps(rules))
" <<< "${STORAGE_RULES}")

echo "► Creating Storage ruleset..."
STORAGE_RULESET_RESPONSE=$(curl -s -X POST \
  "https://firebaserules.googleapis.com/v1/projects/${TARGET_PROJECT_ID}/rulesets" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"source\": {\"files\": [{\"name\": \"storage.rules\", \"content\": ${STORAGE_RULES_JSON}}]}}")

STORAGE_RULESET_NAME=$(echo "${STORAGE_RULESET_RESPONSE}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || true)

if [ -n "${STORAGE_RULESET_NAME}" ]; then
  echo "► Applying Storage ruleset: ${STORAGE_RULESET_NAME}"

  STORAGE_RELEASE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    "https://firebaserules.googleapis.com/v1/projects/${TARGET_PROJECT_ID}/releases/firebase.storage/${STORAGE_BUCKET}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"release\": {\"name\": \"projects/${TARGET_PROJECT_ID}/releases/firebase.storage/${STORAGE_BUCKET}\", \"rulesetName\": \"${STORAGE_RULESET_NAME}\"}}")

  if [ "$STORAGE_RELEASE_CODE" != "200" ]; then
    curl -s -X POST \
      "https://firebaserules.googleapis.com/v1/projects/${TARGET_PROJECT_ID}/releases" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"release\": {\"name\": \"projects/${TARGET_PROJECT_ID}/releases/firebase.storage/${STORAGE_BUCKET}\", \"rulesetName\": \"${STORAGE_RULESET_NAME}\"}}" > /dev/null
  fi

  echo "  ✓ Storage rules deployed."
else
  echo "  ⚠ Could not deploy storage rules via API."
  echo "  Fallback: run 'firebase deploy --only storage:rules' from your repo."
fi

# ═══════════════════════════════════════════════════════════════════
# 6. Create Storage bucket folders (upload placeholder)
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Creating Storage folder structure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "► Creating gs://${STORAGE_BUCKET}/${STORAGE_FOLDER}/images/ ..."
echo "placeholder" | gsutil -q cp - "gs://${STORAGE_BUCKET}/${STORAGE_FOLDER}/images/.gitkeep" 2>/dev/null && \
  echo "  ✓ images/ folder created." || \
  echo "  ⚠ Could not create folder (bucket may not exist yet or no access)."

echo "► Creating gs://${STORAGE_BUCKET}/${STORAGE_FOLDER}/audio/ ..."
echo "placeholder" | gsutil -q cp - "gs://${STORAGE_BUCKET}/${STORAGE_FOLDER}/audio/.gitkeep" 2>/dev/null && \
  echo "  ✓ audio/ folder created." || \
  echo "  ⚠ Could not create folder."

# ═══════════════════════════════════════════════════════════════════
# 7. Summary
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════════════════"
echo " ✓ Deployment Complete!"
echo "══════════════════════════════════════════════════════"
echo ""
echo " Firestore Collections:"
echo " ┌─────────────────────────────────────────────────────────────────┐"
echo " │ gita_config/admin_emails                                       │"
echo " │   emails: string[]           — admin email addresses           │"
echo " │   allowed_domains: string[]  — admin email domains             │"
echo " ├─────────────────────────────────────────────────────────────────┤"
echo " │ gita_config/chapter_visibility                                 │"
echo " │   visible: number[]          — publicly visible chapter nums   │"
echo " ├─────────────────────────────────────────────────────────────────┤"
echo " │ gita_images/{imageKey}       — 14 documents seeded             │"
echo " │   url: string                — public image URL                │"
echo " │   caption: string            — image alt text                  │"
echo " │   updatedAt: timestamp       — last upload time                │"
echo " │   updatedBy: string          — uploader email                  │"
echo " └─────────────────────────────────────────────────────────────────┘"
echo ""
echo " Indexes: NONE REQUIRED"
echo "   All queries are doc-by-ID reads or full-collection listeners."
echo ""
echo " Storage Layout:"
echo "   gs://${STORAGE_BUCKET}/${STORAGE_FOLDER}/images/  — verse/UI images"
echo "   gs://${STORAGE_BUCKET}/${STORAGE_FOLDER}/audio/   — verse audio files"
echo ""
echo " Image URLs follow pattern:"
echo "   ${IMAGE_BASE_URL}/{imageKey}/{filename}.{ext}"
echo ""
echo " ┌──────────────────────────────────────────────────────────────────┐"
echo " │ IMPORTANT: Server config changes needed for the new environment │"
echo " │                                                                  │"
echo " │ In server/index.ts, update:                                      │"
echo " │   BUCKET_NAME = \"${STORAGE_BUCKET}\"                              │"
echo " │   storagePath = \"${STORAGE_FOLDER}/images/\${imageKey}/...\"       │"
echo " │                                                                  │"
echo " │ In client/src/lib/firebase.ts, update:                           │"
echo " │   projectId: \"${TARGET_PROJECT_ID}\"                              │"
echo " │   storageBucket: \"${STORAGE_BUCKET}\"                             │"
echo " │   (+ apiKey, authDomain, appId, messagingSenderId)               │"
echo " └──────────────────────────────────────────────────────────────────┘"
echo ""
echo " Next steps:"
echo "   1. Upload actual image files to gs://${STORAGE_BUCKET}/${STORAGE_FOLDER}/images/"
echo "   2. Add admin emails to gita_config/admin_emails"
echo "   3. Update chapter visibility as chapters go live"
echo "   4. Update server & client Firebase config for new project"
echo ""
