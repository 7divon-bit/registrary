import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckCircle, MapPin, DollarSign, Clock } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FreteStatus = "OPEN" | "ASSIGNED" | "DELIVERED" | "CANCELLED";

interface FreteData {
  id: number;
  origem: string;
  destino: string;
  valor: string | number;
  status: FreteStatus;
  cidade: string;
  descricao?: string | null;
  driverId?: number | null;
  clientId?: number;
  createdAt?: Date | string;
}

interface FreteCardProps {
  frete: FreteData;
  role: "CLIENT" | "DRIVER" | "ADMIN";
  onAccepted?: () => void;
  onCompleted?: () => void;
}

const STATUS_LABELS: Record<FreteStatus, string> = {
  OPEN: "Disponível",
  ASSIGNED: "Em andamento",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

const STATUS_CLASSES: Record<FreteStatus, string> = {
  OPEN: "bg-blue-100 text-blue-700 border-blue-200",
  ASSIGNED: "bg-yellow-100 text-yellow-700 border-yellow-200",
  DELIVERED: "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
};

export function FreteCard({ frete, role, onAccepted, onCompleted }: FreteCardProps) {
  const utils = trpc.useUtils();
  const [pixOpen, setPixOpen] = useState(false);
  const [pixData, setPixData] = useState<{
    qrCode: string;
    qrCodeBase64: string;
    paymentId: string;
    total: number;
    demo: boolean;
  } | null>(null);

  const acceptFrete = trpc.fretes.accept.useMutation({
    onSuccess: () => {
      toast.success("Frete aceito com sucesso!");
      utils.fretes.listOpen.invalidate();
      utils.fretes.myRides.invalidate();
      onAccepted?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const completeFrete = trpc.fretes.complete.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Frete finalizado! Comissão: R$ ${data.commission.toFixed(2)} | Motorista: R$ ${data.driverAmount.toFixed(2)}`
      );
      utils.fretes.myRides.invalidate();
      utils.fretes.myFretes.invalidate();
      onCompleted?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const createPix = trpc.payments.createPix.useMutation({
    onSuccess: (data) => {
      setPixData(data);
      setPixOpen(true);
    },
    onError: (err) => toast.error(err.message),
  });

  const valor = parseFloat(String(frete.valor));
  const commission = parseFloat((valor * 0.05).toFixed(2));
  const driverAmount = parseFloat((valor - commission).toFixed(2));

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="pt-4 pb-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-sm text-foreground">Frete #{frete.id}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_CLASSES[frete.status]}`}
            >
              {STATUS_LABELS[frete.status]}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
              <span className="text-foreground truncate">{frete.origem}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
              <span className="text-foreground truncate">{frete.destino}</span>
            </div>
          </div>

          {frete.descricao && (
            <p className="text-xs text-muted-foreground line-clamp-2">{frete.descricao}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1 text-sm font-bold text-foreground">
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              R$ {valor.toFixed(2)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {frete.cidade}
            </div>
          </div>

          {role === "DRIVER" && frete.status === "ASSIGNED" && (
            <div className="text-xs text-muted-foreground bg-muted rounded p-2">
              Comissão plataforma (5%): <strong>R$ {commission.toFixed(2)}</strong>
              <br />
              Seu recebimento: <strong className="text-green-700">R$ {driverAmount.toFixed(2)}</strong>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-0 pb-3 gap-2">
          {role === "DRIVER" && frete.status === "OPEN" && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => acceptFrete.mutate({ freteId: frete.id })}
              disabled={acceptFrete.isPending}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              {acceptFrete.isPending ? "Aceitando..." : "Aceitar Frete"}
            </Button>
          )}

          {role === "DRIVER" && frete.status === "ASSIGNED" && (
            <Button
              size="sm"
              variant="outline"
              className="w-full border-green-500 text-green-700 hover:bg-green-50"
              onClick={() => completeFrete.mutate({ freteId: frete.id })}
              disabled={completeFrete.isPending}
            >
              {completeFrete.isPending ? "Finalizando..." : "Finalizar Entrega"}
            </Button>
          )}

          {role === "CLIENT" && frete.status === "DELIVERED" && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => createPix.mutate({ freteId: frete.id })}
              disabled={createPix.isPending}
            >
              {createPix.isPending ? "Gerando PIX..." : "Pagar via PIX"}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* PIX Dialog */}
      <Dialog open={pixOpen} onOpenChange={setPixOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pagamento via PIX</DialogTitle>
          </DialogHeader>
          {pixData && (
            <div className="space-y-4">
              {pixData.demo && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  Modo demonstração — configure o token do Mercado Pago para pagamentos reais.
                </div>
              )}
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">R$ {pixData.total.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Frete #{frete.id}</div>
              </div>
              {pixData.qrCodeBase64 && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 border rounded-lg"
                  />
                </div>
              )}
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">Código PIX Copia e Cola:</div>
                <div className="text-xs font-mono break-all text-foreground">{pixData.qrCode}</div>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(pixData.qrCode);
                  toast.success("Código PIX copiado!");
                }}
              >
                Copiar Código PIX
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
