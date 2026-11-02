/** 只统计原始出生年份，不由年份推断年龄、在世状态或总体人口结构。 */
export function summarizeBirths(records) {
  const yearOf = record => {
    const match = String(record.birth || '').match(/(\d{4})/);
    const year = match ? Number(match[1]) : NaN;
    return year >= 1800 && year <= 2026 ? year : null;
  };
  const years = records.map(yearOf).filter(y => y !== null).sort((a, b) => a - b);
  const median = list => list.length ? (list[Math.floor((list.length - 1) / 2)] + list[Math.floor(list.length / 2)]) / 2 : null;
  const histogram = [];
  if (years.length) {
    for (let start = Math.floor(years[0] / 10) * 10; start <= years.at(-1); start += 10) {
      histogram.push({ start, end: start + 9, count: years.filter(y => y >= start && y < start + 10).length });
    }
  }
  return {
    counted: years.length, missing: records.length - years.length,
    earliest: years[0] ?? null, latest: years.at(-1) ?? null, median: median(years), histogram,
    byBatch: [...new Set(records.map(r => String(r.batch)))].sort().map(batch => {
      const group = records.filter(r => String(r.batch) === batch);
      const born = group.map(yearOf).filter(y => y !== null).sort((a, b) => a - b);
      return { batch, total: group.length, born: born.length,
        coverage: group.length ? Math.round(born.length / group.length * 1000) / 10 : 0,
        median: median(born) };
    }),
  };
}
