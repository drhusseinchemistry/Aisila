
export enum PaperSize {
  A4 = 'A4',
  A5 = 'A5',
  Letter = 'Letter'
}

export interface FloatingImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

export interface MalzamaSection {
  id: string;
  title: string;
  content: string;
}

export interface EditorSettings {
  paperSize: PaperSize;
  fontSize: number;
  fontColor: string;
  primaryColor: string;
  lineHeight: number;
  teacherName: string;
  customFontUrl?: string;
  choiceSpacing: number; // New: spacing between options
  questionGap: number;   // New: spacing between questions
}
