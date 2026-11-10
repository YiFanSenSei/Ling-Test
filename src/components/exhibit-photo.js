export const EXHIBIT_PHOTOS = {
  home: { id: 41493, title: '《乾隆南巡图》第六卷（水岸局部）', era: '清代', alt: '江南水岸的桥梁、船只和沿河市街', position: 'center 55%' },
  gallery: { id: 41493, title: '《乾隆南巡图》第六卷（山水局部）', era: '清代', alt: '设色长卷中的江南山峦、河道和塔楼', position: 'center 54%' },
  inheritors: { id: 51416, title: '庭园仕女与孩童', era: '清代', alt: '设色手卷中聚在水边亭廊的仕女与孩童' },
  simulator: { id: 68450, title: '花鸟刺绣挂屏', era: '十八世纪', alt: '丝织底面上以彩线绣成的花枝和鸟' },
  works: { id: 46342, title: '莲瓣形瓷盘', era: '清代', alt: '绘有彩色花卉的莲瓣形瓷盘' },
  about: { id: 51575, title: '园居图', era: '十七世纪', alt: '青绿色山峦之间的水岸与楼阁' },
};

export const exhibitPhotoPath = key => `media/exhibit-${key}.webp`;
const sourceURL = id => `https://www.metmuseum.org/art/collection/search/${id}`;

export function exhibitPhoto(key) {
  const photo = EXHIBIT_PHOTOS[key];
  const src = `./${exhibitPhotoPath(key)}`;
  const image = `<img src="${src}" alt="${photo.alt}" decoding="async"${key === 'home' ? ' fetchpriority="high"' : ''}>`;
  const detail = key === 'simulator' ? `<span class="exhibit-photo-detail" aria-hidden="true">
    <img src="${src}" alt="" decoding="async"><span>局部</span>
  </span>` : '';
  return `<figure class="exhibit-photo exhibit-photo--${key}"${photo.position ? ` style="--photo-position:${photo.position}"` : ''}>
    ${key === 'home' ? image : `<div class="exhibit-photo-stage">${image}${detail}</div>`}
    <figcaption>${key === 'home' ? '' : '<span class="exhibit-caption-label">馆藏图</span>'}<a href="${sourceURL(photo.id)}" target="_blank" rel="noopener noreferrer">
      ${photo.era} · ${photo.title} <span aria-hidden="true">↗</span>
    </a></figcaption>
  </figure>`;
}

export function exhibitHeading(key, copy) {
  return `<section class="page-head page-head--exhibit">
    <div class="container exhibit-spread">
      <div class="exhibit-copy">${copy}</div>
      ${exhibitPhoto(key)}
    </div>
  </section>`;
}

export function exhibitCredits() {
  return `<ul class="exhibit-credits">${Object.values(EXHIBIT_PHOTOS).map(photo =>
    `<li><a href="${sourceURL(photo.id)}" target="_blank" rel="noopener noreferrer">${photo.era} · ${photo.title} ↗</a></li>`
  ).join('')}</ul>`;
}
