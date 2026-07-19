/** UI-preview data only — no file storage/upload is wired up yet. */
export type FileEntry = {
  name: string
  sizeKb: number
  uploadedAt: string // "YYYY-MM-DD"
  uploadedBy: string
}

export const MOCK_FILES: Record<string, FileEntry[]> = {
  // Khanh Le
  "6bb5e7b2-0014-41e2-a54d-96bf1e048a97": [
    { name: "Khanh_Le_Resume.pdf", sizeKb: 184, uploadedAt: "2026-06-02", uploadedBy: "Anna John" },
  ],
  // Maria Rodriguez
  "ce0f7133-fdf4-48e9-aaaf-021efc72e0f4": [
    { name: "Maria_Rodriguez_Resume.pdf", sizeKb: 201, uploadedAt: "2026-05-20", uploadedBy: "Anna John" },
  ],
  // James Park
  "a9ce90fa-ed48-4d93-86d4-b00faa6b8ec8": [
    { name: "James_Park_Resume.pdf", sizeKb: 176, uploadedAt: "2026-06-10", uploadedBy: "Anna John" },
  ],
  // Sarah Chen
  "ad3d983a-236d-4d96-8b9a-48912f9b3ec6": [
    { name: "Sarah_Chen_Resume.pdf", sizeKb: 165, uploadedAt: "2026-04-15", uploadedBy: "Anna John" },
  ],
  // Marcus Johnson
  "b9cf4fcf-7908-43fa-8c4a-098d2ca52e5b": [
    { name: "Marcus_Johnson_Portfolio.pdf", sizeKb: 512, uploadedAt: "2026-03-30", uploadedBy: "Anna John" },
  ],
}
