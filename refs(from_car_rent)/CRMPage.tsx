import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import dayjs from 'dayjs';
import {
  Calendar, Car, StickyNote , MessageSquare, Plus, Pencil, Trash2, Phone,
  SquareUser, RefreshCcw, RefreshCw, Users,UserRoundPlus, MessageCircleReply,UserRoundCheck,
  Play, Square, Send, MapPin, X, User, Pause, ToggleLeft, ToggleRight,MessageCircle,Filter,
  CirclePlus, CircleDollarSign, CircleMinus, CircleCheckBig, Paperclip, Image, FileText, Download,
  Clock, FileQuestion, Info, Check, AlertCircle
} from 'lucide-react';
import { MarkerType } from '@/types/crm';
import { BookingFormDialog } from '@/components/admin/BookingFormDialog';
import { CRMTutorialSheet } from '@/components/admin/CRMTutorialSheet';
import logo from '@/assets/logo.png';

// TypeScript интерфейсы для работы с диалогами
interface DialogEvent {
  user_id: number;
  action: string;
  timestamp: string;

}

interface DialogStatus {
  active: boolean;
  has_new_messages: boolean;
  has_media_messages?: boolean;
  last_message_at: string | null;
  last_message_from: 'user' | 'manager' | 'claude' | null;
  message_count: number;
  claude_status: 'active' | 'paused' | 'stopped';
}


interface User {
  user_id: number;
  username: string;
  dialog_status?: DialogStatus; // Получаем из API
  // ... остальные поля из существующего интерфейса
  status?: string;
  
  car_interested?: string;
  category_interested?: string;
  dates_selected?: {
    start: string;
    end: string;
  };
  created_at: string;
  assistant_mode?: boolean;
  claude_status?: string;
  assistant_enabled?: boolean;
  notes?: string[];
  last_note?: string;
  history_notes?: Array<{
    note_id: string;
    text: string;
    timestamp: string;
    action?: string;
  }>;
  pickup_location?: string;

  // Маркеры для ручного управления менеджером
  marker?: string | null;

  // Наличие active брони (pre_booking или confirmed)
  has_active_booking?: boolean;
}

const MAIN_STATUSES = ['new', 'in_work', 'pre_booking', 'confirmed', 'archive'];
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'new': { label: 'NEW', color: '#64748b', bg: 'bg-slate-100' },
  'in_work': { label: 'WORK', color: '#7c3aed', bg: 'bg-green-50' },
  'pre_booking': { label: 'PBOOK', color: '#ea580c', bg: 'bg-orange-50' },
  'confirmed': { label: 'BOOK', color: '#16a34a', bg: 'bg-green-100' },
  'archive': { label: 'ARCHIVE', color: '#94a3b8', bg: 'bg-slate-200' }
};

const CRMPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); // Все пользователи для индикаторов
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('new');
  const [period, setPeriod] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [note, setNote] = useState('');
  const [managerMessage, setManagerMessage] = useState('');
  const [loadingAction, setLoadingAction] = useState<Record<string, boolean>>({});
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [dialogFilter, setDialogFilter] = useState<'all' | 'new' | 'ai-on' | 'ai-off'>('all');
  const [activeTab, setActiveTab] = useState('info'); // По умолчанию 'info'
  const [editingNote, setEditingNote] = useState<{id: string, text: string} | null>(null);
  const [editingNoteId, setEditingNoteId] = useState(null); // ID юзера, чью заметку правим
  const [tempNote, setTempNote] = useState(''); // Временный текст для ввода
  const [markerFilter, setMarkerFilter] = useState<string>('all');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  // Состояние для диалога создания/редактирования заявки
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" });

  // User Documents from Media Files
  const userDocuments = React.useMemo(() => {
    if (!chats || chats.length === 0) return [];
    
    // Дедупликация по filename
    const seenFilenames = new Set<string>();
    const documents = [];
    
    for (const msg of chats) {
      if (!msg || msg.role !== 'user') continue;
      
      // Check both possible media locations: msg.content.media and msg.media
      const media = msg?.content?.media || msg?.media;
      
      if (media && typeof media === 'object') {
        // Build correct download URL - photos are stored directly in user directory
        const filename = media.filename || media.file_name || media.original_filename || 'unknown';
        
        // Пропускаем дубликаты по filename
        if (seenFilenames.has(filename)) {
          console.log(`📁 [DEBUG] Skipping duplicate: ${filename}`);
          continue;
        }
        seenFilenames.add(filename);
        
        const downloadUrl = `/api/crm/media/${selectedUser?.user_id}/${encodeURIComponent(filename)}`;
        
        documents.push({
          ...media,
          download_url: downloadUrl,
          filename: filename, // Ensure filename is preserved
          message_timestamp: msg.timestamp
        });
        
        // Debug logging for first few documents
        if (documents.length <= 3) {
          console.log(`📁 [DEBUG] Document ${documents.length}:`, {
            originalFilename: filename,
            encodedFilename: encodeURIComponent(filename),
            downloadUrl: downloadUrl,
            contentType: media.content_type,
            mediaKeys: Object.keys(media)
          });
        }
      }
    }
    
    console.log("📁 [DEBUG] Extracted user documents:", {
      totalChats: chats.length,
      userMessages: chats.filter(m => m.role === 'user').length,
      documentsFound: documents.length,
      sampleDoc: documents[0] ? {
        filename: documents[0].filename,
        contentType: documents[0].content_type,
        hasDownloadUrl: !!documents[0].download_url,
        downloadUrl: documents[0].download_url
      } : null
    });
    
    return documents;
  }, [chats, selectedUser?.user_id]);

  const formatDateSimple = (dateStr: string) => {
    if (!dateStr) return '—';
    return dayjs(dateStr).format('DD.MM.YYYY');
  };

  const getDaysCount = (start: any, end: any) => {
    if (!start || !end) return 0;
    const s = dayjs(start);
    const e = dayjs(end);
    const d = e.diff(s, 'day');
    return d <= 0 ? 1 : d;
  };

  const getFilteredUsers = (users: User[]): User[] => {
    return users.filter(user => {
      const dialog = user.dialog_status || user.dialog;

      // Фильтр по диалогам
      if (dialogFilter === 'new') {
        return dialog?.has_new_messages;
      }
      if (dialogFilter === 'ai-on') {
        return dialog?.claude_status === 'active';
      }
      if (dialogFilter === 'ai-off') {
        return dialog?.active && dialog?.claude_status !== 'active';
      }

      // Фильтр по маркерам
      if (markerFilter !== 'all') {
        return user.marker === markerFilter;
      }

      return true;
    });
  };

  const formatRelativeTime = (dateStr: string): string => {
    if (!dateStr) return '—';
    
    const now = dayjs();
    const date = dayjs(dateStr);
    const diffInMinutes = now.diff(date, 'minute');
    
    if (diffInMinutes < 1) return 'только что';
    if (diffInMinutes < 60) return `${diffInMinutes} мин назад`;
    
    const diffInHours = now.diff(date, 'hour');
    if (diffInHours < 24) return `${diffInHours} ч назад`;
    
    const diffInDays = now.diff(date, 'day');
    if (diffInDays < 7) return `${diffInDays} дн назад`;
    
    return date.format('DD.MM.YY');
  };

  // Вспомогательная функция для сравнения user_id (приводит к строке для избежания проблем с типами)
  const compareUserIds = (id1: number | string, id2: number | string): boolean => {
    return String(id1) === String(id2);
  };

  const loadMainData = useCallback(async () => {
    setLoading(true);
    try {
      // Загружаем всех пользователей для подсчёта непрочитанных во вкладках
      const allUsersRes = await fetch(`/api/crm/users?period=${period}`);
      const allUsersData = await allUsersRes.json();
      if (allUsersData.status === 'ok') {
        // Преобразуем dialog в dialog_status для совместимости
        const processedAllUsers = allUsersData.users.map((user: any) => ({
          ...user,
          dialog_status: user.dialog_status || user.dialog || null,
          dialog: user.dialog || user.dialog_status || null
        }));
        setAllUsers(processedAllUsers); // Все пользователи для индикаторов
      }
      
      // Загружаем только текущую вкладку для отображения
      // Для confirmed используем status=confirmed (не has_confirmed_booking)
      const statusParam = activeStatus === 'confirmed' ? 'status=confirmed' : `status=${activeStatus}`;
      const queryParams = [statusParam, `period=${period}`].filter(Boolean).join('&');

      const [uRes, sRes] = await Promise.all([
        fetch(`/api/crm/users?${queryParams}`),
        fetch(`/api/crm/stats?period=${period}`)
      ]);
      const uData = await uRes.json();
      const sData = await sRes.json();
      if (uData.status === 'ok') {
        // Преобразуем dialog в dialog_status для совместимости
        const processedUsers = uData.users.map((user: any) => ({
          ...user,
          dialog_status: user.dialog_status || user.dialog || null,
          dialog: user.dialog || user.dialog_status || null
        }));
        setUsers(processedUsers);
        setTimeout(() => refreshAllDialogStatuses(), 1000);
      }
      if (sData.status === 'ok') setStats(sData.stats);
    } catch (e) { console.error("Ошибка загрузки:", e); }
    finally { setLoading(false); }
  }, [activeStatus, period]);

