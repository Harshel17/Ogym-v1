import { useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDika } from '@/hooks/use-dika';
import { DikaButton } from './dika-button';
import { DikaDrawer } from './dika-drawer';
import { useAiConsent, AiDataConsentDialog } from '@/components/ai-data-consent';

export function Dika() {
  const { user } = useAuth();
  
  if (!user || user.hideDika) {
    return null;
  }

  return <DikaInner userId={user.id} hideDika={user.hideDika || false} />;
}

function DikaInner({ userId, hideDika }: { userId: number; hideDika: boolean }) {
  const aiConsent = useAiConsent();
  const {
    isOpen,
    messages,
    suggestions,
    position,
    icon,
    isLoading,
    sendMessage,
    updatePosition,
    updateIcon,
    openDrawer,
    closeDrawer,
    clearHistory,
    hideDikaButton,
  } = useDika(userId, hideDika);

  const consentWrappedSend = useCallback((message: string, imageBase64?: string) => {
    aiConsent.requireConsent(() => sendMessage(message, imageBase64));
  }, [aiConsent, sendMessage]);

  return (
    <>
      <DikaButton
        icon={icon}
        position={position}
        onPositionChange={updatePosition}
        onClick={openDrawer}
      />
      <DikaDrawer
        isOpen={isOpen}
        onClose={closeDrawer}
        messages={messages}
        suggestions={suggestions}
        isLoading={isLoading}
        currentIcon={icon}
        onSend={consentWrappedSend}
        onIconChange={updateIcon}
        onHide={hideDikaButton}
        onClearHistory={clearHistory}
      />
      <AiDataConsentDialog
        open={aiConsent.showDialog}
        onConsentGranted={aiConsent.onConsentGranted}
        onConsentDenied={aiConsent.onConsentDenied}
      />
    </>
  );
}

export { DikaButton } from './dika-button';
export { DikaDrawer } from './dika-drawer';
