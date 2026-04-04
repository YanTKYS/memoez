export interface ChecklistItem {
  id:        number;
  noteId:    number;
  text:      string;
  isChecked: boolean;
  position:  number;
  createdAt: Date;
  deletedAt: Date | null;
}