const fetchChatHistory = async (userId: number | string, silent: boolean = false) => {
  try {
    const response = await fetch(`/api/crm/chats/${userId}`);
    const data = await response.json();
    if (data.status === 'ok' && data.chats) {
      // Добавляем проверку m !== null
      const uniqueChats = data.chats.filter((msg, index, self) =>
        msg && index === self.findIndex((m) => m && (
          (m.id && m.id === msg.id) ||
          (m.timestamp === msg.timestamp && (m.content === msg.content || m.text === msg?.text))
        ))
      );
      setChats(uniqueChats);
    }
  } catch (e) {
    console.error("Ошибка:", e);
  }
};
const loadUserDetails = async (user: any) => {
  setSelectedUser(user);
  setIsDetailsOpen(true);
  setChats([]); // Сбрасываем старый чат
  setBookings([]);
    
  try {
    // Сбрасываем флаг непрочитанных сообщений при открытии чата
    markDialogAsRead(user.user_id);
    
    // Load critical data first (bookings), then chat data
    const bRes = await fetch(`/api/crm/bookings/${user.user_id}`);
    const bData = await bRes.json();
    
    if (bData.status === 'ok') setBookings(bData.bookings);
    
    // Load chat data with performance optimization
    const cRes = await fetch(`/api/crm/chats/${user.user_id}`);
    const cData = await cRes.json();

    if (cData.status === 'ok' && cData.chats) {
      // Enhanced filtering for better performance
      const validChats = cData.chats
        .filter(msg => msg !== null && (msg.content || msg.text || msg.media))
        .slice(-100); // Limit to last 100 messages for performance
      setChats(validChats);
    }
    
    await fetchClaudeStatus(user.user_id);
    setTimeout(scrollToBottom, 100);
  } catch (e) {
    console.error("❌ [ERROR] Ошибка деталей:", e);
  }
};

  const fetchDialogStatus = async (userId: number | string): Promise<DialogStatus> => {
    const response = await fetch(`/api/crm/dialog/${String(userId)}/status`);
    const data = await response.json();
    // Бэкенд возвращает dialog.claude_status напрямую
    const dialog = data.dialog || data;
    return {
      active: dialog.active || false,
      has_new_messages: dialog.has_new_messages || false,
      has_media_messages: dialog.has_media_messages,
      last_message_at: dialog.last_message_at || null,
      last_message_from: dialog.last_message_from || null,
      message_count: dialog.message_count || 0,
      claude_status: dialog.claude_status || 'stopped'
    };
  };

  const fetchDialogEvents = async (userId: number | string, limit: number = 50): Promise<DialogEvent[]> => {
    const response = await fetch(`/api/crm/dialog/${String(userId)}/events?limit=${limit}`);
    const data = await response.json();
    return data.events;
  };

  const markDialogAsRead = async (userId: number | string) => {
    try {
      const response = await fetch(`/api/crm/dialog/${String(userId)}/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        // Обновляем локальное состояние
        setUsers(prev => prev.map(user =>
          compareUserIds(user.user_id, userId) && user.dialog_status
            ? { ...user, dialog_status: { ...user.dialog_status, has_new_messages: false } }
            : user
        ));
      }
    } catch (e) {
      console.error('Ошибка сброса флага новых сообщений:', e);
    }
  };

  const refreshSingleDialogStatus = async (userId: number) => {
    try {
      const dialogStatus = await fetchDialogStatus(userId);
      // Обновляем users
      setUsers(prev => prev.map(user => {
        if (compareUserIds(user.user_id, userId)) {
          return { ...user, dialog_status: dialogStatus };
        }
        return user;
      }));
      // Обновляем selectedUser если это текущий пользователь
      if (compareUserIds(selectedUser?.user_id, userId)) {
        setSelectedUser(prev => prev ? { ...prev, dialog_status: dialogStatus } : null);
      }
    } catch (e) {
      console.error(`Ошибка обновления статуса диалога для пользователя ${userId}:`, e);
    }
  };

  const refreshAllDialogStatuses = async () => {
    try {
      const promises = users.map(async (user) => {
        try {
          const dialogStatus = await fetchDialogStatus(user.user_id);
          return { userId: user.user_id, dialogStatus };
        } catch (error) {
          console.error(`Failed to load dialog status for user ${user.user_id}:`, error);
          return { userId: user.user_id, dialogStatus: null };
        }
      });
      const results = await Promise.allSettled(promises);
      setUsers(prev => prev.map(user => {
        const result = results.find(r => r.status === 'fulfilled' && String(r.value.userId) === String(user.user_id));
        if (result && result.status === 'fulfilled' && result.value.dialogStatus) {
          return { ...user, dialog_status: result.value.dialogStatus };
        }
        return user;
      }));
    } catch (e) {
      console.error('Ошибка обновления статусов диалогов:', e);
    }
  };


  const handleSendMessage = async () => {
    if (!managerMessage.trim() || !selectedUser) return;

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      user_id: selectedUser.user_id,
      role: 'manager',
      content: { text: managerMessage },
      timestamp: new Date().toISOString(),
      send_status: 'pending' // pending | sent | failed
    };
    
    const messageText = managerMessage;
    setManagerMessage('');

    // Optimistic: add message immediately
    setChats(prev => [...prev, optimisticMessage]);

    try {
      const response = await fetch('/api/crm/send_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.user_id,
          text: messageText,
          role: 'manager',
          timestamp: optimisticMessage.timestamp
        })
      });

      if (response.ok) {
        // Update message status to sent
        setChats(prev => prev.map(m => 
          m.id === tempId ? { ...m, send_status: 'sent' } : m
        ));

        // Refresh dialog statuses
        await refreshAllDialogStatuses();

        // Update message count locally
        const targetUserId = String(selectedUser.user_id);
        setUsers(prev => prev.map(user =>
          String(user.user_id) === targetUserId && (user.dialog_status || user.dialog)
            ? { 
                ...user, 
                dialog_status: { 
                  ...(user.dialog_status || user.dialog || {}), 
                  message_count: ((user.dialog_status?.message_count) || (user.dialog?.message_count) || 0) + 1 
                },
                dialog: {
                  ...(user.dialog || user.dialog_status || {}),
                  message_count: ((user.dialog?.message_count) || (user.dialog_status?.message_count) || 0) + 1
                }
              }
            : user
        ));

        // Принудительно обновляем данные всех пользователей с сервера
        try {
          const uRes = await fetch(`/api/crm/users?status=${activeStatus}&period=${period}`);
          const uData = await uRes.json();
          if (uData.status === 'ok') {
            const processedUsers = uData.users.map((user: any) => ({
              ...user,
              dialog_status: user.dialog_status || user.dialog || null,
              dialog: user.dialog || user.dialog_status || null
            }));
            setUsers(processedUsers);
          }
        } catch (refreshError) {
          console.error("Не удалось обновить данные:", refreshError);
        }
      }
    } catch (e) {
      console.error("Ошибка отправки:", e);
      // Mark message as failed
      setChats(prev => prev.map(m =>
        m.id === tempId ? { ...m, send_status: 'failed' } : m
      ));
      alert('Не удалось отправить сообщение');
    }
  };

  const handleManualRefresh = async () => {
    if (!selectedUser) return;
    setIsRefreshing(true);
    await fetchChatHistory(selectedUser.user_id, false);
    setIsRefreshing(false);
    };

  // File handling functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        alert('Поддерживаются только изображения (JPG, PNG) и PDF документы');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Размер файла не должен превышать 10MB');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !selectedUser) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('user_id', selectedUser.user_id.toString());
      formData.append('message', managerMessage || '');

      const response = await fetch('/api/crm/send_media', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        // Clear form
        setSelectedFile(null);
        setManagerMessage('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Refresh chat history
        await fetchChatHistory(selectedUser.user_id, false);
        await refreshAllDialogStatuses();
      } else {
        const error = await response.json();
        alert(`Ошибка загрузки: ${error.message || 'Неизвестная ошибка'}`);
      }
    } catch (e) {
      console.error('Ошибка загрузки файла:', e);
      alert('Ошибка сети при загрузке файла');
    } finally {
      setIsUploading(false);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  // Функция для открытия деталей (на инфо)
  const openUserDetails = (user: any) => {
    setActiveTab('info');
    loadUserDetails(user);
  };

  // Navigate to offer flow - switch to Cars tab with user_id
  const navigateToOffer = (userId: number | string) => {
    // Dispatch custom event with tab index AND user_id
    window.dispatchEvent(new CustomEvent('switchTab', { detail: { tab: 0, userId: String(userId) } }));
  };

// Функция для перехода сразу в чат
const openUserChat = (user: any) => {
  setActiveTab('chat');
  loadUserDetails(user);
};

// Открыть диалог создания/редактирования заявки
const openBookingDialog = (booking?: any) => {
  setEditingBooking(booking || null);
  setIsBookingDialogOpen(true);
};

// При успешном сохранении заявки - обновить список
const handleBookingSuccess = async () => {
  setIsBookingDialogOpen(false);
  setEditingBooking(null);
  
  // Перезагрузить заявки для выбранного пользователя (userId сохраняем из closure)
  const currentUserId = selectedUser?.user_id;
  if (currentUserId) {
    // Принудительно загружаем bookings заново
    const bRes = await fetch(`/api/crm/bookings/${currentUserId}`);
    const bData = await bRes.json();
    if (bData.status === 'ok') {
      setBookings(bData.bookings);
    }
  }
};

  const handleClaudeAction = async (userId: number, action: 'start' | 'pause' | 'resume' | 'stop') => {
    setLoadingAction(prev => ({ ...prev, [`claude_${userId}_${action}`]: true }));
    try {
      // Используем новые API endpoints
      let endpoint = '';
      if (action === 'start' || action === 'resume') {
        endpoint = `/api/claude/start/${userId}`;
      } else if (action === 'pause') {
        endpoint = `/api/claude/pause/${userId}`;
      } else if (action === 'stop') {
        endpoint = `/api/claude/stop/${userId}`;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      
      if (result.status === 'success') {
        console.log(`✅ Claude ${action} для пользователя ${userId}:`, result.message);
        
        // Получаем актуальный статус и обновляем ОБА списка: users И selectedUser
        const newStatus = await fetchDialogStatus(userId);
        
        // Обновляем users
        setUsers(prev => prev.map(user => {
          if (compareUserIds(user.user_id, userId)) {
            return { ...user, dialog_status: newStatus };
          }
          return user;
        }));
        
        // Обновляем selectedUser если это текущий пользователь
        if (compareUserIds(selectedUser?.user_id, userId)) {
          setSelectedUser(prev => prev ? { ...prev, dialog_status: newStatus } : null);
        }
        
        // Показываем alert об успехе
        const actionLabels: Record<string, string> = {
          start: 'Claude запущен',
          pause: 'Claude приостановлен',
          resume: 'Claude возобновлён',
          stop: 'Claude остановлен'
        };
        alert(actionLabels[action] || `Действие "${action}" выполнено`);
        
      } else {
        console.error(`❌ Ошибка ${action} Claude:`, result.message || result);
        alert(`❌ Ошибка выполнения действия "${action}": ${result.message || 'Неизвестная ошибка'}`);
      }
    } catch (e) {
      console.error(`❌ Ошибка ${action} Claude:`, e);
      alert(`❌ Ошибка сети при выполнении действия "${action}"`);
    }
    finally {
      setLoadingAction(prev => ({ ...prev, [`claude_${userId}_${action}`]: false }));
    }
  };

  const handleClaudeSendMessage = async (userId: number, message: string) => {
    setLoadingAction(prev => ({ ...prev, [`claude_send_${userId}`]: true }));
    try {
      const response = await fetch('/api/claude/send_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          message: message
        })
      });
      const result = await response.json();
      
      if (result.status === 'success') {
        console.log('Claude message sent:', result.message);
        // Обновляем чат с ответом Claude
        if (result.response_text) {
          setChats(prev => [...prev, {
            role: 'assistant',
            content: result.response_text,
            timestamp: new Date().toISOString()
          }]);
        }
        // Локально обновляем message_count для индикации
        const targetUserIdStr = String(userId);
        setUsers(prev => prev.map(user =>
          String(user.user_id) === targetUserIdStr && (user.dialog_status || user.dialog)
            ? { 
                ...user, 
                dialog_status: { 
                  ...(user.dialog_status || user.dialog || {}), 
                  message_count: ((user.dialog_status?.message_count) || (user.dialog?.message_count) || 0) + 1 
                },
                dialog: {
                  ...(user.dialog || user.dialog_status || {}),
                  message_count: ((user.dialog?.message_count) || (user.dialog_status?.message_count) || 0) + 1
                }
              }
            : user
        ));

        // Принудительно обновляем данные с сервера
        try {
          const uRes = await fetch(`/api/crm/users?status=${activeStatus}&period=${period}`);
          const uData = await uRes.json();
          if (uData.status === 'ok') {
            const processedUsers = uData.users.map((user: any) => ({
              ...user,
              dialog_status: user.dialog_status || user.dialog || null,
              dialog: user.dialog || user.dialog_status || null
            }));
            setUsers(processedUsers);
          }
        } catch (refreshError) {
          console.error("Не удалось обновить данные:", refreshError);
        }
      } else {
        console.error('Ошибка отправки сообщения Claude:', result.message || result);
      }
    } catch (e) {
      console.error('Ошибка отправки сообщения Claude:', e);
    }
    finally {
      setLoadingAction(prev => ({ ...prev, [`claude_send_${userId}`]: false }));
    }
  };

  const fetchClaudeStatus = async (userId: number) => {
    try {
      const response = await fetch(`/api/claude/status/${userId}`);
      const result = await response.json();
      
      if (result.status === 'success') {
        // Обновляем статус в основном списке пользователей
        setUsers(prev => prev.map(user => {
          if (compareUserIds(user.user_id, userId) && user.dialog_status) {
            return {
              ...user,
              dialog_status: {
                ...user.dialog_status,
                claude_status: result.data.claude_status
              }
            };
          }
          return user;
        }));
      }
    } catch (e) {
      console.error('Ошибка получения статуса Claude:', e);
    }
  };

  // Архивировать: меняет статус на 'archive' (для вкладок NEW, WORK, PBOOK, BOOK)
  const handleArchiveAction = async (userId: number) => {
    const isInArchiveTab = activeStatus === 'archive';
    const confirmMsg = isInArchiveTab
      ? "Удалить лида навсегда? Он будет полностью удалён из системы."
      : "Архивировать этого лида? Он переместится во вкладку Архив.";

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setLoadingAction(prev => ({ ...prev, [`archive_${userId}`]: true }));
    try {
      if (isInArchiveTab) {
        // Полное удаление: archived = true, перенос в archive.json
        const response = await fetch(`/api/crm/permanent_delete/${userId}`, {
          method: 'DELETE'
        });
        const result = await response.json();

        if (result.status === 'ok') {
          setUsers(prev => prev.filter(u => u.user_id !== userId));
          console.log(`Пользователь ${userId} удалён навсегда`);
        } else {
          console.error('Ошибка удаления:', result);
          alert('Ошибка при удалении лида');
        }
      } else {
        // Архивирование: меняем статус на 'archive', archived = false
        const response = await fetch('/api/crm/update_status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            status: 'archive',
            archived: false
          })
        });

        if (response.ok) {
          // Обновляем пользователя в списке
          setUsers(prev => prev.map(u =>
            u.user_id === userId ? { ...u, status: 'archive', archived: false } : u
          ));
          console.log(`Пользователь ${userId} архивирован`);
        } else {
          console.error('Ошибка архивирования:', await response.json());
          alert('Ошибка при архивировании лида');
        }
      }
    } catch (e) {
      console.error('Ошибка архивирования:', e);
      alert('Ошибка сети при архивировании');
    }
    finally {
      setLoadingAction(prev => ({ ...prev, [`archive_${userId}`]: false }));
    }
  };

  const handleStatusChange = async (userId: number, newStatus: string, stayOnTab = false) => {
    // Optimistic update — сначала UI, потом API
    const previousUsers = users;
    const previousTab = activeStatus;
    
    // Если уходим из текущей вкладки — убираем карточку
    if (!stayOnTab && activeStatus !== newStatus) {
      setUsers(prev => prev.filter(u => !compareUserIds(u.user_id, userId)));
    } else {
      setUsers(prev => prev.map(u =>
        compareUserIds(u.user_id, userId) ? { ...u, status: newStatus } : u
      ));
    }
    
    try {
      const response = await fetch('/api/crm/update_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          status: newStatus
        })
      });

      if (response.ok) {
        console.log(`Статус ${userId} → ${newStatus}`);
        // Если нужно — переключить вкладку (для workflow кнопок)
        if (!stayOnTab) {
          setActiveStatus(newStatus);
        }
      } else {
        // Error — откат
        setUsers(previousUsers);
        if (!stayOnTab) setActiveStatus(previousTab);
        alert('Ошибка сохранения статуса');
      }
    } catch (e) {
      console.error('Ошибка статуса:', e);
      // Откат при ошибке сети
      setUsers(previousUsers);
      if (!stayOnTab) setActiveStatus(previousTab);
      alert('Ошибка сохранения статуса');
    }
  };

  // Воронка: NEW → IN_WORK → PREBOOKING → ARCHIVE
  const STATUS_FLOW: Record<string, string> = {
    'new': 'in_work',
    'in_work': 'pre_booking',
    'pre_booking': 'archive'
  };

  const STATUS_REVERSE: Record<string, string> = {
    'in_work': 'new',
    'pre_booking': 'in_work',
    'archive': 'pre_booking'
  };

  const handleMoveForward = async (userId: number) => {
    const user = users.find(u => compareUserIds(u.user_id, userId));
    if (!user) return;
    const currentStatus = user.status;
    const nextStatus = STATUS_FLOW[currentStatus];
    if (nextStatus) {
      await handleStatusChange(userId, nextStatus, false); // stayOnTab=false — переключить вкладку
    }
  };

  const handleMoveBack = async (userId: number) => {
    const user = users.find(u => compareUserIds(u.user_id, userId));
    if (!user) return;
    const currentStatus = user.status;
    const prevStatus = STATUS_REVERSE[currentStatus];
    if (prevStatus) {
      await handleStatusChange(userId, prevStatus, false); // stayOnTab=false — переключить вкладку
    }
  };

 const handleSaveNote = async () => {
  if (!note.trim() || !selectedUser) return;
  
  try {
    const response = await fetch('/api/crm/add_note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: selectedUser.user_id,
        note: note.trim()
      })
    });
    const result = await response.json();
    
    if (result.status === 'ok') {
      const newNote = note.trim();
      
      // 1. Обновляем модалку (добавляем в массив для отображения)
      setSelectedUser(prev => ({
        ...prev,
        notes: [...(prev.notes || []), newNote],
        last_note: newNote // для синхронизации с бэкендом
      }));

      // 2. !!! ОБЯЗАТЕЛЬНО: Обновляем этот же объект в основном списке пользователей
      setUsers(prevUsers => prevUsers.map(u => 
        compareUserIds(u.user_id, selectedUser.user_id) 
          ? { ...u, last_note: newNote, notes: [...(u.notes || []), newNote] }
          : u
      ));

      setNote('');
    }
  } catch (e) {
    console.error('Ошибка добавления заметки:', e);
  }
};

const handleQuickSaveNote = async (userId) => {
  setEditingNoteId(null);
  
  // Если текст не изменился, ничего не делаем
  const currentUser = users.find(u => compareUserIds(u.user_id, userId));
  if (tempNote.trim() === (currentUser?.last_note || '')) return;

  // Оптимистичное обновление UI
  setUsers(prev => prev.map(u =>
    compareUserIds(u.user_id, userId) ? { ...u, last_note: tempNote.trim() } : u
  ));

  try {
    await fetch('/api/crm/add_note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        note: tempNote.trim()
      })
    });
  } catch (e) {
    console.error("Ошибка сохранения заметки:", e);
    loadMainData(); // Откатываемся к данным с сервера при ошибке
  }
};

// Управление маркерами
const handleMarkerChange = async (userId: number, marker: MarkerType | null) => {
  try {
    const response = await fetch('/api/crm/update_marker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        marker: marker
      })
    });

    if (response.ok) {
      // Обновляем локальное состояние
      setUsers(prev => prev.map(user =>
        compareUserIds(user.user_id, userId) ? { ...user, marker } : user
      ));
      console.log(`Маркер для пользователя ${userId}:`, marker || 'сброшен');
    } else {
      console.error('Ошибка обновления маркера');
    }
  } catch (e) {
    console.error('Ошибка обновления маркера:', e);
  }
};


// --- УДАЛЕНИЕ ---
const handleDeleteNote = async (noteId: string) => {
  if (!window.confirm("Удалить эту заметку?")) return;
  
  try {
    const response = await fetch(`/api/crm/notes/${noteId}`, { method: 'DELETE' });
    const result = await response.json();
    if (result.status === 'ok') {
      // Обновляем список локально, чтобы не делать лишний запрос к API
      setSelectedUser(prev => ({
        ...prev,
        history_notes: prev.history_notes.filter((n: any) => n.note_id !== noteId)
      }));
    }
  } catch (e) {
    console.error("Ошибка удаления:", e);
  }
};

// --- РЕДАКТИРОВАНИЕ (Начало) ---
const startEditNote = (note: any) => {
  setEditingNote({ id: note.note_id, text: note.text });
};

// --- СОХРАНЕНИЕ ИЗМЕНЕНИЙ ---
const handleUpdateNote = async () => {
  if (!editingNote) return;

  try {
    const response = await fetch(`/api/crm/notes/${editingNote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: editingNote.text })
    });
    
    if (response.ok) {
      setSelectedUser(prev => ({
        ...prev,
        history_notes: prev.history_notes.map((n: any) => 
          n.note_id === editingNote.id ? { ...n, text: editingNote.text } : n
        )
      }));
      setEditingNote(null); // Закрываем режим редактирования
    }
  } catch (e) {
    console.error("Ошибка обновления:", e);
  }
};

  const confirmBooking = async (bookingId: string) => {
    setLoadingAction(prev => ({ ...prev, [`confirm_${bookingId}`]: true }));
    
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        // Update local bookings list
        setBookings(prev => prev.map(b =>
          b.booking_id === bookingId
            ? { ...b, status: 'confirmed', confirmed_at: new Date().toISOString() }
            : b
        ));
        
        console.log('✅ Бронирование подтверждено');
      } else {
        const error = await response.json();
        console.error('❌ Ошибка подтверждения:', error.message);
      }
    } catch (e) {
      console.error('❌ Ошибка сети:', e);
    } finally {
      setLoadingAction(prev => ({ ...prev, [`confirm_${bookingId}`]: false }));
    }
  };

  // Отклонить бронь (pre_booking → archive, confirmed → in_work)
  const rejectBooking = async (bookingId: string, bookingStatus: string) => {
    const message = bookingStatus === 'confirmed'
      ? 'Отклонить подтверждённую бронь? Статус клиента изменится на IN_WORK.'
      : 'Отклонить заявку и архивировать лида?';
    if (!window.confirm(message)) return;

    setLoadingAction(prev => ({ ...prev, [`reject_${bookingId}`]: true }));

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        // Удаляем бронь из списка
        setBookings(prev => prev.filter(b => b.booking_id !== bookingId));

        // Обновляем статус пользователя
        if (selectedUser) {
          // Если была confirmed → in_work, если pre_booking → archive
          const newStatus = bookingStatus === 'confirmed' ? 'in_work' : 'archive';
          setUsers(prev => prev.map(u =>
            compareUserIds(u.user_id, selectedUser.user_id)
              ? { ...u, status: newStatus, updated_at: new Date().toISOString() }
              : u
          ));
        }

        console.log(`✅ Бронь ${bookingId} отклонена, клиент → ${bookingStatus === 'confirmed' ? 'IN_WORK' : 'ARCHIVE'}`);
      } else {
        const error = await response.json();
        console.error('❌ Ошибка отклонения:', error.message);
      }
    } catch (e) {
      console.error('❌ Ошибка сети:', e);
    } finally {
      setLoadingAction(prev => ({ ...prev, [`reject_${bookingId}`]: false }));
    }
  };

  useEffect(() => { loadMainData(); }, [loadMainData]);

  // Auto-refresh chat when user is selected
  useEffect(() => {
    if (!selectedUser?.user_id) return;

    // Initial load
    fetchChatHistory(selectedUser.user_id, false);

    // Set up auto-refresh interval (every 3 seconds) only if enabled
    let interval: NodeJS.Timeout;
    if (autoRefreshEnabled) {
      interval = setInterval(() => {
        fetchChatHistory(selectedUser.user_id, true);
      }, 3000);
    }

    // Cleanup interval on user change or component unmount
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedUser?.user_id, autoRefreshEnabled]);

  // Auto-refresh dialog statuses every 30 seconds
  useEffect(() => {
    if (users.length === 0) return;

    const interval = setInterval(() => {
      refreshAllDialogStatuses();
    }, 3000); // 5 seconds

    return () => clearInterval(interval);
  }, [users.length]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans overflow-x-hidden">
      {/* Combined Fixed Header: Nav + Stats + Filters */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
        
        {/* Nav */}
        <nav className="bg-white border-b px-4 py-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-7 w-auto" />
            <span className="text-sm font-semibold text-slate-900">CRM</span>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {['today', 'week', 'month', 'all'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all ${period === p ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>
                {p}
              </button>
            ))}
          </div>
        </nav>

        {/* Stats Row */}
        <div className="px-4 pt-3 pb-2 bg-slate-50">
          <div className="grid grid-cols-5 gap-1.5">
            {MAIN_STATUSES.map(key => {
              const count = stats?.[key] || 0;
              return (
                <Card key={key} onClick={() => setActiveStatus(key)}
                  className={`cursor-pointer border-none transition-all duration-300 ${activeStatus === key ? 'ring-2 ring-blue-500 shadow-md' : 'hover:bg-white/50 opacity-80'}`}>
                  <CardContent className="p-1.5 flex flex-col items-center justify-center gap-0.5">
                    <span className="text-[7px] font-bold uppercase tracking-tighter text-slate-400">{STATUS_CONFIG[key].label}</span>
                    <span className="text-sm font-black text-slate-800 leading-none">{count}</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Filters Row */}
        <div className="px-4 pb-3 bg-slate-50">
          <div className="flex items-center justify-between gap-1 p-1 bg-white/90 rounded-lg shadow-sm border border-slate-100">
            <div className="flex items-center gap-0.5 overflow-x-auto">
              
              {/* Dialog filters */}
              <div className="flex gap-0.5">
                {[
                  { id: 'all', icon: Users, color: 'text-slate-500', count: users.length },
                  { id: 'new', icon: UserRoundCheck, color: 'text-red-500', count: users.filter(u => u.dialog_status?.has_new_messages).length },
                  { id: 'ai-on', icon: UserRoundPlus, color: 'text-green-600', count: users.filter(u => u.dialog_status?.claude_status === 'active').length },
                ].map(f => (
                  <Button
                    key={f.id}
                    variant={dialogFilter === f.id ? 'default' : 'ghost'}
                    onClick={() => setDialogFilter(f.id as 'all' | 'new' | 'ai-on')}
                    className="h-6 px-1.5 rounded-md flex gap-1 shrink-0 transition-all"
                  >
                    <f.icon className={`w-3 h-3 ${dialogFilter === f.id ? 'text-white' : f.color}`} />
                    <span className={`text-[9px] font-bold ${dialogFilter === f.id ? 'text-white' : 'text-slate-400'}`}>
                      {f.count}
                    </span>
                  </Button>
                ))}
              </div>

              {/* Divider */}
              <div className="w-px h-4 bg-slate-300 shrink-0 mx-0.5"></div>

              {/* Marker filters */}
              <div className="flex gap-0.5">
                {[
                  { id: 'all', icon: Filter, color: 'text-slate-400' },
                  { id: 'offer_sent', icon: Send, color: 'text-amber-500' },
                  { id: 'waiting', icon: Clock, color: 'text-purple-500' },
                  { id: 'need_info', icon: FileQuestion, color: 'text-cyan-500' },
                  { id: 'follow_up', icon: MessageCircleReply, color: 'text-red-500' },
                ].map(m => (
                  <Button
                    key={m.id}
                    variant={markerFilter === m.id ? 'default' : 'ghost'}
                    onClick={() => setMarkerFilter(m.id)}
                    className="h-6 px-1 rounded-md shrink-0 transition-all"
                  >
                    <m.icon className={`w-3 h-3 ${markerFilter === m.id ? 'text-white' : m.color}`} />
                  </Button>
                ))}
              </div>
            </div>

            {/* Help button */}
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => setTutorialOpen(true)} 
              className="h-6 w-6 shrink-0 text-slate-400 hover:bg-blue-50 hover:text-blue-500"
            >
              <Info className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - with top padding to account for fixed header */}
      <main className="p-4 max-w-[1600px] mx-auto w-full pt-[160px]">
  {loading ? (
    <div className="h-96 flex flex-col items-center justify-center text-slate-300">
       <RefreshCcw className="w-10 h-10 animate-spin mb-4 text-blue-100" />
       <span className="text-xs font-black uppercase tracking-[0.2em]">Синхронизация...</span>
    </div>
  ) : (
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
  {getFilteredUsers(users).map(user => {
    // Используем last_booking если есть, иначе dates_selected
    const bookingDates = user.last_booking?.form_data?.dates || user.dates_selected;
    const days = getDaysCount(bookingDates?.start, bookingDates?.end);
    const dialog = user.dialog_status || user.dialog;
    
    const currentStatus = user.status;
    
    // ЛОГИКА ПОДСВЕТКИ: если есть непрочитанное сообщение от юзера - нужно внимание
    const needsReply = dialog?.has_new_messages && dialog?.last_message_from === 'user';
    const aiActive = dialog?.claude_status === 'active';

    // Примечание: фон карточки - всегда белый, маркер показывается только на поле заметки
    const cardBgClass = needsReply ? 'bg-amber-50/60 border-amber-200' : 'bg-white';

    return (

<Card key={user.user_id} 
        className={`group border-none shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden h-[115px] flex flex-col 
          ${cardBgClass} ${needsReply ? 'ring-1 ring-amber-300/50' : ''}`}
      >
   

        <CardContent className="p-2.5 flex flex-col justify-between h-full space-y-1">

   {/* СТРОКА 1: Авто (Слева) | Юзернейм + Инфо (Справа) */}
<div className="flex justify-between items-center">
  <div className="flex items-center gap-1.5 min-w-0 flex-1">
    <Car className="w-3.5 h-3.5 text-blue-500 shrink-0" />
    {/* Используем last_booking если есть, иначе car_interested */}
    <span className="font-black text-[11px] text-slate-800 truncate uppercase tracking-tight">
      {user.last_booking?.form_data?.car?.name || user.car_interested || "не выбрано"}
    </span>
    {user.category_interested && (
      <span className="text-[7px] font-black text-slate-400 border border-slate-200 px-1 rounded uppercase">
        {user.category_interested}
      </span>
    )}
  </div>
  
  <div className="flex items-center gap-1 shrink-0 ml-2">
    <span className={`font-black text-[11px] truncate ${needsReply ? 'text-amber-700' : 'text-blue-600'}`}>
      @{user.username || 'user'}
    </span>
    {/* Кнопка ИНФО рядом с юзернеймом - зелёная если есть active бронь */}
    <Button
      size="icon" variant="ghost"
      className={`h-5 w-5 rounded transition-all ${
        user.has_active_booking
          ? 'text-green-500 hover:text-green-600 hover:bg-green-50'
          : 'text-slate-300 hover:text-blue-500 hover:bg-blue-50'
      }`}
      onClick={(e) => { e.stopPropagation(); openUserDetails(user); }}
    >
      <SquareUser className="w-3.5 h-3.5" />
    </Button>
  </div>
</div>

    {/* СТРОКА 2: Даты (Слева) | Метаданные (Справа) */}
    <div className="flex justify-between items-center text-slate-500">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1 text-[9px] font-bold">
          <Calendar className="w-2.5 h-2.5 text-orange-400" />
          <span>{bookingDates?.start ? dayjs(bookingDates.start).format('DD.MM') : '??'}</span>
          <span>-</span>
          <span>{bookingDates?.end ? dayjs(bookingDates.end).format('DD.MM') : '??'}</span>
          <span className="text-blue-500 ml-1">{days}D</span>
        </div>
        <div className="flex items-center gap-1 text-[9px] opacity-70">
          <MapPin className="w-2.5 h-2.5 text-red-400" />
          <span className="truncate max-w-[80px]">{user.pickup_location || "Пхукет"}</span>
        </div>
      </div>
        <div className="flex flex-col items-end leading-none shrink-0 opacity-80">
<span className="text-[7px] font-mono italic">
  {/* Проверяем наличие префикса web_session вместо типа данных */}
  ID: {String(user.user_id).startsWith('web_session') ? "Web Browser" : user.user_id}
</span>
          <span className="text-[7px] font-mono tracking-tighter">
            {dayjs(user.created_at).format('DD.MM.YY')}
          </span>
        </div>
    </div>
{/* СТРОКА 3: Интерактивная заметка */}
<div
  className={`flex items-center gap-1.5 rounded px-2 py-1 border transition-colors cursor-text min-h-[24px] ${
    user.marker === 'offer_sent' ? 'bg-amber-100/50 border-amber-200/50' :
    user.marker === 'waiting' ? 'bg-purple-100/50 border-purple-200/50' :
    user.marker === 'need_info' ? 'bg-cyan-100/50 border-cyan-200/50' :
    user.marker === 'follow_up' ? 'bg-red-100/50 border-red-200/50' :
                                  'bg-slate-50 border-slate-100 hover:bg-white hover:border-blue-200'
  }`}
  onClick={(e) => {
    e.stopPropagation();
    setEditingNoteId(user.user_id);
    setTempNote(user.last_note || '');
  }}
>
  <StickyNote className={`w-2.5 h-2.5 shrink-0 ${
    user.marker === 'offer_sent' ? 'text-amber-600' :
    user.marker === 'waiting' ? 'text-purple-600' :
    user.marker === 'need_info' ? 'text-cyan-600' :
    user.marker === 'follow_up' ? 'text-red-600' :
                                   'text-slate-400'
  }`} />
  
  {compareUserIds(editingNoteId, user.user_id) ? (
    <input
      autoFocus
      className={`text-[8px] bg-transparent outline-none w-full font-bold ${
        user.marker === 'offer_sent' ? 'text-amber-800' :
        user.marker === 'waiting' ? 'text-purple-800' :
        user.marker === 'need_info' ? 'text-cyan-800' :
        user.marker === 'follow_up' ? 'text-red-800' :
                                       'text-blue-600'
      }`}
      value={tempNote}
      onChange={(e) => setTempNote(e.target.value)}
      onBlur={() => handleQuickSaveNote(user.user_id)}
      onKeyDown={(e) => e.key === 'Enter' && handleQuickSaveNote(user.user_id)}
      onClick={(e) => e.stopPropagation()}
    />
  ) : (
    <p className={`text-[8px] truncate w-full tracking-tight ${
      user.last_note ? 'font-bold' : 'italic'
    } ${
      user.marker === 'offer_sent' ? 'text-amber-700' :
      user.marker === 'waiting' ? 'text-purple-700' :
      user.marker === 'need_info' ? 'text-cyan-700' :
      user.marker === 'follow_up' ? 'text-red-700' :
                                     'text-slate-400'
    }`}>
      {user.last_note || "Добавить заметку..."}
    </p>
  )}
</div>

    {/* СТРОКА 4: Состояния (Слева) | Действия (Справа) */}
    <div className="flex items-center justify-between pt-1">
      {/* Лево: Маркеры и Индикаторы чата */}
      <div className="flex items-center gap-2">
        {/* Маркеры - 4 иконки (только в IN_WORK) */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const newMarker = user.marker === 'offer_sent' ? null : 'offer_sent';
              handleMarkerChange(user.user_id, newMarker);
            }}
            className={`p-0.5 rounded transition-colors ${
              user.marker === 'offer_sent'
                ? 'text-amber-600 bg-amber-50'
                : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
            }`}
            title="Оффер отправлен"
          >
            <Send className="w-3 h-3" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              const newMarker = user.marker === 'waiting' ? null : 'waiting';
              handleMarkerChange(user.user_id, newMarker);
            }}
            className={`p-0.5 rounded transition-colors ${
              user.marker === 'waiting'
                ? 'text-purple-600 bg-purple-50'
                : 'text-slate-400 hover:text-purple-500 hover:bg-purple-50'
            }`}
            title="Клиент думает"
          >
            <Clock className="w-3 h-3" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              const newMarker = user.marker === 'need_info' ? null : 'need_info';
              handleMarkerChange(user.user_id, newMarker);
            }}
            className={`p-0.5 rounded transition-colors ${
              user.marker === 'need_info'
                ? 'text-cyan-600 bg-cyan-50'
                : 'text-slate-400 hover:text-cyan-500 hover:bg-cyan-50'
            }`}
            title="Нужна инфо"
          >
            <FileQuestion className="w-3 h-3" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              const newMarker = user.marker === 'follow_up' ? null : 'follow_up';
              handleMarkerChange(user.user_id, newMarker);
            }}
            className={`p-0.5 rounded transition-colors ${
              user.marker === 'follow_up'
                ? 'text-red-600 bg-red-50'
                : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
            }`}
            title="Follow-up"
          >
            <MessageCircleReply className="w-3 h-3" />
          </button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-4 bg-slate-200 mx-1"></div>
      </div>
{/* ПЕРЕНЕСЕННЫЕ СЮДА БЕЙДЖИ СТАТУСОВ */}
          <div className="flex gap-px">
            {['new', 'in_work', 'pre_booking', 'confirmed'].map(s => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); handleStatusChange(user.user_id, s, false); }}
                className={`px-1.5 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${
                  currentStatus === s ? 'text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
                style={currentStatus === s ? { backgroundColor: STATUS_CONFIG[s]?.color } : {}}
              >
                {STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>
      {/* Право: Пульт управления */}
      <div className="flex gap-1.5">
        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md border border-slate-100 text-slate-300 hover:text-red-500 hover:bg-red-50"
            onClick={(e) => { e.stopPropagation(); handleArchiveAction(user.user_id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
        {/* Кнопка Чат */}
        <div className="relative">
          {/* Красная мигающая - есть непрочитанные */}
          {dialog?.has_new_messages && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping opacity-70"></div>
          )}
          <Button
            size="icon" variant="ghost"
            className={`h-7 w-7 rounded-md border ${
              dialog?.has_new_messages 
                ? 'bg-red-50 border-red-200 text-red-600'  // Красная - есть непрочитанные
                : (dialog?.message_count > 0 
                    ? 'bg-green-50 border-green-200 text-green-600'  // Зелёная - есть сообщения
                    : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100')  // Синяя - нет сообщений
            }`}
            onClick={(e) => { e.stopPropagation(); openUserChat(user); }}
            title={dialog?.message_count ? `Чат (${dialog.message_count} сообщений)` : 'Чат CRM'}
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* 4. Кнопка Telegram (внешняя) */}
        <Button
          size="icon"
          className="h-7 w-7 rounded-md shadow-sm shadow-blue-200 bg-blue-600 text-white hover:bg-blue-700 transition-all"
          onClick={(e) => { e.stopPropagation(); window.open(`https://t.me/${user.username}`, '_blank'); }}
        >
          <Send className="w-3.5 h-3.5 rotate-[-20deg] translate-x-[-1px]" />
        </Button>
      </div>
    </div>
  </CardContent>
</Card>
    );
  })}
