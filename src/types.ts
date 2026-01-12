
export type TextSize = 'sm' | 'md' | 'lg';

export interface BaseItem {
  id: string;
  type: 'image' | 'text';
}

export interface ImageItem extends BaseItem {
  type: 'image';
  thumbnailUrl: string;
  largeUrl: string;
  originalUrl: string;
  
  // ✅ NEW: permanent reference to the exact file in Supabase
  storageName?: string;
  
  // ✅ NEW: Local file reference for upload
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
