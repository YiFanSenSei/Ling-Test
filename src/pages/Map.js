import boundaries from '../../public/data/heritage-boundaries.json';
import counties from '../../public/data/heritage-counties.json';
import { getProjects, getProjectDetail } from '../data.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const shapes = boundaries.china.features;
const provinces = new Map(shapes.filter(f => f.properties.level === 'province').map(f => [f.properties.name, f]));
const shortName = name => name.replace(/维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区|省|市/g, '');
const boundsOf = features => {
  let minX=180, maxX=0, minY=90, maxY=-90;
  const visit = value => {
    if (typeof value?.[0] === 'number') { minX=Math.min(minX,value[0]); maxX=Math.max(maxX,value[0]); minY=Math.min(minY,value[1]); maxY=Math.max(maxY,value[1]); }
    else if (Array.isArray(value)) value.forEach(visit);
  };
  features.forEach(f => visit(f.geometry.coordinates));
  return [minX,maxX,minY,maxY];
};
const projector = (box, width=900, height=600) => {
  const [x1,x2,y1,y2] = box, pad=28;
  const scale=Math.min((width-pad*2)/(x2-x1),(height-pad*2)/(y2-y1));
  const dx=(width-(x2-x1)*scale)/2, dy=(height-(y2-y1)*scale)/2;
  return ([x,y]) => [dx+(x-x1)*scale, height-dy-(y-y1)*scale];
};
const pathOf = (geometry, project) => {
  const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
  return rings.map(ring => ring.map((point,i) => `${i?'L':'M'}${project(point).map(n=>n.toFixed(1)).join(' ')}`).join('')+'Z').join('');
};
const mainland = shapes.filter(f => f.properties.adcode !== '100000_JD');
const nationProject = projector(boundsOf(mainland));
const sea = shapes.find(f => f.properties.adcode === '100000_JD');
const seaProject = projector(boundsOf([sea]), 145, 138);
const provinceFor = name => provinces.get(name) || provinces.get(name.replace(/省|市$/, '')+'省');

export async function MapPanel(regionName = '') {
  const projects = await getProjects();
  const selected = provinceFor(regionName);
  const provinceData = selected && boundaries.provinces[String(selected.properties.adcode)];
  const local = selected ? projects.filter(p => p.region === regionName) : [];
  const features = provinceData?.features?.length ? provinceData.features : selected ? [selected] : mainland;
  const project = selected ? projector(boundsOf(features)) : nationProject;
  const counts = new Map();
  for (const p of projects) counts.set(p.region, (counts.get(p.region)||0)+1);
  const mapShapes = features.map(f => {
    const name=f.properties.name, isProvince=!selected;
    const href=isProvince ? `#/gallery?mapRegion=${encodeURIComponent(name)}` : null;
    const label=isProvince ? `${name}，${counts.get(name)||0} 项` : name;
    const path=`<path d="${pathOf(f.geometry,project)}" class="heritage-geo-shape ${isProvince?'is-clickable':''}" ${isProvince?`data-map-region="${esc(name)}" tabindex="0" role="link" aria-label="${esc(label)}"`:''}><title>${esc(label)}</title></path>`;
    const center=f.properties.centroid || f.properties.center;
    const [x,y]=center?project(center):[0,0];
    return `${path}${center?`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="heritage-geo-label">${esc(shortName(name))}</text>`:''}`;
  }).join('');
  const cities=features.map(f=>({name:f.properties.name, center:f.properties.centroid||f.properties.center})).filter(c=>c.center);
  const fallback=selected?.properties.centroid||selected?.properties.center;
  const dots=local.map((item,i)=>{
    const place=item.unit||item.province||'';
    const city=cities.find(c=>place.includes(c.name)) || cities.find(c=>place.includes(shortName(c.name))) || {center:fallback};
    const code=item.projectNo?.match(/_(\d{6})$/)?.[1];
    const county=counties[code];
    const [cx,cy]=project(county?.center||city.center);
    const angle=i*2.39996, radius=3.8*Math.sqrt(i%17);
    const x=Math.max(8,Math.min(892,cx+Math.cos(angle)*radius));
    const y=Math.max(8,Math.min(592,cy+Math.sin(angle)*radius));
    return `<a class="heritage-project-dot" href="#/project/${encodeURIComponent(item.id)}" data-project-id="${esc(item.id)}"
      style="left:${(x/9).toFixed(2)}%;top:${(y/6).toFixed(2)}%" aria-label="${esc(item.name)}，${esc(place)}" title="${esc(item.name)}"></a>`;
  }).join('');
  const first=local[0];
  return `<section class="heritage-map" aria-label="非遗分布地图">
    <div class="heritage-map-heading"><div><span class="heritage-map-kicker">地理寻遗</span><h2>${selected?`${esc(regionName)}非遗地图`:'中国非遗分布地图'}</h2>
      <p>${selected?'将鼠标移到项目点查看简介，点击点位或右侧卡片进入详情。':'点击省级区域，查看当地非遗分布。'}</p></div>
      ${selected?'<a href="#/gallery" class="btn btn-ghost">返回全国地图</a>':''}</div>
    <div class="heritage-map-layout">
      <div class="heritage-map-canvas ${selected?'is-province':'is-national'}">
        <svg viewBox="0 0 900 600" role="img" aria-label="${selected?esc(regionName):'中国含南海诸岛'}行政区划地图">${mapShapes}</svg>
        ${selected?`<div class="heritage-dot-layer">${dots}</div>`:`<div class="heritage-sea-inset" aria-label="南海诸岛"><svg viewBox="0 0 145 138"><path d="${pathOf(sea.geometry,seaProject)}" /></svg><span>南海诸岛</span></div>`}
      </div>
      <aside class="heritage-map-side ${first?'is-clickable':''}" id="heritage-map-preview" aria-live="polite" ${first?`data-preview-id="${esc(first.id)}" tabindex="0" role="link"`:''}>
        <h3>${first?esc(first.name):selected?esc(regionName):'全国分布'}</h3>
        <p>${first?esc(first.unit||first.province||first.region):selected?`${local.length} 条申报记录`:'点击左侧省份进入省级地图'}</p>
        ${first?`<p>${esc(first.category)} · 第${first.batch}批。将鼠标移到点位，查看该项目的梗概。</p><a class="heritage-map-all" href="#/project/${encodeURIComponent(first.id)}">查看项目详情 →</a>`
          :selected?'<p>该地区暂无可标注的项目。</p>':'<p>各省项目数量依据现有国家级非遗子项数据统计。</p>'}
      </aside>
    </div><p class="heritage-map-note">边界数据：阿里云 DataV 行政区划数据；项目位置按可识别的申报地市归类，点位排布用于避免重叠，不代表精确地址。</p>
  </section>`;
}