</div>
  )}
</main>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
  <DialogContent className="max-w-none w-full max-w-[100vw] h-screen m-0 p-0 flex flex-col border-none rounded-none overflow-hidden">
    
    <div className="sr-only">
      <DialogTitle>Карточка клиента @{selectedUser?.username}</DialogTitle>
      <DialogDescription>Детали аренды, заявки и чат</DialogDescription>
    </div>

    {/* Header Modal */}
    <div className="p-3 bg-slate-900 text-white flex justify-between items-center shrink-0">
       <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold uppercase">
            {selectedUser?.username?.[0] || 'U'}
          </div>
          <div>
              <h2 className="text-sm font-black leading-tight">@{selectedUser?.username}</h2>
              <p className="text-[9px] text-blue-400 font-bold uppercase">ID: {selectedUser?.user_id}</p>
          </div>
       </div>
       <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="text-white h-8 w-8 p-0 hover:bg-slate-800"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" className="text-white h-8 w-8 p-0 hover:bg-slate-800" onClick={() => setIsDetailsOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
       </div>
    </div>

<Tabs 
  value={activeTab} 
  onValueChange={setActiveTab} 
  className="flex-1 flex flex-col min-h-0 bg-white"
>
      <TabsList className="bg-slate-50 border-b h-10 flex justify-start px-4 gap-4 rounded-none">
          <TabsTrigger value="info" className="h-10 rounded-none px-4 font-bold uppercase text-[10px] data-[state=active]:border-b-2 border-blue-600">Инфо и Заявки</TabsTrigger>
          <TabsTrigger value="chat" className="h-10 rounded-none px-4 font-bold uppercase text-[10px] text-blue-600 data-[state=active]:border-b-2 border-blue-600">Чат CRM</TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-hidden">
        
   {/* ВКЛАДКА ИНФО: Сводка, Заявки и История заметок */}
