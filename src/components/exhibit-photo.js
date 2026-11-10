export const EXHIBIT_PHOTOS = {
  home: { id: 41493, title: '《乾隆南巡图》第六卷（水岸局部）', era: '清代', alt: '江南水岸的桥梁、船只和沿河市街', position: 'center 55%' },
  gallery: { id: 41493, title: '《乾隆南巡图》第六卷（山水局部）', era: '清代', alt: '设色长卷中的江南山峦、河道和塔楼', position: 'center 54%', mobilePosition: '34% center' },
  inheritors: { id: 51903, title: '《制丝图》册（局部）', era: '清代', alt: '几位女子在木架前协作整理一幅红色丝织物', mobilePosition: '50% center' },
  simulator: { id: 70776, title: '刺绣山水帐檐（局部）', era: '清代', alt: '丝缎上以彩色丝线和金属线绣出的层叠山峰、云纹和楼阁', mobilePosition: '51% center' },
  works: { id: 65059, title: '缂丝秋园图桌围（局部）', era: '清代', alt: '深蓝底上的金色花木、岩石和飞鸟织纹', mobilePosition: '68% center' },
  about: { id: 41478, title: '《杏园雅集图》（局部）', era: '明代', alt: '庭园里围坐的宾客与桌上的书卷、古器', mobilePosition: '66% center' },
};

export const exhibitPhotoPath = key => `media/exhibit-${key}.webp`;
const sourceURL = id => `https://www.metmuseum.org/art/collection/search/${id}`;

export function exhibitPhoto(key) {
  const photo = EXHIBIT_PHOTOS[key];
  const src = `./${exhibitPhotoPath(key)}`;
  return `<figure class="exhibit-photo exhibit-photo--${key}" style="--photo-position:${photo.position || 'center'};--photo-mobile-position:${photo.mobilePosition || 'center'}">
    <img src="${src}" alt="${photo.alt}" decoding="async" fetchpriority="high">
    <figcaption>${key === 'home' ? '' : '<span class="exhibit-caption-label">馆藏图</span>'}<a href="${sourceURL(photo.id)}" target="_blank" rel="noopener noreferrer">
      ${photo.era} · ${photo.title} <span aria-hidden="true">↗</span>
    </a></figcaption>
  </figure>`;
}

export function exhibitHeading(key, page, copy = '') {
  return `<div class="exhibit-masthead${copy ? ' page-head' : ''}">
    ${exhibitPhoto(key)}
    <div class="container">
      <nav class="breadcrumb" aria-label="面包屑导航">
        <a href="#/">首页</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">${page}</span>
      </nav>
      ${copy ? `<div class="exhibit-copy">${copy}</div>` : ''}
    </div>
  </div>`;
}

export function exhibitCredits() {
  return `<ul class="exhibit-credits">${Object.values(EXHIBIT_PHOTOS).map(photo =>
    `<li><a href="${sourceURL(photo.id)}" target="_blank" rel="noopener noreferrer">${photo.era} · ${photo.title} ↗</a></li>`
  ).join('')}</ul>`;
}
