import { useRouter } from 'expo-router';
import { LabelManagerScreen } from '@/ui/screens/LabelManagerScreen';

export default function LabelsPage() {
  const router = useRouter();
  return <LabelManagerScreen onBack={() => router.back()} />;
}
