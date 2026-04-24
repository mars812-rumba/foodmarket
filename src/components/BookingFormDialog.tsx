import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface BookingFormDialogProps {
  open: boolean;
  onClose: () => void;
  userId?: number | string;
  onSuccess?: () => void;
  carId?: string;
  prefillData?: any;
}

/**
 * Stub BookingFormDialog — rental booking form placeholder.
 * For food orders, this dialog is not shown (the CRM page hides the "Create offer" button).
 * Full implementation lives in refs/BookingFormDialog.tsx for when rental flow is needed.
 */
export const BookingFormDialog: React.FC<BookingFormDialogProps> = ({
  open,
  onClose,
  userId,
  onSuccess,
  carId,
  prefillData,
}) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Создать бронирование</DialogTitle>
        </DialogHeader>
        <div className="p-4 text-center text-slate-500">
          Функция создания бронирования доступна для аренды
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingFormDialog;
