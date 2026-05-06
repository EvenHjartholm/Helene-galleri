
export type TextSize = 'sm' | 'md' | 'lg';

export interface BaseItem {
  id: string;
  type: 'image' | 'text';

  // Free-form canvas positioning
  x?: number; // % from left (0-100)
  y?: number; // px from top of canvas
  w?: number; // % width of canvas (5-100)
}

export interface ImageItem extends BaseItem {
  type: 'image';
  thumbnailUrl: string;
  largeUrl: string;
  originalUrl: string;
  
  // permanent reference to the exact file in Supabase
  storageName?: string;
  
  // Local file reference for upload
  file?: File;
  
  // Content
  title?: string;
  caption?: string;
  altText?: string;
  
  // Styling
  titleSize?: TextSize;
  captionSize?: TextSize;
  
  // Aspect Ratio
  width: number;
  height: number;
}

export interface TextItem extends BaseItem {
  type: 'text';
  content: string;
  align?: 'left' | 'center' | 'right';
  size?: TextSize;
}

export type GalleryItem = ImageItem | TextItem;

export interface Page {
  id: string;
  items: GalleryItem[];
}

export interface Album {
  id: string;
  title: string;
  emoji?: string;
  description?: string;
  coverImageId?: string;
  date?: string;        // "2024-06" or "2024-06-15"
  location?: string;    // "Italia", "Hvaler", "Oslo"
  hidden?: boolean;     // hidden from guest view
  sortOrder?: number;
  albumType?: 'album' | 'memory'; // 'memory' = iPhone-style minner
  items: GalleryItem[];
}
