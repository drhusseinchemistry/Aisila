
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
  // New properties for positioning
  pageIndex?: number; // If set, it stays on this page and ignores flow
  x?: number;         // Horizontal position
  y?: number;         // Vertical position
  width?: number;     // Width of the text box
  isFloating?: boolean; // Determines if it's a draggable box or flow list
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