<TabsContent value="info" className="m-0 h-full bg-white">
  <ScrollArea className="h-full">
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      
{/* 1. БЛОК КОНТАКТОВ (Извлекаем из первой попавшейся заявки) */}
{(() => {
  // 1. Ищем первую заявку, где есть данные в поле value или name
  const bWithContact = bookings?.find(b => b.form_data?.contact?.value || b.form_data?.contact?.name);
  
  // 2. Если заявок с контактами нет, ничего не выводим
  if (!bWithContact) return null;

  // 3. Берем данные из найденной заявки
  const contactData = bWithContact.form_data.contact;
  const clientName = contactData?.name;
  const clientPhone = contactData?.value; // ваш телефон в параметре value

  return (
    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl shadow-sm space-y-3 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-emerald-600">
        <Users size={16} className="shrink-0" />
        <h3 className="text-[10px] font-black uppercase tracking-widest">Прямые контакты из заявки</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Имя */}
        <div className="space-y-1">
          <span className="text-[8px] font-bold text-slate-400 uppercase block">Имя клиента</span>
          <p className="text-sm font-black text-slate-800 leading-none">
            {clientName || "Имя не указано"}
          </p>
        </div>
        
{/* Телефон / WhatsApp с иконкой действия */}
{clientPhone && (
  <div className="space-y-1">
    <span className="text-[8px] font-bold text-slate-400 uppercase block">Телефон / WhatsApp</span>
    <div className="flex items-center gap-2">
            <button 
        onClick={() => {
          const cleanPhone = clientPhone.replace(/\D/g, '');
          window.open(`https://wa.me/${cleanPhone}`, '_blank');
        }}
        className="p-1.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
        title="Написать в WhatsApp"
      >
        <Phone size={12} className="fill-current" />
      </button>
      <p className="text-sm font-black text-slate-800 leading-none">{clientPhone}</p>
    </div>
  </div>
)}
      </div>
    </div>
  );
})()}
      {/* Блок 2: Активные заявки (Bookings) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
            <Car size={14} className="text-blue-500" /> Активные заявки ({bookings?.length || 0})
          </h3>
          {/* Кнопка "Создать оффер" */}
          {selectedUser && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              onClick={() => navigateToOffer(selectedUser.user_id)}
            >
              📤 Создать оффер
            </Button>
          )}
        </div>
        
        {bookings && bookings.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {bookings.map((b, i) => (
              <Card key={i} onClick={() => openBookingDialog(b)} className="cursor-pointer border-none bg-slate-50/50 shadow-none ring-1 ring-slate-100 overflow-hidden hover:ring-blue-200 hover:ring-2 transition-all">
                <CardContent className="p-4">
                  {/* Авто и даты */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-black text-[13px] text-slate-900 uppercase tracking-tight">
                        {b.form_data?.car?.name || 'Авто не указано'}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-blue-600 font-bold mt-1">
                        <Calendar size={12} />
                        {dayjs(b.form_data?.dates?.start).format('DD.MM.YY')} — {dayjs(b.form_data?.dates?.end).format('DD.MM.YY')} ({getDaysCount(b.form_data?.dates?.start, b.form_data?.dates?.end)} дн.)
                      </div>
                    </div>
                    <Badge className={`text-[9px] font-black uppercase border-none px-2 py-0.5 rounded-md ${
                      b.status === 'confirmed' ? 'bg-green-500 text-white shadow-[0_0_8px_rgba(147,51,234,0.4)]' :
                      b.status === 'pre_booking' ? 'bg-gray-500 text-white' : 'bg-slate-400 text-white'
                    }`}>
                      {b.status || 'new'}
                    </Badge>
                  </div>

                  {/* Локации и время */}
                  <div className="space-y-1 text-[10px] mb-3">
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin size={12} className="text-red-400 shrink-0" />
                      <span className="font-bold">ВЫДАЧА: {b.form_data?.locations?.pickup || '—'}</span>
                      {b.form_data?.dates?.pickupTime && <span className="text-blue-600">⏰ {b.form_data.dates.pickupTime}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 pl-5">
                      <span>ВОЗВРАТ: {b.form_data?.locations?.dropoff || '—'}</span>
                      {b.form_data?.dates?.returnTime && <span className="text-blue-600">⏰ {b.form_data.dates.returnTime}</span>}
                    </div>
                    {/* Адрес доставки */}
                    {b.form_data?.locations?.pickupAddress && (
                      <div className="flex items-center gap-2 text-slate-500 pl-5">
                        <span className="text-red-400">📍</span>
                        <span>{b.form_data.locations.pickupAddress}</span>
                      </div>
                    )}
                    {b.form_data?.locations?.dropoffAddress && (
                      <div className="flex items-center gap-2 text-slate-500 pl-5">
                        <span className="text-green-400">📍</span>
                        <span>{b.form_data.locations.dropoffAddress}</span>
                      </div>
                    )}
                  </div>

                  {/* Контакт */}
                  {b.form_data?.contact && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 mb-3">
                      <User size={12} className="text-blue-400 shrink-0" />
                      <span className="font-bold">{b.form_data.contact.name || 'Имя не указано'}</span>
                      {b.form_data.contact.value && <span className="text-slate-400">{b.form_data.contact.value}</span>}
                    </div>
                  )}

                  {/* Цены */}
                  <div className="grid grid-cols-3 gap-2 text-[9px] bg-white rounded-lg p-2 border border-slate-100">
                    <div className="text-center">
                      <span className="block text-slate-400 uppercase">Аренда</span>
                      <span className="font-black text-slate-800">{b.form_data?.pricing?.totalRental?.toLocaleString() || 0} ฿</span>
                    </div>
                    <div className="text-center border-l border-slate-100">
                      <span className="block text-slate-400 uppercase">Депозит</span>
                      <span className="font-black text-slate-800">{b.form_data?.pricing?.deposit?.toLocaleString() || 0} ฿</span>
                    </div>
                    <div className="text-center border-l border-slate-100">
                      <span className="block text-slate-400 uppercase">Доставка</span>
                      <span className="font-black text-slate-800">{b.form_data?.pricing?.totalDelivery?.toLocaleString() || b.form_data?.pricing?.delivery?.toLocaleString() || 0} ฿</span>
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Итого к оплате</span>
                    <span className="block text-lg font-black text-blue-600">
                      {((b.form_data?.pricing?.totalRental || 0) + (b.form_data?.pricing?.totalDelivery || b.form_data?.pricing?.delivery || 0)).toLocaleString()} ฿
                    </span>
                    <span className="text-[8px] text-slate-400">Аренда: {b.form_data?.pricing?.totalRental?.toLocaleString() || 0} ฿ + Доставка: {b.form_data?.pricing?.totalDelivery?.toLocaleString() || b.form_data?.pricing?.delivery?.toLocaleString() || 0} ฿</span>
                    <span className="text-[8px] text-slate-400 block mt-1">Депозит: {b.form_data?.pricing?.deposit?.toLocaleString() || 0} ฿</span>
                  </div>

                  {/* Кнопки для брони */}
                  {b.status === 'pre_booking' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                      <Button 
                        size="sm" 
                        variant="default"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={(e) => { e.stopPropagation(); confirmBooking(b.booking_id, b.status); }}
                        disabled={loadingAction[`confirm_${b.booking_id}`]}
                      >
                        {loadingAction[`confirm_${b.booking_id}`] ? '...' : '✓'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        className="bg-red-500 hover:bg-red-600 text-white text-xs"
                        onClick={(e) => { e.stopPropagation(); rejectBooking(b.booking_id, b.status); }}
                        disabled={loadingAction[`reject_${b.booking_id}`]}
                      >
                        {loadingAction[`reject_${b.booking_id}`] ? '...' : '✕'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Область "Нет заявок" - кликабельная */
          <div 
            onClick={() => openBookingDialog()}
            className="cursor-pointer border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-300 hover:bg-blue-50/30 transition-all"
          >
            <CirclePlus size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-[11px] font-black text-slate-400 uppercase">Нет активных заявок</p>
            <p className="text-[9px] text-slate-300 mt-1">Нажмите чтобы создать</p>
          </div>
        )}

        {/* Documents from User */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
            <Paperclip size={14} className="text-green-500" />
            Документы клиента ({userDocuments?.length || 0})
          </h3>
          
          {userDocuments && userDocuments.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {userDocuments.map((doc, index) => (
                <Card key={index} className="border-none bg-slate-50/50 shadow-none ring-1 ring-slate-100 overflow-hidden hover:ring-green-200 transition-all">
                  <CardContent className="p-3">
                    {doc.content_type?.startsWith('image/') ? (
                      // Image preview with download
                      <div className="space-y-2">
                        <img
                          src={doc.download_url}
                          alt={doc.filename || doc.file_name || doc.original_filename || 'image'}
                          className="w-full h-24 object-cover rounded cursor-pointer"
                          onClick={() => window.open(doc.download_url, '_blank')}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium truncate flex-1">
                            {doc.filename || doc.file_name || doc.original_filename || 'image'}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const filename = doc.filename || doc.file_name || doc.original_filename || 'image';
                              const downloadUrl = doc.download_url;
                              
                              console.log("📥 [DEBUG] Download attempt:", {
                                originalFilename: filename,
                                downloadUrl: downloadUrl,
                                contentType: doc.content_type
                              });
                              
                              const link = document.createElement('a');
                              link.href = downloadUrl;
                              link.download = filename;
                              link.click();
                              
                              console.log("✅ [DEBUG] Download triggered for:", filename);
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <Download size={12} />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Document with download
                      <div className="flex items-center gap-2 p-2 bg-slate-100 rounded">
                        <FileText className="w-5 h-5 text-slate-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {doc.filename || doc.file_name || doc.original_filename || 'document'}
                          </div>
                          <div className="text-xs text-slate-500">{doc.content_type}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = doc.download_url;
                            link.download = doc.filename || doc.file_name || doc.original_filename || 'document';
                            link.click();
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <Download size={12} />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">Документов пока нет</p>
            </div>
          )}
        </div>
      </div>
    </div>
  </ScrollArea>
</TabsContent>

          {/* ВКЛАДКА ЧАТ (CORRECTED MEDIA RENDERING) */}
<TabsContent value="chat" className="m-0 h-full flex flex-col bg-slate-100 overflow-hidden w-full max-w-full">
    {/* Чат занимает всё свободное место - обычный div вместо ScrollArea */}
    <div className="flex-1 p-2 w-full h-full overflow-y-auto overflow-x-hidden" style={{ maxWidth: '100vw' }}>
  <div className="w-full max-w-[100vw] mx-auto space-y-3 pb-4 box-border overflow-x-hidden">
    {chats.map((msg, i) => {
      // ✅ ЗАЩИТА ОТ NULL
      if (!msg) return null;

      // ✅ УНИВЕРСАЛЬНОЕ ИЗВЛЕЧЕНИЕ МЕДИА (проверяем 3 места)
      const media = 
        msg?.content?.media ||  // Новый формат
        msg?.media ||           // На верхнем уровне
        null;

      // ✅ УНИВЕРСАЛЬНОЕ ИЗВЛЕЧЕНИЕ ТЕКСТА (проверяем все варианты)
      const messageText = 
        msg?.text ||                           // Прямо в msg
        msg?.content?.text ||                  // В content.text
        msg?.content?.message ||               // В content.message
        (typeof msg?.content === 'string' ? msg.content : null) ||  // content - строка
        (msg?.content?.content && msg.content.content !== '[Медиафайл]' && msg.content.content !== '[Фотография]' 
          ? msg.content.content : null);       // Вложенный content.content

      // ✅ Пропускаем только если нет ни медиа, ни текста
      if (!messageText && !media) {
        console.warn(`⚠️ [SKIP] Empty message ${i}`);
        return null;
      }

      return (
        <div
          key={`msg-${i}-${msg.timestamp || Date.now()}`}
          className={`flex flex-col ${msg.role === 'user' ? 'items-start' : 'items-end'} max-w-full overflow-hidden`}
        >
          <div
            className={`max-w-[85%] sm:max-w-[70%] p-3 rounded-2xl text-[10px] shadow-sm break-words overflow-wrap-anywhere ${
              msg.role === 'user'
                ? 'bg-white text-slate-800 rounded-bl-none'
                : 'bg-blue-600 text-white rounded-br-none'
            }`}
          >
            {/* ===== MEDIA MESSAGE ===== */}
            {media && media.download_url ? (
              <div className="space-y-2 max-w-full overflow-hidden">
                {media.content_type?.startsWith('image/') ? (
                  /* IMAGE */
                  <div className="space-y-2">
                    <img
                      src={media.download_url}
                      alt={media.filename || 'image'}
                      className="max-w-full h-auto rounded cursor-pointer border border-white/20 object-contain"
                      style={{ maxWidth: '100%', height: 'auto' }}
                      onClick={() => window.open(media.download_url, '_blank')}
                      onError={(e) => {
                        console.error(`❌ Image failed:`, media.download_url);
                        // Показываем fallback
                        const target = e.currentTarget;
                        const container = target.parentElement;
                        if (container) {
                          container.innerHTML = `
                            <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                              <div class="flex items-center gap-2 text-amber-700">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                                </svg>
                                <span class="font-bold text-xs">Изображение</span>
                              </div>
                              <p class="text-xs text-slate-600">📎 ${media.filename || 'image'}</p>
                              <a 
                                href="${media.download_url}" 
                                target="_blank"
                                class="block w-full px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 text-center"
                              >
                                Открыть в новой вкладке
                              </a>
                            </div>
                          `;
                        }
                      }}
                    />
                    {messageText && messageText !== '[Медиафайл]' && messageText !== '[Фотография]' && (
                      <p className="text-[10px] break-words">{messageText}</p>
                    )}
                  </div>
                ) : (
                  /* DOCUMENT (PDF etc) */
                  <div className="space-y-2">
                    <div
                      className="flex items-center gap-2 p-2 bg-white/10 rounded-lg cursor-pointer hover:bg-white/20 transition"
                      onClick={() => window.open(media.download_url, '_blank')}
                    >
                      <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                        <FileText className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold truncate">
                          {media.filename || 'Document'}
                        </p>
                        <p className="text-[7px] opacity-70">Нажмите для скачивания</p>
                      </div>
                      <Download className="w-4 h-4 opacity-50" />
                    </div>
                    {messageText && messageText !== '[Медиафайл]' && (
                      <p className="text-[10px] break-words">{messageText}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* ===== TEXT ONLY MESSAGE ===== */
              <p className="break-words overflow-wrap-anywhere">{messageText}</p>
            )}
            
            {/* Checkmarks for manager messages */}
            {msg.role !== 'user' && (
              <div className="flex items-center justify-end gap-0.5 mt-1">
                {msg.send_status === 'pending' && (
                  <Clock className="w-2.5 h-2.5 text-slate-400" />
                )}
                {msg.send_status === 'sent' && (
                  <Check className="w-2.5 h-2.5 text-blue-400" />
                )}
                {msg.send_status === 'failed' && (
                  <AlertCircle className="w-2.5 h-2.5 text-red-500" />
                )}
              </div>
            )}
          </div>

          {/* Role indicator */}
          <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase px-2">
            {msg.role === 'manager' ? 'Менеджер' : 
             msg.role === 'user' ? 'Клиент' : 
             msg.role === 'assistant' ? 'AI' : msg.role}
          </span>
        </div>
      );
    })}

    <div ref={chatEndRef} />
  </div>
</div>

{/* Единый компактный блок управления и ввода */}
<div className="bg-white border-t border-slate-200 shrink-0 p-3 w-full box-border">
    <div className="w-full max-w-full mx-auto box-border">
        
        {/* РЯД 1: Кнопки контроля Claude */}
        <div className="flex justify-between gap-1 mb-3">
            <Button
                size="sm" variant="ghost"
                className="flex-1 h-8 text-[7px] font-bold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                onClick={() => handleClaudeAction(selectedUser?.user_id, 'start')}
                disabled={loadingAction[`claude_${selectedUser?.user_id}_start`]}
            >
                <Play className="w-1.5 h-1.5 mr-1 fill-current" /> START
            </Button>

            <Button
                size="sm" variant="ghost"
                className="flex-1 h-8 text-[7px] font-bold bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200"
                onClick={() => handleClaudeAction(selectedUser?.user_id, 'pause')}
                disabled={loadingAction[`claude_${selectedUser?.user_id}_pause`]}
            >
                <Pause className="w-1.5 h-1.5" /> PAUSE
            </Button>

            <Button
                size="sm" variant="ghost"
                className="flex-1 h-8 text-[7px] font-bold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                onClick={() => handleClaudeAction(selectedUser?.user_id, 'resume')}
                disabled={loadingAction[`claude_${selectedUser?.user_id}_resume`]}
            >
                <RefreshCw className="w-1.5 h-1.5" /> RESUME
            </Button>

            <Button
                size="sm" variant="ghost"
                className="flex-1 h-8 text-[7px] font-bold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                onClick={() => handleClaudeAction(selectedUser?.user_id, 'stop')}
                disabled={loadingAction[`claude_${selectedUser?.user_id}_stop`]}
            >
                <Square className="w-1.5 h-1.5 fill-current" /> STOP
            </Button>
        </div>

        {/* РЯД 2: Индикация и Автообновление */}
        <div className="flex items-center justify-between mb-3 px-1 border-b border-slate-50 pb-2">
            {/* Статус AI */}
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                    selectedUser?.dialog_status?.claude_status === 'active' ? 'bg-green-500 animate-pulse' :
                    selectedUser?.dialog_status?.claude_status === 'paused' ? 'bg-yellow-500' :
                    'bg-red-500'
                }`} />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                    Claude AI: <span className={selectedUser?.dialog_status?.claude_status === 'active' ? 'text-green-600' : 'text-slate-400'}>
                        {selectedUser?.dialog_status?.claude_status || 'OFF'}
                    </span>
                </span>
            </div>

            {/* Блок автообновления */}
            <div className="flex items-center gap-2 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase">
                    Auto-refresh: {autoRefreshEnabled ? 'ON' : 'OFF'}
                </span>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-8 p-0 hover:bg-transparent"
                    onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                >
                    {autoRefreshEnabled ? 
                        <ToggleRight className="w-7 h-7 text-green-500" /> : 
                        <ToggleLeft className="w-7 h-7 text-slate-300" />
                    }
                </Button>
            </div>
        </div>
            {/* File attachment preview */}
            {selectedFile && (
                <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {selectedFile.type.startsWith('image/') ? (
                                <Image className="w-4 h-4 text-blue-600" />
                            ) : (
                                <FileText className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-sm font-medium text-blue-800">
                                {selectedFile.name}
                            </span>
                            <span className="text-xs text-blue-600">
                                ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                            </span>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={removeSelectedFile}
                            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Поле ввода сообщения */}
            <div className="flex gap-2 bg-slate-50 p-1.5 rounded-full border border-slate-100 shadow-inner">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*,.pdf"
                    className="hidden"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full w-8 h-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                >
                    <Paperclip className="w-3.5 h-3.5" />
                </Button>
                
                <input
                    className="flex-1 bg-transparent px-3 py-1 outline-none text-sm"
                    placeholder={selectedFile ? "Добавить описание к файлу..." : "Написать клиенту..."}
                    value={managerMessage}
                    onChange={(e) => setManagerMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (selectedFile) {
                                handleFileUpload();
                            } else {
                                handleSendMessage();
                            }
                        }
                    }}
                />
                
                <Button
                    onClick={selectedFile ? handleFileUpload : handleSendMessage}
                    disabled={isUploading || (!managerMessage.trim() && !selectedFile)}
                    className="rounded-full w-8 h-8 p-0 bg-blue-600 hover:bg-blue-700 transition-transform active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isUploading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Send className="w-3.5 h-3.5" />
                    )}
                </Button>
            </div>
        </div>
    </div>
</TabsContent>
          
      </div>
    </Tabs>
  </DialogContent>
</Dialog>

      {/* Диалог создания/редактирования заявки */}
      {isBookingDialogOpen && (
        <BookingFormDialog
          isOpen={isBookingDialogOpen}
          onClose={() => {
            setIsBookingDialogOpen(false);
            setEditingBooking(null);
          }}
          userId={selectedUser?.user_id}
          userName={selectedUser?.username}
          userContact={selectedUser?.username}
          initialDateRange={selectedUser?.dates_selected ? {
            start: new Date(selectedUser.dates_selected.start),
            end: new Date(selectedUser.dates_selected.end)
          } : undefined}
          carId={editingBooking?.form_data?.car?.id}
          booking={editingBooking}
          onSuccess={handleBookingSuccess}
        />
      )}
      
      <CRMTutorialSheet 
        open={tutorialOpen} 
        onOpenChange={setTutorialOpen} 
      />
    </div>
  );
};

export default CRMPage;