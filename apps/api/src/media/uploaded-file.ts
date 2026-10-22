/** شکل فایلی که multer (حافظه) تحویل می‌دهد */
export interface UploadedImageFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}