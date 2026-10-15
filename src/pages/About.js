/**
 * 关于页
 *
 * 评分细则「文档」5 分（没有0 / 简单3 / 清晰完整5），
 * 且比赛要求「作品须注明所用第三方库及用途」。
 * 本页承载：作品说明、数据来源与口径、技术栈声明、
 * 第三方资源声明、无障碍与适配说明。
 */

import { getMeta, getProjects, getDetails, getInheritorStats, num, esc } from '../data.js';
import { SectionTitle } from '../components/ui.js';

export async function AboutPage() {
  const [meta, projects, details, inhStats] = await Promise.all([
    getMeta(), getProjects(), getDetails(), getInheritorStats(),
  ]);
  const official = meta.official || {};
  const detailCount = Object.keys(details.details || {}).length;

  return `
  <section class="page-head">
    <div class="container">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="#/">首页</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">关于本站</span>
      </nav>
      ${SectionTitle({ num: '伍', title: '关于本站', sub: '作品说明、数据来源与技术声明。' })}
    </div>
  </section>

  <section class="section-tight">
    <div class="container about-layout">

      <div class="about-main">

        <article class="about-block" id="about-what">
          <h2>这座展馆是什么</h2>
          <p>
            <strong>匠作</strong>是一座关于中国非物质文化遗产的数字展馆。
            它不是一份资料汇编，而是一次「重新介绍」的尝试——
            把名录里那些只剩一个名字的手艺，重新讲成有人、有工序、有温度的事。
          </p>
          <p>
            全站内容取自中国非物质文化遗产网公开信息，共收录
            <strong>${num(projects.length)} 条</strong>按申报地区拆分的子项记录，
            覆盖十大门类、${num(meta.byRegion?.length || 34)} 个省级行政区与五批公布年表。
            其中 <strong>${num(detailCount)} 个项目</strong>建立了完整详情页，
            含官方项目介绍与国家级代表性传承人档案；
            站内另为 <strong>${num(inhStats.total)} 位传承人</strong>建立了可检索、可逐人翻阅的独立档案页。
          </p>
          <p>
            此外，本站把三门手艺做成了可交互的体验：
            <a href="#/simulator">苏绣的针法</a>、宣纸的帘纹、榫卯的咬合。
            目的很简单——让「非遗」这两个字从名词变成动词。
          </p>
        </article>

        <article class="about-block" id="about-data">
          <h2>数据来源与统计口径</h2>
          <p>
            本站数据抓取自
            <a href="https://www.ihchina.cn" target="_blank" rel="noopener noreferrer">中国非物质文化遗产网 · 中国非物质文化遗产数字博物馆 ↗</a>
            （中华人民共和国文化和旅游部主管，中国艺术研究院主办）。
          </p>

          <div class="about-table-wrap">
            <table class="about-table">
              <caption>官方公开口径与本站收录量对照</caption>
              <thead>
                <tr><th scope="col">指标</th><th scope="col">官方公布</th><th scope="col">本站收录</th></tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">国家级代表性项目</th>
                  <td>${num(official.totalProjects || 1557)} 项</td>
                  <td>—（不重复统计）</td>
                </tr>
                <tr>
                  <th scope="row">按申报地区拆分的子项</th>
                  <td>${num(official.totalSubItems || 3610)} 条</td>
                  <td>${num(projects.length)} 条</td>
                </tr>
                <tr>
                  <th scope="row">国家级代表性传承人</th>
                  <td>${num(official.totalArtisans || 3998)} 位</td>
                  <td>${num(inhStats.total)} 位已建档</td>
                </tr>
                <tr>
                  <th scope="row">列入联合国教科文组织名录</th>
                  <td>${num(official.unescoItems || 45)} 项</td>
                  <td>—（未单独建页）</td>
                </tr>
                <tr>
                  <th scope="row">公布批次</th>
                  <td>${num(official.batches || 5)} 批</td>
                  <td>${num(official.batches || 5)} 批（完整）</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="about-callout">
            <h3>为什么会看到两个不同的数字？</h3>
            <p>
              官方公布的「国家级代表性项目 1557 项」是<strong>项目数</strong>；
              而本站收录的 ${num(projects.length)} 条是<strong>按申报地区拆分后的子项记录</strong>。
              同一个项目若由多个地区共同申报，会拆成多行记录。
              例如「剪纸」是一个项目，但蔚县剪纸、扬州剪纸、傣族剪纸等各地子项会分别列出。
            </p>
            <p>
              两者是不同层级的统计口径，因此本站<strong>检索使用子项数据，展示项目总数时使用官方口径</strong>，
              并在页脚同时标注。官方子项数 3610 与本站 3614 的差异，来自数据快照时间不同。
            </p>
          </div>

          <p class="about-note">
            抓取过程中剔除了接口中混入的其他目录数据（如「第一批国家传统工艺振兴目录」等
            共 383 条），其详情页标题不属于国家级非遗名录体系，已通过项目编号格式与详情页标题双重校验。
          </p>

          <div class="about-callout">
            <h3>关于传承人档案中的空缺</h3>
            <p>
              本站为 <strong>${num(inhStats.total)} 位</strong>国家级代表性传承人建立了档案页，
              其中 ${num(inhStats.withCode)} 位有官方编号、${num(inhStats.withBirth)} 位有明确出生日期。
            </p>
            <p>
              其余的空缺<strong>不是抓取遗漏</strong>：中国非物质文化遗产网在第五批（2021 年公布）
              传承人的公开表格中，本身就没有标注编号与出生日期。本站照实留空并显示为「—」，
              不作任何推测性填补——档案的价值在于可信，而不在于看起来完整。
            </p>
          </div>
        </article>

        <article class="about-block" id="about-tech">
          <h2>技术实现</h2>
          <p>
            本站为<strong>纯静态前端</strong>作品，不含任何服务端逻辑。
            全部代码由团队手写，未使用任何 UI 框架与预设样式库。
          </p>

          <div class="about-table-wrap">
            <table class="about-table">
              <caption>第三方资源使用声明（比赛要求逐项注明）</caption>
              <thead>
                <tr>
                  <th scope="col">名称</th><th scope="col">性质</th>
                  <th scope="col">用途</th><th scope="col">是否影响评分的制作难度</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Vite</th>
                  <td>构建工具（开发期）</td>
                  <td>模块打包与开发服务器。构建产物为原生 HTML / CSS / JavaScript，运行时不加载任何框架。</td>
                  <td>否。仅用于打包，不参与页面呈现。</td>
                </tr>
                <tr>
                  <th scope="row">—</th>
                  <td>无其他第三方依赖</td>
                  <td>无 UI 组件库、无 CSS 框架、无图标库、无动画库、无外部字体文件。所有图形（纹样、徽记、模拟器画面）均为程序化绘制或内联 SVG。</td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </div>

          <ul class="about-specs">
            <li><span>界面规格</span><strong>1440 × 900</strong>（比赛要求三选一并标注，已在页面与页脚注明）</li>
            <li><span>路由方案</span><strong>Hash 路由</strong>（保证在 file:// 与任意静态托管下均可直接打开，无需服务器）</li>
            <li><span>图形实现</span><strong>内联 SVG + Canvas</strong>（纹样、印玺、技艺模拟器）</li>
            <li><span>字体</span><strong>系统字体栈</strong>（宋体 / 楷体优先，不下载外部字体，离线可用）</li>
            <li><span>适配</span><strong>响应式</strong>（1440 / 1920 桌面，以及 720 与移动端布局）</li>
            <li><span>无障碍</span><strong>键盘可操作</strong>（跳转链接、焦点可见、语义化标签、ARIA 标注）</li>
            <li><span>动效</span>遵循 <strong>prefers-reduced-motion</strong>（系统开启「减弱动效」时自动关闭动画）</li>
          </ul>
        </article>

        <article class="about-block" id="about-media">
          <h2>关于素材</h2>
          <p>
            本站<strong>未使用任何来源不明的网络图片</strong>。打开名录你会发现，
            每个项目卡片上没有照片，而是一枚门类徽记与一套几何纹样。
          </p>
          <p>
            这是一个刻意的选择。官方公开数据并不附带可自由使用的项目配图，
            而随手拿来的低分辨率网图，既不尊重这些手艺，也对不起观众的信任。
            与其如此，不如把「没有照片」做成一套自洽的视觉语言：
            <strong>十大门类各有专属纹样</strong>，由 SVG 绘制，可无损缩放、零加载开销，
            也不存在版权问题。
          </p>
          <p>
            技艺体验部分的画面（绣布、纸浆、木料）同样是程序化绘制的，
            颜色取自真实材料的取样，而非贴图。
          </p>
        </article>

        <article class="about-block" id="about-thanks">
          <h2>致谢</h2>
          <p>
            感谢中国非物质文化遗产网（文化和旅游部主管）提供公开数据；
            感谢所有被记录在这里的传承人——本作品所能做的，
            不过是为他们毕生所做的事，多留一处被人看见的地方。
          </p>
          <p class="about-disclaimer">
            本站为学习与展示用途的非商业作品，所有数据版权归原权利人所有。
            如内容有误，以中国非物质文化遗产网公布信息为准。
          </p>
        </article>

      </div>

      <!-- 侧栏：目录 -->
      <aside class="about-aside">
        <nav class="toc" aria-label="本页目录">
          <h2 class="toc-title">本页目录</h2>
          <ul>
            <li><button type="button" class="toc-link" data-toc="about-what">这座展馆是什么</button></li>
            <li><button type="button" class="toc-link" data-toc="about-data">数据来源与统计口径</button></li>
            <li><button type="button" class="toc-link" data-toc="about-tech">技术实现</button></li>
            <li><button type="button" class="toc-link" data-toc="about-media">关于素材</button></li>
            <li><button type="button" class="toc-link" data-toc="about-thanks">致谢</button></li>
          </ul>
        </nav>

        <div class="about-facts">
          <h2 class="toc-title">作品信息</h2>
          <dl>
            <div><dt>作品名</dt><dd>匠作</dd></div>
            <div><dt>主题</dt><dd>匠心传承，非遗焕新</dd></div>
            <div><dt>形态</dt><dd>数字展馆 + 技艺互动体验</dd></div>
            <div><dt>界面规格</dt><dd>1440 × 900</dd></div>
            <div><dt>技术栈</dt><dd>原生 HTML / CSS / JS</dd></div>
            <div><dt>赛事</dt><dd>2026 武汉大学「零杯」网页设计大赛</dd></div>
          </dl>
        </div>
      </aside>

    </div>
  </section>`;
}

/**
 * 目录滚动。
 *
 * 不能用 <a href="#about-data">：本站是 hash 路由，
 * 这样的锚点会被路由器当成路由地址，跳到 404 页。
 * 因此改成按钮 + scrollIntoView。
 */
export function initAbout() {
  const links = [...document.querySelectorAll('.toc-link')];
  if (!links.length) return;

  links.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.toc);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // 焦点交给目标区块，方便键盘用户继续
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  // 滚动时高亮当前所在的目录项
  const blocks = links.map(b => document.getElementById(b.dataset.toc)).filter(Boolean);
  if (!blocks.length || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(b => b.classList.toggle('is-active', b.dataset.toc === en.target.id));
    });
  }, { rootMargin: '-96px 0px -70% 0px', threshold: 0 });

  blocks.forEach(b => io.observe(b));
}
