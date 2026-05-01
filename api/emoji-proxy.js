// 表情搜索代理：转发到免费表情API，规避跨域限制
const EMOJI_API = 'https://doutu.iiii.run/search'; // 免费表情搜索API

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const keyword = req.query.keyword || req.body?.keyword;
  if (!keyword) return res.status(400).json({ error: 'keyword required' });

  try {
    const response = await fetch(`${EMOJI_API}?keyword=${encodeURIComponent(keyword)}`);
    const data = await response.json();
    // 假设返回格式: { images: [{ url: '...' }] }，做安全处理
    const images = (data.images || data.data || []).slice(0, 20).map(img => ({
      url: img.url || img.src || img.thumb
    })).filter(img => img.url);
    res.status(200).json({ images });
  } catch (error) {
    res.status(500).json({ error: 'Emoji search failed' });
  }
}