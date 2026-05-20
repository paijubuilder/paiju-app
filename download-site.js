const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BASE_URL = 'https://app-bjaapbe7wkqp.appmiaoda.com';
const OUTPUT_DIR = path.join(__dirname, 'web-static');

// 创建输出目录
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 已下载的URL集合，避免重复下载
const downloadedUrls = new Set();

/**
 * 发送HTTP请求并获取响应
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
      timeout: 10000,
    };

    const req = client.request(options, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        console.log(`重定向: ${url} -> ${redirectUrl}`);
        resolve(fetchUrl(redirectUrl));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          data: buffer,
          headers: res.headers,
          contentType: res.headers['content-type'] || '',
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout: ${url}`));
    });

    req.end();
  });
}

/**
 * 保存文件到本地
 */
function saveFile(relativePath, data) {
  const filePath = path.join(OUTPUT_DIR, relativePath);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, data);
  console.log(`✓ 已保存: ${relativePath}`);
}

/**
 * 从HTML中提取资源链接
 */
function extractResources(html, baseUrl) {
  const resources = [];

  // 匹配 script src
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    resources.push(match[1]);
  }

  // 匹配 link href (CSS)
  const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    if (match[1].endsWith('.css')) {
      resources.push(match[1]);
    }
  }

  // 匹配 img src
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  while ((match = imgRegex.exec(html)) !== null) {
    resources.push(match[1]);
  }

  // 转换为绝对URL
  return resources.map(resource => {
    try {
      return new URL(resource, baseUrl).toString();
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

/**
 * 获取相对路径
 */
function getRelativePath(url, baseUrl) {
  try {
    const parsedUrl = new URL(url);
    const parsedBase = new URL(baseUrl);

    if (parsedUrl.hostname !== parsedBase.hostname) {
      return null; // 外部资源跳过
    }

    let pathname = parsedUrl.pathname;
    if (pathname === '/') {
      pathname = '/index.html';
    }

    // 移除开头的斜杠
    return pathname.startsWith('/') ? pathname.substring(1) : pathname;
  } catch (e) {
    return null;
  }
}

/**
 * 下载单个资源
 */
async function downloadResource(url, depth = 0) {
  if (depth > 3) {
    console.log(`跳过深层资源: ${url}`);
    return;
  }

  if (downloadedUrls.has(url)) {
    return;
  }

  downloadedUrls.add(url);

  try {
    console.log(`下载中 (${depth}): ${url}`);
    const { data, contentType } = await fetchUrl(url);

    const relativePath = getRelativePath(url, BASE_URL);
    if (!relativePath) {
      console.log(`跳过外部资源: ${url}`);
      return;
    }

    saveFile(relativePath, data);

    // 如果是HTML，提取并下载其中的资源
    if (contentType.includes('text/html') || relativePath.endsWith('.html')) {
      const html = data.toString('utf-8');
      const resources = extractResources(html, url);

      for (const resource of resources) {
        await downloadResource(resource, depth + 1);
      }
    }
  } catch (error) {
    console.error(`✗ 下载失败: ${url} - ${error.message}`);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log(`开始下载网站资源: ${BASE_URL}`);
  console.log(`输出目录: ${OUTPUT_DIR}\n`);

  // 下载主页
  await downloadResource(BASE_URL);

  // 额外下载常见的入口文件
  const commonPaths = [
    '/index.html',
    '/manifest.json',
    '/favicon.ico',
  ];

  for (const p of commonPaths) {
    const url = BASE_URL + p;
    if (!downloadedUrls.has(url)) {
      await downloadResource(url);
    }
  }

  console.log(`\n✓ 下载完成！共下载 ${downloadedUrls.size} 个资源`);
  console.log(`输出目录: ${OUTPUT_DIR}`);

  // 验证index.html
  const indexPath = path.join(OUTPUT_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    console.log('✓ index.html 存在');
  } else {
    console.error('✗ 错误: index.html 不存在！');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('致命错误:', err);
  process.exit(1);
});
