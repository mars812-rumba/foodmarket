import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, MapPin, User, Car } from "lucide-react";
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export function DayDetailsModal({ isOpen, onClose, date, events, onBookingClick }) {
  if (!date) return null;

  const pickups = events.filter(e => e.type === 'pickup');
  const returns = events.filter(e => e.type === 'return');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-3xl">
        <DialogHeader className="p-6 bg-slate-50 border-b">
          <DialogTitle className="text-center font-bold text-slate-700">
            {format(date, 'd MMMM yyyy', { locale: ru })}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Доставки */}
          <div>
            <h3 className="text-[10px] font-black text-green-600 uppercase tracking-wider mb-3 px-2">🚚 Доставки ({pickups.length})</h3>
            <div className="space-y-2">
              {pickups.map((ev, i) => (
                <div key={i} onClick={() => onBookingClick(ev.booking)} className="p-3 bg-green-50 rounded-2xl border border-green-100 cursor-pointer hover:shadow-md transition-all">
                  <div className="flex justify-between font-bold text-xs text-slate-800 mb-2">
                    <span className="flex items-center gap-1"><Car size={14}/> {ev.carName}</span>
                    <span className="flex items-center gap-1 text-green-700"><Clock size={12}/> {ev.time}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 space-y-1">
                    <p className="flex items-center gap-1"><User size={12}/> {ev.booking.form_data.client_name || 'Клиент'}</p>
                    <p className="flex items-center gap-1"><MapPin size={12}/> {ev.booking.form_data.location || 'Уточнить место'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Возвраты */}
          <div>
            <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-wider mb-3 px-2">🏁 Возвраты ({returns.length})</h3>
            <div className="space-y-2">
              {returns.map((ev, i) => (
                <div key={i} onClick={() => onBookingClick(ev.booking)} className="p-3 bg-orange-50 rounded-2xl border border-orange-100 cursor-pointer hover:shadow-md transition-all">
                  <div className="flex justify-between font-bold text-xs text-slate-800 mb-2">
                    <span className="flex items-center gap-1"><Car size={14}/> {ev.carName}</span>
                    <span className="flex items-center gap-1 text-orange-700"><Clock size={12}/> {ev.time}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 space-y-1">
                    <p className="flex items-center gap-1"><User size={12}/> {ev.booking.form_data.client_name || 'Клиент'}</p>
                    <p className="flex items-center gap-1"><MapPin size={12}/> {ev.booking.form_data.location || 'Уточнить место'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}