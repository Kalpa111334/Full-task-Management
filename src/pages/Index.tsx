import { NotificationDebugPanel } from "@/components/NotificationDebugPanel";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center">
          <h1 className="mb-4 text-3xl sm:text-4xl font-bold">Task Vision - Notification Testing</h1>
          <p className="text-base sm:text-xl text-muted-foreground">
            Test and troubleshoot push notifications
          </p>
        </div>
        
        <NotificationDebugPanel />
      </div>
    </div>
  );
};

export default Index;
