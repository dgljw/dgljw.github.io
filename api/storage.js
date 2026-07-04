const GITHUB_API = 'https://api.github.com';
const OWNER = process.env.GITHUB_OWNER || 'dgljw';
const REPO = process.env.GITHUB_REPO || 'dgljw.github.io';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const ROOT = (process.env.GITHUB_STORAGE_ROOT || 'drive-storage').replace(/^\/+|\/+$/g, '');
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function OPTIONS() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export async function POST(request) {
    try {
        const formData = await request.formData();
        const action = formData.get('action') || 'upload';
        const folder = formData.get('folder') || '/';

        if (action === 'folder') {
            const name = sanitizeName(formData.get('name') || '');
            if (!name) return json({ error: 'Folder name required' }, 400);

            const path = toRepoPath(folder, `${name}/.folder`);
            await putContent(path, '', `create folder ${name}`);

            return json({
                success: true,
                item: {
                    id: path,
                    name,
                    type: 'folder',
                    folder: normalizeFolder(folder),
                    path: pathToClientPath(path.replace(/\/\.folder$/, '')),
                    uploadedAt: Date.now()
                }
            });
        }

        const file = formData.get('file');
        if (!file) return json({ error: 'No file provided' }, 400);
        if (file.size > MAX_UPLOAD_BYTES) {
            return json({ error: '当前云端函数上传上限为 4MB，较大文件需要接入 Vercel Blob、R2 或 S3 直传。' }, 413);
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const name = sanitizeName(file.name);
        const path = await getAvailablePath(toRepoPath(folder, name));
        const result = await putContent(path, buffer.toString('base64'), `upload ${name}`);

        return json({
            success: true,
            file: {
                id: path,
                name: path.split('/').pop(),
                type: file.type || mimeFromName(path),
                size: file.size,
                folder: normalizeFolder(folder),
                uploadedAt: Date.now(),
                path: pathToClientPath(path),
                url: result.content?.download_url || rawUrl(path),
                sha: result.content?.sha
            }
        });
    } catch (err) {
        console.error('Storage API error:', err);
        return json({ error: err.message || 'Server error' }, err.status || 500);
    }
}

export async function GET(request) {
    try {
        const url = new URL(request.url);
        const folder = url.searchParams.get('folder') || '/';
        const repoPath = toRepoPath(folder);
        const items = await listContent(repoPath);

        const folders = [];
        const files = [];

        for (const item of items) {
            if (item.name === '.folder') continue;
            if (item.type === 'dir') {
                folders.push({
                    id: item.path,
                    name: item.name,
                    type: 'folder',
                    folder: normalizeFolder(folder),
                    path: pathToClientPath(item.path),
                    uploadedAt: Date.now()
                });
            } else if (item.type === 'file') {
                files.push({
                    id: item.path,
                    name: item.name,
                    type: mimeFromName(item.name),
                    size: item.size || 0,
                    folder: normalizeFolder(folder),
                    path: pathToClientPath(item.path),
                    uploadedAt: Date.now(),
                    url: item.download_url || rawUrl(item.path),
                    sha: item.sha
                });
            }
        }

        return json({ success: true, files, folders });
    } catch (err) {
        if (err.status === 404) return json({ success: true, files: [], folders: [] });
        return json({ error: err.message }, err.status || 500);
    }
}

export async function DELETE(request) {
    try {
        const url = new URL(request.url);
        const pathParam = url.searchParams.get('path') || url.searchParams.get('fileId');
        const type = url.searchParams.get('type') || 'file';
        const sha = url.searchParams.get('sha');

        if (!pathParam) return json({ error: 'File path required' }, 400);

        const repoPath = clientPathToRepoPath(pathParam);
        if (type === 'folder') {
            await deleteFolder(repoPath);
        } else {
            await deleteFile(repoPath, sha);
        }

        return json({ success: true, message: 'Deleted' });
    } catch (err) {
        return json({ error: err.message }, err.status || 500);
    }
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
}

function authHeaders() {
    if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not configured');
    return {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'deepseek-drive'
    };
}

function normalizeFolder(folder) {
    const clean = String(folder || '/').replace(/\\/g, '/').replace(/\/+/g, '/');
    const trimmed = clean.replace(/^\/+|\/+$/g, '');
    return trimmed ? `/${trimmed}` : '/';
}

function sanitizeName(name) {
    return String(name || '')
        .trim()
        .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '_')
        .replace(/\s+/g, ' ')
        .slice(0, 120);
}

