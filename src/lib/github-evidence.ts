// Fetch real deliverable artifacts: GitHub PR diff / commit info via public API.
// Returns structured evidence Agent A actually reasons over.

export interface ArtifactEvidence {
  kind: 'github_pr' | 'github_commit' | 'repo_only' | 'none';
  repoFullName?: string;
  prNumber?: number;
  prTitle?: string;
  prBody?: string;
  filesChanged?: { filename: string; additions: number; deletions: number; status: string; patch?: string }[];
  diffText?: string;
  commitSha?: string;
  testReportText?: string;
  fetchError?: string;
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'User-Agent': 'misthos-oracle', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_ACCESS_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_ACCESS_TOKEN}`;
  return h;
}

async function ghJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  return res.json();
}

export async function fetchArtifactEvidence(input: {
  repoUrl?: string;
  pullRequestUrl?: string;
  commitSha?: string;
  description?: string;
}): Promise<ArtifactEvidence> {
  const prMatch = input.pullRequestUrl?.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  const repoMatch = input.repoUrl?.match(/github\.com\/([^/]+)\/([^/]+)/);

  try {
    if (prMatch) {
      const [, owner, repo, prNum] = prMatch;
      const full = `${owner}/${repo}`;
      const pr = await ghJson(`https://api.github.com/repos/${full}/pulls/${prNum}`);
      const files = await ghJson(`https://api.github.com/repos/${full}/pulls/${prNum}/files?per_page=50`);

      const filesChanged = (files || []).map((f: any) => ({
        filename: f.filename,
        additions: f.additions,
        deletions: f.deletions,
        status: f.status,
        patch: f.patch ? String(f.patch).slice(0, 2000) : undefined,
      }));

      const diffText = filesChanged
        .map((f: any) => `--- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})\n${f.patch || '[binary or too large]'}`)
        .join('\n\n')
        .slice(0, 24000);

      return {
        kind: 'github_pr',
        repoFullName: full,
        prNumber: Number(prNum),
        prTitle: pr.title,
        prBody: (pr.body || '').slice(0, 3000),
        filesChanged,
        diffText,
        commitSha: pr.head?.sha,
      };
    }

    if (repoMatch) {
      const [, owner, repo] = repoMatch;
      const full = `${owner}/${repo}`;
      if (input.commitSha) {
        const commit = await ghJson(`https://api.github.com/repos/${full}/commits/${input.commitSha}`);
        const filesChanged = (commit.files || []).slice(0, 50).map((f: any) => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          status: f.status,
          patch: f.patch ? String(f.patch).slice(0, 2000) : undefined,
        }));
        const diffText = filesChanged
          .map((f: any) => `--- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})\n${f.patch || '[binary or too large]'}`)
          .join('\n\n')
          .slice(0, 24000);
        return {
          kind: 'github_commit',
          repoFullName: full,
          filesChanged,
          diffText,
          commitSha: commit.sha,
          prTitle: commit.commit?.message?.split('\n')[0],
          prBody: commit.commit?.message,
        };
      }
      return { kind: 'repo_only', repoFullName: full, commitSha: input.commitSha };
    }
  } catch (e: any) {
    return { kind: 'none', fetchError: e.message, commitSha: input.commitSha };
  }

  return { kind: 'none', commitSha: input.commitSha };
}
