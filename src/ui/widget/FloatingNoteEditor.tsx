import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { EditNoteScreen } from '@/ui/screens/EditNoteScreen';
import { LabelManagerScreen } from '@/ui/screens/LabelManagerScreen';
import { FloatingWindow } from './FloatingWindow';
import { closeWidgetWindow, exitWidgetWindow } from './closeWidgetWindow';
import { useHostCloseRequest } from './useHostCloseRequest';

interface Props {
  noteId: number;
}

/**
 * ウィジェットから開くメモ編集ウィンドウ。
 * 編集 UI・保存処理は通常画面と同じ EditNoteScreen / useEditNote をそのまま使い、
 * 画面遷移（閉じる・ラベル管理）だけをウィンドウ用に差し替える。
 */
export function FloatingNoteEditor({ noteId }: Props) {
  // EditNoteScreen の「保存して閉じる」（戻るボタンと同じ処理）
  const closeRequestRef = useRef<(() => Promise<boolean>) | null>(null);
  const [showLabelManager, setShowLabelManager] = useState(false);

  const openLabelManager  = useCallback(() => setShowLabelManager(true),  []);
  const closeLabelManager = useCallback(() => setShowLabelManager(false), []);

  /**
   * EditNoteScreen の「保存して閉じる」（戻るボタン・× と同じ。保存の完了を待つ）。
   * 閉じたら true、保存に失敗して入力を残したら false。
   */
  const saveAndClose = useCallback(async (): Promise<boolean> => {
    if (closeRequestRef.current) return closeRequestRef.current();
    closeWidgetWindow();
    return true;
  }, []);

  // ホームボタン・履歴ボタンで離れたときも、保存してから閉じる
  useHostCloseRequest(saveAndClose);

  const requestClose = useCallback(() => {
    if (showLabelManager) {
      setShowLabelManager(false);
    } else {
      void saveAndClose();
    }
  }, [showLabelManager, saveAndClose]);

  return (
    <FloatingWindow onRequestClose={requestClose}>
      <EditNoteScreen
        noteId={noteId}
        presentation="floating"
        onExit={exitWidgetWindow}
        onOpenLabelManager={openLabelManager}
        closeRequestRef={closeRequestRef}
      />
      {showLabelManager && (
        <View style={StyleSheet.absoluteFill}>
          <FloatingLabelManager onBack={closeLabelManager} />
        </View>
      )}
    </FloatingWindow>
  );
}

/** 編集画面の上に重ねるラベル管理（通常画面では /labels へ遷移する部分） */
function FloatingLabelManager({ onBack }: { onBack: () => void }) {
  // 編集画面より後に登録されるため、戻る操作はこちらが先に受け取る
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  return <LabelManagerScreen presentation="floating" onBack={onBack} />;
}