function toRepoPath(folder, name = '') {
    const normalized = normalizeFolder(folder).replace(/^\/+/, '');
    const parts = [ROOT];
    if (normalized) parts.push(...normalized.split('/').map(sanitizeName).filter(Boolean));
    if (name) parts.push(...String(name).split('/').map(sanitizeName).filter(Boolean));
    return parts.join('/');
}

function pathToClientPath(repoPath) {
    const relative = repoPath.replace(new RegExp(`^${ROOT}/?`), '');
    return relative ? `/${relative}` : '/';
}

function clientPathToRepoPath(clientPath) {
    const clean = String(clientPath || '').replace(/^\/+/, '');
    if (clean.startsWith(`${ROOT}/`)) return clean;
    return clean ? `${ROOT}/${clean}` : ROOT;
}

async function githubFetch(path, options = {}) {
    const res = await fetch(`${GITHUB_API}${path}`, {
        ...options,
        headers: { ...authHeaders(), ...(options.headers || {}) }
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
        const error = new Error(data?.message || `GitHub API error: ${res.status}`);
        error.status = res.status;
        throw error;
    }
    return data;
}

async function getContent(path) {
    return githubFetch(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponentPath(path)}?ref=${BRANCH}`);
}

async function listContent(path) {
    const data = await getContent(path);
    return Array.isArray(data) ? data : [];
}

async function putContent(path, content, message) {
    let sha;
    try {
        const existing = await getContent(path);
        sha = existing.sha;
    } catch (err) {
        if (err.status !== 404) throw err;
    }

    return githubFetch(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponentPath(path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message,
            content,
            branch: BRANCH,
            ...(sha ? { sha } : {})
        })
    });
}

async function getAvailablePath(path) {
    const dir = path.split('/').slice(0, -1).join('/');
    const filename = path.split('/').pop();
    const dot = filename.lastIndexOf('.');
    const base = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot) : '';
    let candidate = path;

    for (let i = 1; i < 100; i++) {
        try {
            await getContent(candidate);
            candidate = `${dir}/${base} (${i})${ext}`;
        } catch (err) {
            if (err.status === 404) return candidate;
            throw err;
        }
    }
    return candidate;
}

async function deleteFile(path, knownSha) {
    let sha = knownSha;
    if (!sha) {
        const item = await getContent(path);
        if (item.type !== 'file') return;
        sha = item.sha;
    }
    await githubFetch(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponentPath(path)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: `delete ${path}`,
            sha,
            branch: BRANCH
        })
    });
}

async function deleteFolder(path) {
    let items = [];
    try {
        items = await listContent(path);
    } catch (err) {
        if (err.status === 404) return;
        throw err;
    }

    for (const item of items) {
        if (item.type === 'dir') {
            await deleteFolder(item.path);
        } else {
            await deleteFile(item.path);
        }
    }
}

function encodeURIComponentPath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
}

function rawUrl(path) {
    return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${encodeURIComponentPath(path)}`;
}

function mimeFromName(name) {
    const ext = String(name).split('.').pop().toLowerCase();
    const map = {
        pdf: 'application/pdf',
        txt: 'text/plain',
        md: 'text/markdown',
        json: 'application/json',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        mp4: 'video/mp4',
        zip: 'application/zip'
    };
    return map[ext] || 'application/octet-stream';
}
