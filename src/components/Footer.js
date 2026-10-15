/**
 * 页脚组件
 *
 * 比赛要求：作品需注明所用第三方库及用途。
 * 本作品不依赖任何 UI 框架与预设样式库，此处如实声明并给出数据出处。
 */

export function Footer(meta = {}) {
  const official = meta.official || {};
  const year = new Date().getFullYear();

  return `
  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <span class="brand-seal" aria-hidden="true">匠</span>
        <div>
          <strong>匠作</strong>
          <p>非物质文化遗产数字展馆与技艺互动体验</p>
        </div>
      </div>

      <div class="footer-cols">
        <div class="footer-col">
          <h3>浏览</h3>
          <ul>
            <li><a href="#/">首页</a></li>
            <li><a href="#/gallery">非遗名录</a></li>
            <li><a href="#/inheritors">传承人</a></li>
            <li><a href="#/simulator">技艺体验</a></li>
            <li><a href="#/about">关于本站</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h3>数据来源</h3>
          <ul>
            <li><a href="https://www.ihchina.cn" target="_blank" rel="noopener noreferrer">中国非物质文化遗产网 ↗</a></li>
            <li class="footer-note">文化和旅游部主管 · 中国艺术研究院主办</li>
          </ul>
        </div>

        <div class="footer-col">
          <h3>数据口径</h3>
          <ul>
            <li class="footer-note">国家级代表性项目 ${official.totalProjects ?? 1557} 项</li>
            <li class="footer-note">子项记录 ${official.totalSubItems ?? 3610} 条</li>
            <li class="footer-note">国家级代表性传承人 ${official.totalArtisans ?? 3998} 位</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="container footer-bottom-inner">
        <p>本站数据来自公开信息，仅供学习与展示之用，内容版权归原权利人所有。</p>
        <p class="footer-meta">
          <span>2026 武汉大学「零杯」网页设计大赛参赛作品</span>
          <span class="dot">·</span>
          <span>界面规格 1440 × 900</span>
          <span class="dot">·</span>
          <span>技术栈：原生 HTML / CSS / JavaScript</span>
          <span class="dot">·</span>
          <span>© ${year} 匠作</span>
        </p>
      </div>
    </div>
  </footer>`;
}
