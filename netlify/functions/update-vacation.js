// netlify/functions/update-vacation.js
import { Octokit } from "octokit";

export default async (req, context) => {
  try{
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const { jsonUrl, data } = await req.json();

    // 1) jsonUrl parsen → owner, repo, path, branch
    // Beispiel: https://raw.githubusercontent.com/OWNER/REPO/refs/heads/main/vacation.json
    const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/refs\/heads\/([^/]+)\/(.+)$/.exec(jsonUrl);
    if(!m) return new Response(JSON.stringify({ error:'Invalid jsonUrl' }), { status: 400 });

    const [, owner, repo, branch, path] = m;

    // 2) Validierung der Daten
    const iso = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!data || !iso(data.start) || !iso(data.end)) {
      return new Response(JSON.stringify({ error:'start/end must be YYYY-MM-DD' }), { status: 400 });
    }
    if (data.text && typeof data.text !== 'string') {
      return new Response(JSON.stringify({ error:'text must be string' }), { status: 400 });
    }
    if (data.color && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(data.color)) {
      return new Response(JSON.stringify({ error:'invalid color' }), { status: 400 });
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) return new Response(JSON.stringify({ error:'Missing GITHUB_TOKEN' }), { status: 500 });

    const octokit = new Octokit({ auth: token });

    // 3) Hol aktuellen SHA (falls Datei schon existiert)
    let sha = undefined;
    try{
      const getRes = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', { owner, repo, path, ref: branch });
      sha = getRes.data.sha;
    }catch(e){ /* 404 -> neue Datei */ }

    // 4) Commit vorbereiten
    const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64');

    const putRes = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
      owner, repo, path,
      message: `chore: update vacation.json (${new Date().toISOString()})`,
      content,
      branch,
      sha // nur setzen, wenn vorhanden; sonst neuer File-Blob
    });

    const commitSha = putRes.data.commit && putRes.data.commit.sha;

    return new Response(JSON.stringify({ ok:true, commitSha }), {
      status: 200,
      headers: { 'Content-Type':'application/json' }
    });
  }catch(err){
    return new Response(JSON.stringify({ error: String(err.message||err) }), { status: 500 });
  }
};
