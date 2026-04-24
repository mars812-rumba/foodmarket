"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  UserRoundCheck,
  UserRoundPlus,
  Send,
  Clock,
  FileQuestion,
  RefreshCw,
  Car,
  Calendar,
  MessageSquare,
  FileText,
  Image,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Square,
  Info,
} from "lucide-react";

interface CRMTutorialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CRMTutorialSheet({ open, onOpenChange }: CRMTutorialSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="mb-2">
          <SheetTitle className="text-center text-base font-semibold">
            <Info className="w-4 h-4 inline mr-1" />
            Как пользоваться CRM
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="funnel" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-9 rounded-lg bg-slate-100">
            <TabsTrigger value="funnel" className="text-[10px] data-[state=active]:bg-white">
              Воронка
            </TabsTrigger>
            <TabsTrigger value="card" className="text-[10px] data-[state=active]:bg-white">
              Карточка
            </TabsTrigger>
            <TabsTrigger value="markers" className="text-[10px] data-[state=active]:bg-white">
              Маркеры
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-[10px] data-[state=active]:bg-white">
              AI
            </TabsTrigger>
          </TabsList>

          {/* ВОРОНКА */}
          <TabsContent value="funnel" className="mt-4 space-y-3 overflow-y-auto max-h-[calc(85vh-120px)] px-1">
            <div className="text-sm text-slate-600">
              Статусы заявок — двигайте лид по воронке продаж:
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <div className="w-12 text-center">
                  <span className="text-[10px] font-bold text-slate-400">NEW</span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-700">Новая заявка</div>
                  <div className="text-[10px] text-slate-500">Лид только пришёл, требует внимания</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg border border-violet-100">
                <div className="w-12 text-center">
                  <span className="text-[10px] font-bold text-violet-600">WORK</span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-700">В работе</div>
                  <div className="text-[10px] text-slate-500">Менеджер работает с лидом</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
                <div className="w-12 text-center">
                  <span className="text-[10px] font-bold text-orange-600">PBOOK</span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-700">Предбронь</div>
                  <div className="text-[10px] text-slate-500">Клиент готов бронировать</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                <div className="w-12 text-center">
                  <span className="text-[10px] font-bold text-green-600">BOOK</span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-700">Подтверждена</div>
                  <div className="text-[10px] text-slate-500">Бронь оформлена, ожидает выдачи</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-lg">
                <div className="w-12 text-center">
                  <span className="text-[10px] font-bold text-slate-400">ARCH</span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-500">Архив</div>
                  <div className="text-[10px] text-slate-400">Сделка закрыта или отказ</div>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 bg-blue-50 p-2 rounded-lg">
              Система переводит статусы автоматически по действиям. Менеджер может изменить вручную.
            </div>
          </TabsContent>

          {/* КАРТОЧКА */}
          <TabsContent value="card" className="mt-4 space-y-3 overflow-y-auto max-h-[calc(85vh-120px)] px-1">
            <div className="text-sm text-slate-600">
              Кликните на карточку — откроется полная информация:
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                <Car className="w-4 h-4 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-700">Данные заявки</div>
                  <div className="text-[10px] text-slate-500">Машина, даты, локация получения/возврата</div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                <Calendar className="w-4 h-4 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-700">Календарь</div>
                  <div className="text-[10px] text-slate-500">Заявка появляется в календаре бронирований</div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                <FileText className="w-4 h-4 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-700">Документы</div>
                  <div className="text-[10px] text-slate-500">Фото паспорта и прав от клиента</div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-700">Подтвердить / Отменить</div>
                  <div className="text-[10px] text-slate-500">Управление бронью из карточки клиента</div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-700">Чат с клиентом</div>
                  <div className="text-[10px] text-slate-500">Переписка, отправка фото, работа с AI</div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* МАРКЕРЫ */}
          <TabsContent value="markers" className="mt-4 space-y-3 overflow-y-auto max-h-[calc(85vh-120px)] px-1">
            <div className="text-sm text-slate-600">
              Маркеры помогают быстро оценить ситуацию с лидом:
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                <Send className="w-4 h-4 text-amber-500" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-amber-700">Оффер отправлен</div>
                  <div className="text-[10px] text-amber-600">Клиенту отправлено коммерческое предложение</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg border border-purple-100">
                <Clock className="w-4 h-4 text-purple-500" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-purple-700">Ждём ответ</div>
                  <div className="text-[10px] text-purple-600">Клиент думает, ожидаем решение</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-cyan-50 rounded-lg border border-cyan-100">
                <FileQuestion className="w-4 h-4 text-cyan-500" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-cyan-700">Нужна информация</div>
                  <div className="text-[10px] text-cyan-600">Запросили данные у клиента</div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                <RefreshCw className="w-4 h-4 text-red-500" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-red-700">Follow-up</div>
                  <div className="text-[10px] text-red-600">Нужно напомнить о себе</div>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
              Клик на иконку — маркер ставится. Повторный клик — сбрасывается.
            </div>
          </TabsContent>

          {/* AI */}
          <TabsContent value="ai" className="mt-4 space-y-3 overflow-y-auto max-h-[calc(85vh-120px)] px-1">
            <div className="text-sm text-slate-600">
              AI ведёт диалог с клиентом — отвечает, квалифицирует, дожимает:
            </div>

            <div className="space-y-2">
              <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 mb-1">
                  <Play className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-semibold text-green-700">START</span>
                </div>
                <div className="text-[10px] text-green-600">Включить AI для этого клиента</div>
              </div>

              <div className="p-2 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="flex items-center gap-2 mb-1">
                  <Pause className="w-4 h-4 text-yellow-600" />
                  <span className="text-xs font-semibold text-yellow-700">PAUSE</span>
                </div>
                <div className="text-[10px] text-yellow-600">Приостановить AI, пишете вы</div>
              </div>

              <div className="p-2 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center gap-2 mb-1">
                  <Square className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-semibold text-red-600">STOP</span>
                </div>
                <div className="text-[10px] text-red-600">Остановить AI полностью</div>
              </div>
            </div>

            <div className="text-sm font-medium text-slate-700 mt-3">Что умеет AI:</div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="flex items-center gap-1 p-1.5 bg-slate-50 rounded">
                <Car className="w-3 h-3 text-blue-500" />
                <span>Отвечает про машины</span>
              </div>
              <div className="flex items-center gap-1 p-1.5 bg-slate-50 rounded">
                <Image className="w-3 h-3 text-blue-500" />
                <span>Отправляет фото</span>
              </div>
              <div className="flex items-center gap-1 p-1.5 bg-slate-50 rounded">
                <FileText className="w-3 h-3 text-blue-500" />
                <span>Считает цены</span>
              </div>
              <div className="flex items-center gap-1 p-1.5 bg-slate-50 rounded">
                <Users className="w-3 h-3 text-blue-500" />
                <span>Квалифицирует</span>
              </div>
            </div>

            <div className="text-xs text-slate-500 bg-blue-50 p-2 rounded-lg mt-2">
              AI имеет доступ к базе автомобилей и фотографиям. Работает 24/7.
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
