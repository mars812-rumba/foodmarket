
// Типы маркеров для ручного управления менеджером
export type MarkerType =
  | 'offer_sent'    // 📨 Оффер отправлен (ждём ответ)
  | 'waiting'       // ⏳ Клиент думает / ждём от него
  | 'need_info'     // 📎 Нужна доп. информация от нас
  | 'follow_up';    // 🔄 Follow-up (нужно написать)

export interface MarkerConfig {
  label: string;
  icon: string;  // Lucide icon name
  color: string;
  bgColor: string;
}

export const MARKER_CONFIGS: Record<MarkerType, MarkerConfig> = {
  offer_sent: {
    label: 'Оффер отправлен',
    icon: 'Send',
    color: '#f59e0b',
    bgColor: '#fef3c7'
  },
  waiting: {
    label: 'Клиент думает',
    icon: 'Clock',
    color: '#8b5cf6',
    bgColor: '#ede9fe'
  },
  need_info: {
    label: 'Нужна инфо',
    icon: 'FileQuestion',
    color: '#06b6d4',
    bgColor: '#cffafe'
  },
  follow_up: {
    label: 'Follow-up',
    icon: 'RefreshCw',
    color: '#ef4444',
    bgColor: '#fee2e2'
  }
};
