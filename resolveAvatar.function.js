/**
 * OPTIONAL — not required, not wired in by default.
 *
 * The website's frontend already resolves X profile pictures reliably on
 * its own (via unavatar.io with a generated fallback). This file is only
 * for if you later want the picture to come from X's own official API
 * instead of a third-party proxy — the most accurate possible source,
 * and not subject to a public proxy's rate limits.
 *
 * Doing that requires a server, because it needs a secret Bearer Token
 * that must never be exposed in client-side code. This is a ready-to-
 * deploy Firebase Cloud Function example for that server piece.
 *
 * ── Setup ──────────────────────────────────────────────────────────
 * 1. Get a Bearer Token from the X Developer Portal
 *    (https://developer.x.com) — requires a developer account.
 * 2. Deploy this function to your existing Firebase project:
 *      firebase functions:secrets:set X_BEARER_TOKEN
 *      firebase deploy --only functions:resolveAvatar
 * 3. In index.html, before the closing </body> tag, add:
 *      <script>
 *        window.AVATAR_API_ENDPOINT = "https://<region>-<project>.cloudfunctions.net/resolveAvatar";
 *      </script>
 *    The frontend's resolveAvatarInto() already checks for
 *    window.AVATAR_API_ENDPOINT and will use it automatically —
 *    no other changes needed.
 *
 * Until you do this, the site keeps working exactly as it does now
 * (unavatar.io + generated fallback). This step is purely optional.
 * ──────────────────────────────────────────────────────────────────
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const X_BEARER_TOKEN = defineSecret("X_BEARER_TOKEN");

exports.resolveAvatar = onRequest(
  { secrets: [X_BEARER_TOKEN], cors: true },
  async (req, res) => {
    const username = (req.query.username || "").toString().replace("@", "").trim();

    if (!username || !/^[A-Za-z0-9_]{1,15}$/.test(username)) {
      res.status(400).json({ error: "Invalid username" });
      return;
    }

    try {
      const apiRes = await fetch(
        `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=profile_image_url`,
        { headers: { Authorization: `Bearer ${X_BEARER_TOKEN.value()}` } }
      );

      if (!apiRes.ok) {
        res.status(apiRes.status).json({ error: "X API lookup failed" });
        return;
      }

      const json = await apiRes.json();
      const rawUrl = json && json.data && json.data.profile_image_url;

      if (!rawUrl) {
        res.status(404).json({ error: "No profile image found" });
        return;
      }

      // X returns a low-res "_normal" thumbnail by default — request the full-size version.
      const fullSizeUrl = rawUrl.replace("_normal", "");

      res.set("Cache-Control", "public, max-age=3600");
      res.status(200).json({ profile_image_url: fullSizeUrl });
    } catch (err) {
      res.status(500).json({ error: "Internal resolver error" });
    }
  }
);
