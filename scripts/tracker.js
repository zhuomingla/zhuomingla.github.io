// scripts/tracker.js
hexo.extend.generator.register('tracker', function (locals) {
  const posts = locals.posts;
  const config = hexo.locals.get('data').tracker || {};
  const projectsConfig = config.projects || [];

  // 1. 抓取所有带 'tracker' 标签的文章
  const records = [];
  posts.forEach(post => {
    const tagNames = post.tags.map(t => t.name);
    if (tagNames.includes('tracker')) {
      // 找到除 tracker 外的第一个标签作为项目名
      const projectName = tagNames.find(t => t !== 'tracker') || '其他';

      // 【修改这里】：确保路径以 / 开头，防止相对路径拼接错误
      let absoluteLink = post.path;
      if (!absoluteLink.startsWith('/') && !absoluteLink.startsWith('http')) {
        absoluteLink = '/' + absoluteLink;
      }

      records.push({
        date: post.date.format('YYYY-MM-DD'),
        project: projectName,
        title: post.title,
        link: absoluteLink, // 使用处理后的绝对路径
      });
    }
  });

  // 2. 整理项目列表（合并 YAML 配置和实际文章里的标签）
  const projectsMap = new Map();
  projectsConfig.forEach(p => projectsMap.set(p.id, p));

  let fallbackIndex = 0;
  const fallbackColors = config.settings?.fallback_colors || ['#7aa2f7'];

  const allProjectNames = new Set([...projectsMap.keys(), ...records.map(r => r.project)]);

  const projectsData = Array.from(allProjectNames).map(name => {
    if (projectsMap.has(name)) {
      return { id: name, name: name, ...projectsMap.get(name) };
    } else {
      // 未在 YAML 中配置的新项目，自动分配颜色
      const color = fallbackColors[fallbackIndex % fallbackColors.length];
      fallbackIndex++;
      return { id: name, name: name, color: color, goal: '' };
    }
  });

  // 3. 生成包含这些数据的独立 HTML 页面
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>项目追踪</title>
<style>
  :root {
    --bg: #0f1115; --panel: #181b22; --border: #262a33;
    --text: #e6e8ec; --muted: #8b90a0; --cell-empty: #1f232c;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f6f7f9; --panel: #ffffff; --border: #e3e6ec;
      --text: #1c1f26; --muted: #6b7280; --cell-empty: #eceef2;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    line-height: 1.6;
  }
  a { text-decoration: none; color: inherit; }

  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 24px; border-bottom: 1px solid var(--border);
    background: var(--panel); position: sticky; top: 0; z-index: 10;
  }
  .topbar-left { display: flex; align-items: center; gap: 16px; }
  .topbar .back { color: var(--muted); font-size: 14px; }
  .topbar .back:hover { text-decoration: underline; }
  .topbar h1 { margin: 0; font-size: 18px; }

  .controls { display: flex; gap: 8px; }
  .controls button {
    background: var(--bg); border: 1px solid var(--border);
    color: var(--text); padding: 4px 12px; border-radius: 6px;
    cursor: pointer; font-size: 13px; transition: all .2s;
  }
  .controls button:hover { border-color: var(--muted); }
  .controls button.active {
    background: var(--text); color: var(--bg); border-color: var(--text);
  }

  .container { padding: 24px; overflow-x: auto; max-width: 100%; }
  .tracker { border-collapse: separate; border-spacing: 3px; margin: 0 auto; }
  .tracker th, .tracker td { padding: 0; }
  .corner { width: 180px; }
  .date-head {
    font-size: 11px; color: var(--muted); font-weight: normal;
    text-align: center; height: 20px; min-width: 22px;
  }
  .project-name {
    text-align: left; vertical-align: middle;
    padding-right: 12px; min-width: 180px; white-space: nowrap;
  }
  .name-line { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .goal-line { font-size: 12px; color: var(--muted); }
  .streak {
    display: inline-block; font-size: 11px; font-weight: normal;
    background: rgba(224,175,104,.15); color: #e0af68;
    padding: 1px 6px; border-radius: 10px;
  }
  .cell {
    width: 22px; height: 22px; min-width: 22px;
    background: var(--cell-empty); border-radius: 3px;
    transition: transform .1s;
  }
  .cell.checked { cursor: pointer; }
  .cell.checked:hover { transform: scale(1.3); z-index: 2; position: relative; }
  .cell:not(.checked):hover { background: var(--border); }

  /* 自定义提示框 */
  .tooltip {
    position: fixed; background: var(--panel); border: 1px solid var(--border);
    padding: 8px 12px; border-radius: 6px; font-size: 13px; pointer-events: none;
    opacity: 0; transition: opacity .15s; z-index: 100;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2); max-width: 300px;
  }
  .tooltip.show { opacity: 1; }
  .tooltip-title { font-weight: 600; margin-bottom: 4px; color: var(--text); }
  .tooltip-meta { color: var(--muted); font-size: 12px; }

  .legend {
    max-width: 900px; margin: 24px auto 0; padding: 16px 24px;
    font-size: 13px; color: var(--muted); text-align: center;
  }
  .legend code {
    background: var(--panel); padding: 2px 6px;
    border-radius: 4px; border: 1px solid var(--border);
  }
</style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-left">
      <a href="/" class="back">← 返回博客</a>
      <h1>📋 项目追踪</h1>
    </div>
    <div class="controls">
      <button data-days="30">30 天</button>
      <button data-days="90" class="active">90 天</button>
      <button data-days="180">180 天</button>
      <button data-days="365">1 年</button>
    </div>
  </div>

  <div class="container">
    <table class="tracker" id="trackerTable">
      <thead id="trackerHead"></thead>
      <tbody id="trackerBody"></tbody>
    </table>
  </div>

  <div class="legend">
    格子亮起 = 当天有打卡 · 悬停看备注 · 点击跳转博客文章<br>
    通过给文章打 <code>tracker</code> 和项目标签自动生成
  </div>

  <div class="tooltip" id="tooltip">
    <div class="tooltip-title" id="tooltipTitle"></div>
    <div class="tooltip-meta" id="tooltipMeta"></div>
  </div>

<script>
  // 由 Hexo 注入的静态数据
  const PROJECTS = ${JSON.stringify(projectsData)};
  const RECORDS = ${JSON.stringify(records)};
  let currentDays = 90;

  // 建立快速索引: projectId -> { date -> record }
  const recordMap = {};
  RECORDS.forEach(r => {
    if (!recordMap[r.project]) recordMap[r.project] = {};
    recordMap[r.project][r.date] = r;
  });

  const tooltip = document.getElementById('tooltip');
  const tooltipTitle = document.getElementById('tooltipTitle');
  const tooltipMeta = document.getElementById('tooltipMeta');

  function render(days) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const dateList = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      // 使用本地时间避免时区导致日期偏移
      dateList.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'));
    }

    // 渲染表头
    const headHtml = '<tr><th class="corner"></th>' +
      dateList.map((date, i) => {
        const d = new Date(date);
        const isMonday = d.getDay() === 1;
        const show = isMonday || i === dateList.length - 1;
        return \`<th class="date-head">\${show ? (d.getMonth()+1) + '/' + d.getDate() : ''}</th>\`;
      }).join('') + '</tr>';
    document.getElementById('trackerHead').innerHTML = headHtml;

    // 渲染表体
    const bodyHtml = PROJECTS.map(p => {
      const map = recordMap[p.id] || {};

      // 计算连续打卡
      let streak = 0;
      for (let i = dateList.length - 1; i >= 0; i--) {
        if (map[dateList[i]]) streak++;
        else break;
      }

      const streakHtml = streak > 0 ? \`<span class="streak">🔥 \${streak} 天</span>\` : '';

      const cells = dateList.map(date => {
        const record = map[date];
        if (record) {
          return \`<td class="cell checked" style="background:\${p.color}" data-date="\${date}" data-project="\${p.id}" data-title="\${escapeHtml(record.title)}" data-link="\${record.link}"></td>\`;
        }
        return \`<td class="cell"></td>\`;
      }).join('');

      return \`<tr>
        <th class="project-name">
          <div class="name-line"><span style="color:\${p.color}">\${escapeHtml(p.name)}</span> \${streakHtml}</div>
          <div class="goal-line">\${escapeHtml(p.goal || '')}</div>
        </th>
        \${cells}
      </tr>\`;
    }).join('');
    document.getElementById('trackerBody').innerHTML = bodyHtml;

    bindEvents();
  }

  function bindEvents() {
    document.querySelectorAll('.cell.checked').forEach(cell => {
      cell.addEventListener('mouseenter', (e) => {
        const title = cell.dataset.title;
        const date = cell.dataset.date;
        tooltipTitle.textContent = title;
        tooltipMeta.textContent = date;

        const rect = cell.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.top - 50) + 'px';
        tooltip.classList.add('show');
      });

      cell.addEventListener('mouseleave', () => {
        tooltip.classList.remove('show');
      });

      cell.addEventListener('click', () => {
        const link = cell.dataset.link;
        if (link) window.open(link, '_blank');
      });
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 绑定控制按钮
  document.querySelectorAll('.controls button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.controls button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDays = parseInt(btn.dataset.days, 10);
      render(currentDays);
    });
  });

  // 初始渲染
  render(currentDays);
</script>
</body>
</html>`;

  return {
    path: 'tracker/index.html',
    layout: false,
    data: html
  };
});
