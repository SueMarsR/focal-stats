import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_CONFIG } from '@focal-stats/core';
import type { PhotoExif } from '@focal-stats/core';
import { renderText } from './render';
import { toCsv, toJson, toHtml } from './export';

const p = (f: number): PhotoExif => ({
  name: 'x', focalLength: f, focalLength35mm: f,
  lensModel: null, cameraMake: null, cameraModel: null, fNumber: null,
});
const stats = analyze([p(35), p(35), p(50)], DEFAULT_CONFIG);

describe('output', () => {
  it('renderText 含分布与洞察标题', () => {
    const out = renderText(stats);
    expect(out).toMatch(/焦段分布/);
    expect(out).toMatch(/洞察/);
    expect(out).toMatch(/35/);
  });
  it('toJson 可被解析回结构', () => {
    expect(JSON.parse(toJson(stats)).total).toBe(3);
  });
  it('toCsv 首行为表头', () => {
    expect(toCsv(stats).split('\n')[0]).toBe('focal,count,percentage');
  });
  it('toHtml 是完整 HTML 文档', () => {
    expect(toHtml(stats)).toMatch(/^<!doctype html>/);
  });
});
