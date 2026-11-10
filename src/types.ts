export type Verification = 'verified' | 'partial' | 'computed';

interface Base {
  id: string;
  category: string;
  title: string;
  question: string;
  hint?: string | null;
  myth: string;
  explanation: string;
  caveat: string;
  source: { name: string; url: string };
  dataYear: number;
  verification: Verification;
  note?: string | null;
  unit?: string;
}

export interface Labeled {
  label: string;
  value: number;
}
export interface Maskable extends Labeled {
  hidden: boolean;
}

export interface NumberQ extends Base {
  type: 'number';
  answer: number;
  unit: string;
  slider: { min: number; max: number; step: number };
  tolerance: number | null;
}
export interface LineQ extends Base {
  type: 'line';
  series: { x: number; y: number }[];
  cutoffX: number;
  unit: string;
  yRange: [number, number];
}
export interface BarQ extends Base {
  type: 'bar';
  bars: Maskable[];
  unit: string;
  yRange: [number, number];
}
export interface BubbleQ extends Base {
  type: 'bubble';
  items: Maskable[];
  unit: string;
}
export interface DonutQ extends Base {
  type: 'donut';
  slices: Labeled[];
}
export interface PieQ extends Base {
  type: 'pie';
  slices: Labeled[];
}
export interface DistributionQ extends Base {
  type: 'distribution';
  bins: Labeled[];
}

export type Question = NumberQ | LineQ | BarQ | BubbleQ | DonutQ | PieQ | DistributionQ;
export type QType = Question['type'];

export interface QuestionBank {
  meta: { version: string; built: string; questionsPerGame: number; count: number };
  questions: Question[];
}

/** 사용자의 답. 형식마다 모양이 다르다. */
export type Answer =
  | { type: 'number'; value: number }
  | { type: 'line'; ys: number[] } // cutoff 이후 실제 점 x마다 사용자 y
  | { type: 'bar'; values: number[] } // hidden 막대 순서대로
  | { type: 'bubble'; values: number[] } // hidden 원 순서대로
  | { type: 'donut' | 'pie' | 'distribution'; shares: number[] }; // 합계 100

export interface Played {
  question: Question;
  answer: Answer;
  score: number;
}