export function initMapPanel() {
  const map=document.querySelector('.heritage-map');
  if (!map) return () => {};
  const onClick=e=>{
    const shape=e.target.closest('[data-map-region]');
    if (shape) location.hash=`#/gallery?mapRegion=${encodeURIComponent(shape.dataset.mapRegion)}`;
    const preview=e.target.closest('[data-preview-id]');
    if (preview && !e.target.closest('a')) location.hash=`#/project/${encodeURIComponent(preview.dataset.previewId)}`;
  };
  const onKey=e=>{ if ((e.key==='Enter'||e.key===' ')&&(e.target.matches('[data-map-region]')||e.target.matches('[data-preview-id]'))) { e.preventDefault(); onClick(e); } };
  let serial=0;
  const onHover=async e=>{
    const dot=e.target.closest('[data-project-id]');
    if (!dot) return;
    const id=dot.dataset.projectId, ticket=++serial;
    const preview=map.querySelector('#heritage-map-preview');
    const project=(await getProjects()).find(p=>String(p.id)===id);
    if (!project||ticket!==serial) return;
    preview.dataset.previewId=id;
    preview.classList.add('is-clickable');
    preview.tabIndex=0;
    preview.setAttribute('role','link');
    preview.innerHTML=`<h3>${esc(project.name)}</h3><p>${esc(project.unit||project.province||project.region)}</p><p>${esc(project.category)} · 第${project.batch}批</p><a class="heritage-map-all" href="#/project/${encodeURIComponent(id)}">查看项目详情 →</a>`;
    try {
      const detail=await getProjectDetail(id);
      if (ticket!==serial||!detail?.intro) return;
      preview.querySelector('a').insertAdjacentHTML('beforebegin',`<p>${esc(detail.intro.slice(0,160))}${detail.intro.length>160?'…':''}</p>`);
    } catch { /* 概要元数据仍可使用 */ }
  };
  map.addEventListener('click',onClick);
  map.addEventListener('keydown',onKey);
  map.addEventListener('pointerover',onHover);
  map.addEventListener('focusin',onHover);
  return ()=>{map.removeEventListener('click',onClick);map.removeEventListener('keydown',onKey);map.removeEventListener('pointerover',onHover);map.removeEventListener('focusin',onHover);};
}
