// netlify/functions/update-vacation.mjs
import { Octokit } from "octokit";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { jsonUrl, data } = JSON.parse(event.body || "{}");

    // Erwartetes Format:
    // https://raw.githubusercontent.com/OWNER/REPO/refs/heads/BRANCH/path/to/vacation.json
    const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/refs\/heads\/([^/]+)\/(.+)$/.exec(jsonUrl || "");
    if (!m) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid jsonUrl" }) };
    }
    const [, owner, repo, branch, path] = m;

    // Validierung
    const iso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
    if (!data || !iso(data.start) || !iso(data.end)) {
      return { statusCode: 400, body: JSON.stringify({ error: "start/end must be YYYY-MM-DD" }) };
    }
    if (data.text && typeof data.text !== "string") {
      return { statusCode: 400, body: JSON.stringify({ error: "text must be string" }) };
    }
    if (data.color && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(data.color)) {
      return { statusCode: 400, body: JSON.stringify({ error: "invalid color" }) };
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing GITHUB_TOKEN" }) };
    }

    const octokit = new Octokit({ auth: token });

    // vorhandene Datei- SHA holen (falls existiert)
    let sha;
    try {
      const get = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner, repo, path, ref: branch
      });
      sha = get.data.sha;
    } catch (_) { /* 404 ok → neue Datei */ }

    const content = Buffer.from(JSON.stringify(data, null, 2), "utf8").toString("base64");

    const put = await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      owner, repo, path, branch,
      message: `chore: update vacation.json (${new Date().toISOString()})`,
      content, sha
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, commitSha: put.data.commit.sha }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err.message || err) }) };
  }
}
