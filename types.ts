
export enum PaperSize {
  A4 = 'A4',
  A5 = 'A5',
  Letter = 'Letter'
}

export type ElementType = 'image' | 'text' | 'rect' | 'circle' | 'line' | 'icon' | 'path';

export interface FloatingElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string; // For text html or icon name
  src?: string; // For images
  pageIndex: number;
  pathData?: string; // For freehand drawing paths
  style?: {
    borderColor?: string;
    backgroundColor?: string;
    borderWidth?: number;
    color?: string; // For text/icon
    fontSize?: number;
    opacity?: number;
  };
}

export interface MalzamaSection {
  id: string;
  title: string;
  content: string; // Now stores HTML for rich text
  isFloating?: boolean;
  pageIndex?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number; // Added height
}

export interface EditorSettings {
  paperSize: PaperSize;
  fontSize: number;
  fontColor: string;
  primaryColor: string;
  lineHeight: number;
  teacherName: string;
  customFontUrl?: string;
  choiceSpacing: number;
  questionGap: number;
}
