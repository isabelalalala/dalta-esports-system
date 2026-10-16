import { describe, expect, it } from 'vitest';
import { csvCell, csvFile, csvLine } from '@/utils/csv';

describe('csvCell', () => {
  it('passes plain values through and blanks nulls', () => {
    expect(csvCell('Team Alpha')).toBe('Team Alpha');
    expect(csvCell(5)).toBe('5');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
  it('quotes values with commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });
  it('neutralizes spreadsheet formulas typed by users', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+cmd')).toBe("'+cmd");
    expect(csvCell('-SUM(A1)')).toBe("'-SUM(A1)");
    expect(csvCell('@import')).toBe("'@import");
  });
  it('does not touch numbers or mid-string operators', () => {
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell('a=b')).toBe('a=b');
  });
});

describe('csvLine / csvFile', () => {
  it('joins cells with commas', () => {
    expect(csvLine(['a', 'b,c', 3])).toBe('a,"b,c",3');
  });
  it('emits a BOM and CRLF rows so Excel reads UTF-8', () => {
    const file = csvFile(['h1', 'h2'], [['v1', 'v2'], ['v3', 'v4']]);
    expect(file.startsWith('﻿')).toBe(true);
    expect(file).toBe('﻿h1,h2\r\nv1,v2\r\nv3,v4');
  });
});
