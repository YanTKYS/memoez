import { useLocalSearchParams, useRouter } from 'expo-router';
import { EditNoteScreen } from '@/ui/screens/EditNoteScreen';

export default function EditNotePage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <EditNoteScreen
      noteId={Number(id)}
      onExit={() => router.back()}
      onOpenLabelManager={() => router.push('/labels')}
    />
  );
}
