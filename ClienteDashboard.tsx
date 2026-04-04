import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  LogOut,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FreteCard } from "@/components/FreteCard";

export default function ClienteDashboard() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    origem: "",
    destino: "",
    valor: "",
    cidade: "",
    descricao: "",
  });

  const { data: fretes, isLoading, refetch } = trpc.fretes.myFretes.useQuery();

  const createFrete = trpc.fretes.create.useMutation({
    onSuccess: () => {
      toast.success("Frete criado com sucesso!");
      setOpen(false);
      setForm({ origem: "", destino: "", valor: "", cidade: "", descricao: "" });
      utils.fretes.myFretes.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!form.origem || !form.destino || !form.valor || !form.cidade) {
      return toast.error("Preencha todos os campos obrigatórios.");
    }
    createFrete.mutate({
      origem: form.origem,
      destino: form.destino,
      valor: parseFloat(form.valor),
      cidade: form.cidade,
      descricao: form.descricao || undefined,
    });
  };

  const open_count = fretes?.filter((f) => f.status === "OPEN").length ?? 0;
  const assigned_count = fretes?.filter((f) => f.status === "ASSIGNED").length ?? 0;
  const delivered_count = fretes?.filter((f) => f.status === "DELIVERED").length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-sidebar text-sidebar-foreground shadow-md">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center">
              <Truck className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Mobi Green</span>
            <Badge variant="secondary" className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
              Cliente
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-sidebar-foreground/80 hidden sm:block">
              {user?.name ?? user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{open_count}</div>
              <div className="text-xs text-muted-foreground mt-1">Aguardando</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{assigned_count}</div>
              <div className="text-xs text-muted-foreground mt-1">Em andamento</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-green-600">{delivered_count}</div>
              <div className="text-xs text-muted-foreground mt-1">Entregues</div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Meus Fretes</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Novo Frete
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Novo Frete</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="origem">Origem *</Label>
                      <Input
                        id="origem"
                        placeholder="Endereço de origem"
                        value={form.origem}
                        onChange={(e) => setForm({ ...form, origem: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="destino">Destino *</Label>
                      <Input
                        id="destino"
                        placeholder="Endereço de destino"
                        value={form.destino}
                        onChange={(e) => setForm({ ...form, destino: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="valor">Valor (R$) *</Label>
                      <Input
                        id="valor"
                        type="number"
                        min="1"
                        step="0.01"
                        placeholder="0,00"
                        value={form.valor}
                        onChange={(e) => setForm({ ...form, valor: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cidade">Cidade *</Label>
                      <Input
                        id="cidade"
                        placeholder="Ex: São Paulo"
                        value={form.cidade}
                        onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="descricao">Descrição (opcional)</Label>
                    <Textarea
                      id="descricao"
                      placeholder="Detalhes sobre o frete..."
                      value={form.descricao}
                      onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                      className="mt-1 resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                    <strong>Comissão da plataforma:</strong> 5% sobre o valor do frete
                  </div>
                  <Button
                    onClick={handleCreate}
                    disabled={createFrete.isPending}
                    className="w-full"
                  >
                    {createFrete.isPending ? "Criando..." : "Criar Frete"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Fretes list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando fretes...</div>
        ) : !fretes || fretes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">Nenhum frete criado ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Clique em "Novo Frete" para começar
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fretes.map((frete) => (
              <FreteCard key={frete.id} frete={frete} role="CLIENT" />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
