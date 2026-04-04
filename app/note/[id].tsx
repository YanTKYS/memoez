import { useLocalSearchParams } from 'expo-router';
import { EditNoteScreen } from '@/ui/screens/EditNoteScreen';

export default function EditNotePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditNoteScreen noteId={Number(id)} />;
}
