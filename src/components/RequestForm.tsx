import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(2, "Минимум 2 символа").max(80),
  phone: z.string().trim().min(7, "Введите телефон").max(20).regex(/^[+\d\s()-]+$/, "Только цифры и +-()"),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productName: string;
}

export function RequestForm({ open, onOpenChange, productName }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setPhone("");
    setSubmitted(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Проверьте поля");
      return;
    }
    setSubmitting(true);
    try {
      const leads = JSON.parse(localStorage.getItem("loftfire_leads") ?? "[]");
      leads.push({ ...parsed.data, productName, ts: new Date().toISOString() });
      localStorage.setItem("loftfire_leads", JSON.stringify(leads));
      setSubmitted(true);
      toast.success("Заявка отправлена! Скоро свяжемся.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Заявка принята</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Мы свяжемся с вами в течение часа, чтобы обсудить детали по «{productName}».
            </p>
            <Button className="mt-6 w-full" onClick={() => onOpenChange(false)}>
              Готово
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Оставить заявку</DialogTitle>
              <DialogDescription>{productName}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Имя</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван" maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 999 123-45-67"
                  maxLength={20}
                  inputMode="tel"
                />
              </div>
              <Button type="submit" disabled={submitting} variant="ember" className="w-full">
                Отправить заявку
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Нажимая кнопку, вы соглашаетесь на обработку персональных данных
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
