export const EXHIBIT_PHOTOS = {
  home: { id: 227351, title: '花鸟瑞兽纹刺绣', era: '十七世纪', alt: '深色织物上的花卉、飞鸟与瑞兽纹样', position: 'center 47%' },
  gallery: { id: 39681, title: '龙纹雕漆圆盒', era: '明代', alt: '盒盖与盒身饰有龙纹的朱漆圆盒', position: 'center 46%' },
  inheritors: { id: 51416, title: '庭园仕女与孩童', era: '清代', alt: '设色手卷中聚在水边亭廊的仕女与孩童', position: 'center 31%' },
  simulator: { id: 68450, title: '花鸟刺绣挂屏', era: '十八世纪', alt: '丝织底面上以彩线绣成的花枝和鸟', position: 'center 58%' },
  works: { id: 46342, title: '莲瓣形瓷盘', era: '清代', alt: '绘有彩色花卉的莲瓣形瓷盘', position: 'center 51%' },
  about: { id: 51575, title: '园居图', era: '十七世纪', alt: '青绿色山峦之间的水岸与楼阁', position: 'center 55%' },
};

export const exhibitPhotoPath = key => `media/exhibit-${key}.webp`;
const sourceURL = id => `https://www.metmuseum.org/art/collection/search/${id}`;

export function exhibitPhoto(key) {
  const photo = EXHIBIT_PHOTOS[key];
  return `<figure class="exhibit-photo exhibit-photo--${key}" style="--photo-position:${photo.position}">
    <img src="./${exhibitPhotoPath(key)}" alt="${photo.alt}" decoding="async"${key === 'home' ? ' fetchpriority="high"' : ''}>
    <figcaption><a href="${sourceURL(photo.id)}" target="_blank" rel="noopener noreferrer">
      ${photo.era} · ${photo.title} <span aria-hidden="true">↗</span>
    </a></figcaption>
  </figure>`;
}

export function exhibitCredits() {
  return `<ul class="exhibit-credits">${Object.values(EXHIBIT_PHOTOS).map(photo =>
    `<li><a href="${sourceURL(photo.id)}" target="_blank" rel="noopener noreferrer">${photo.era} · ${photo.title} ↗</a></li>`
  ).join('')}</ul>`;
}
