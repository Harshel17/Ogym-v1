import { useAuth } from '@/hooks/use-auth';
import { useDika } from '@/hooks/use-dika';
import { DikaButton } from './dika-button';
import { DikaDrawer } from './dika-drawer';

export function Dika() {
  const { user } = useAuth();
  
  if (!user || user.hideDika) {
    return null;
  }

  return <DikaInner userId={user.id} hideDika={user.hideDika || false} />;
}

function DikaInner({ userId, hideDika }: { userId: number; hideDika: boolean }) {
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

  return (
    <>
      <DikaButton
        icon={icon}
        position={position}
        onPositionChange={updatePosition}
        onClick={openDrawer}
        isDrawerOpen={isOpen}
      />
      <DikaDrawer
        isOpen={isOpen}
        onClose={closeDrawer}
        messages={messages}
        suggestions={suggestions}
        isLoading={isLoading}
        currentIcon={icon}
        onSend={sendMessage}
        onIconChange={updateIcon}
        onHide={hideDikaButton}
        onClearHistory={clearHistory}
      />
    </>
  );
}

export { DikaButton } from './dika-button';
export { DikaDrawer } from './dika-drawer';
