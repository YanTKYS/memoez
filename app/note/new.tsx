import { useRouter } from 'expo-router';
import { EditNoteScreen } from '@/ui/screens/EditNoteScreen';

export default function NewNotePage() {
  const router = useRouter();
  return (
    <EditNoteScreen
      onExit={() => router.back()}
      onOpenLabelManager={() => router.push('/labels')}
    />
  );
}
