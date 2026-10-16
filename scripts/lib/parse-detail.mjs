/**
 * 详情页解析器（共享模块）
 *
 * 由 scripts/fetch-details.mjs 抽出，供两个抓取脚本共用：
 *   - fetch-details.mjs      按关键词抓精选项目（策展视角）
 *   - fetch-all-details.mjs  按 id 抓全部记录（补齐名录每一个条目）
 *
 * ⚠️ 改这里的正则等于同时改两个脚本的产出，改完两边都要重跑验证。
 */

/** 解码 HTML 实体 */
export function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&mdash;/g, '—');
}

/**
 * 解析一个 <td>：其内部结构为 `<div class="name">标签</div>值`。
 * 返回 { label, value }。
 */
export function parseCell(tdHtml) {
  const labelMatch = tdHtml.match(/<div class="name">([\s\S]*?)<\/div>/);
  const label = labelMatch ? decodeEntities(labelMatch[1].replace(/<[^>]+>/g, '')).trim() : '';
  const valueHtml = labelMatch ? tdHtml.slice(labelMatch.index + labelMatch[0].length) : tdHtml;
  const value = decodeEntities(valueHtml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')).trim();
  return { label, value };
}

/** 解析表格，返回行数组（每行是 {表头: 值} 对象） */
export function parseTable(tableHtml) {
  const headers = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map(m => decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
  const rows = [];
  for (const tr of tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const tds = [...tr[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => parseCell(m[1]));
    if (!tds.length) continue;
    const obj = {};
    tds.forEach((cell, i) => {
      // 优先用 <div class="name"> 的标签作为键，回退到表头
      const key = cell.label || headers[i] || `col${i}`;
      obj[key] = cell.value;
    });
    rows.push(obj);
  }
  return { headers, rows };
}

/** 从详情页 HTML 解析结构化数据 */
export function parseDetail(html) {
  const out = {};

  // ── 基础表格字段 ──
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0]);
  if (tables[0]) {
    const cells = [...tables[0].matchAll(/<div class="p">([\s\S]*?)<\/div>/gi)]
      .map(m => decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim())
      .filter(Boolean);
    for (const c of cells) {
      const m = c.match(/^([^：:]+)[：:](.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim();
      if (/项目序号/.test(key)) out.projectIndex = val;
      else if (/项目编号/.test(key)) out.projectCode = val;
      else if (/公布时间/.test(key)) out.publishTime = val;
      else if (/^类别/.test(key)) out.category = val;
      else if (/所属地区/.test(key)) out.region = val;
      else if (/^类型/.test(key)) out.projectType = val;
      else if (/申报地区或单位/.test(key)) out.declareUnit = val;
      else if (/保护单位/.test(key)) out.protectUnit = val;
    }
  }

  // ── 传承人表格：表头含「姓名」，且数据行含「性别」 ──
  for (const t of tables) {
    if (!/姓名/.test(t) || !/性别/.test(t)) continue;
    const { rows } = parseTable(t);
    const inheritors = rows
      .filter(r => {
        const name = r['姓名'] || r[Object.keys(r)[1]] || '';
        return name && !/姓名/.test(name);
      })
      .map(r => ({
        code: (r['编号'] || '').trim(),
        name: (r['姓名'] || '').trim(),
        gender: (r['性别'] || '').trim(),
        // ⚠️ 官网表头为「出生日期」（非「出生年月」），此处兼容两种写法
        birth: (r['出生日期'] || r['出生年月'] || '').trim(),
        ethnicity: (r['民族'] || '').trim(),
        category: (r['类别'] || '').trim(),
        projectCode: (r['项目编号'] || '').trim(),
        projectName: (r['项目名称'] || '').trim(),
        declareUnit: (r['申报地区或单位'] || '').trim(),
      }))
      .filter(x => x.name);
    if (inheritors.length) {
      out.inheritors = inheritors;
      // 传承人详情链接
      const links = [...t.matchAll(/href="(\/ccr_detail\/\d+\.html)"/gi)].map(m => m[1]);
      if (links.length) out.inheritorLinks = [...new Set(links)];
      break;
    }
  }

  // ── 项目介绍正文：第一个 table 之后到「相关传承人」之前 ──
  const afterTable = html.split('</table>')[1] || '';
  let body = afterTable.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  let cut = body.length;
  for (const mk of ['相关传承人', '<table', '相关资讯']) {
    const idx = body.indexOf(mk);
    if (idx > 50 && idx < cut) cut = idx;
  }
  body = body.slice(0, cut);
  const introText = decodeEntities(body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  if (introText.length > 30) out.intro = introText;

  // ── 图片（排除导航图标） ──
  const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/gi)]
    .map(m => m[1])
    .filter(src => /Uploads\/Picture\/20(1[7-9]|2[0-9])/.test(src))
    .filter(src => !/s5bdabd|s5bdabda|s5bdabdb|s5bebd17|s5bef8f3|s5bdabe1|s5bf3825|s5d9be0/.test(src));
  if (imgs.length) out.images = [...new Set(imgs)];

  return out;
}
