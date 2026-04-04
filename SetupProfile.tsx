import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Package, Truck } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function SetupProfile() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [userType, setUserType] = useState<"CLIENT" | "DRIVER" | null>(null);
  const [phone, setPhone] = useState("");
  const [cidade, setCidade] = useState("");

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Perfil configurado com sucesso!");
      if (userType === "DRIVER") navigate("/motorista");
      else navigate("/cliente");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!userType) return toast.error("Selecione seu perfil.");
    if (!cidade.trim()) return toast.error("Informe sua cidade.");
    updateProfile.mutate({ userType, phone, cidade });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
              <Truck className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Bem-vindo ao Mobi Green</CardTitle>
          <CardDescription>Configure seu perfil para começar a usar a plataforma</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          <div>
            <Label className="text-sm font-semibold mb-3 block">Qual é o seu perfil?</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUserType("CLIENT")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  userType === "CLIENT"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Package className="w-8 h-8 mb-2 text-primary" />
                <div className="font-semibold text-foreground">Cliente</div>
                <div className="text-xs text-muted-foreground mt-1">Crio fretes e contrato motoristas</div>
              </button>

              <button
                type="button"
                onClick={() => setUserType("DRIVER")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  userType === "DRIVER"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Truck className="w-8 h-8 mb-2 text-primary" />
                <div className="font-semibold text-foreground">Motorista</div>
                <div className="text-xs text-muted-foreground mt-1">Aceito fretes e faço entregas</div>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="cidade">Cidade de atuação *</Label>
              <Input
                id="cidade"
                placeholder="Ex: São Paulo"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input
                id="phone"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={updateProfile.isPending || !userType}
            className="w-full"
            size="lg"
          >
            {updateProfile.isPending ? "Salvando..." : "Confirmar e Entrar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
