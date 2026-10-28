import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Phone (< md): full-bleed bottom sheet. The role=dialog node is inset-0 with no
 * translate. iOS Safari forces transform: translateZ(0) on [role=dialog] (index.css),
 * which replaces translateX(-50%) and clips a centered dialog off the right edge.
 * Desktop (md+): the inner panel is centered. That translate is not on role=dialog.
 * Same shell as ActivityDetailsModal (#62).
 */
const SHEET_PANEL_CLASS =
  'absolute inset-x-0 bottom-0 max-h-[92dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-[22px] bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[90vh] md:w-[min(28rem,calc(100%-2rem))] md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[22px] md:pb-6';

export function DiscoverSheet({
  open,
  onClose,
  title,
  description,
  testId,
  leading,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description: string;
  testId: string;
  leading?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay style={{ backgroundColor: 'rgba(20, 14, 16, 0.42)' }} />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 outline-none"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <div data-testid={testId} className={SHEET_PANEL_CLASS}>
            {leading ? <div className="mb-3">{leading}</div> : null}
            <DialogHeader className="pr-12 text-left">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <DialogClose className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full text-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <div className="mt-4">{children}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
