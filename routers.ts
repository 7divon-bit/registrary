import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  acceptFrete,
  completeFrete,
  createFrete,
  createPayment,
  getAllFretes,
  getAllPayments,
  getAllUsers,
  getFreteById,
  getFretesByCity,
  getFretesByClient,
  getFretesByDriver,
  getPaymentByFreteId,
  updateUserProfile,
} from "./db";

const COMMISSION_RATE = 0.05;

// ─── ADMIN GUARD ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  }
  return next({ ctx });
});

// ─── DRIVER GUARD ─────────────────────────────────────────────────────────────
const driverProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.userType !== "DRIVER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas motoristas podem realizar esta ação." });
  }
  return next({ ctx });
});

// ─── CLIENT GUARD ─────────────────────────────────────────────────────────────
const clientProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.userType !== "CLIENT") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas clientes podem realizar esta ação." });
  }
  return next({ ctx });
});

// ─── FRETES ROUTER ────────────────────────────────────────────────────────────
const fretesRouter = router({
  create: clientProcedure
    .input(
      z.object({
        origem: z.string().min(3),
        destino: z.string().min(3),
        valor: z.number().positive(),
        cidade: z.string().min(2),
        origemLat: z.number().optional(),
        origemLng: z.number().optional(),
        destinoLat: z.number().optional(),
        destinoLng: z.number().optional(),
        descricao: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await createFrete({
        clientId: ctx.user.id,
        origem: input.origem,
        destino: input.destino,
        valor: String(input.valor),
        cidade: input.cidade,
        origemLat: input.origemLat ? String(input.origemLat) : null,
        origemLng: input.origemLng ? String(input.origemLng) : null,
        destinoLat: input.destinoLat ? String(input.destinoLat) : null,
        destinoLng: input.destinoLng ? String(input.destinoLng) : null,
        descricao: input.descricao ?? null,
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  listOpen: driverProcedure
    .input(z.object({ cidade: z.string() }))
    .query(async ({ input }) => {
      return getFretesByCity(input.cidade);
    }),

  myFretes: clientProcedure.query(async ({ ctx }) => {
    return getFretesByClient(ctx.user.id);
  }),

  myRides: driverProcedure.query(async ({ ctx }) => {
    return getFretesByDriver(ctx.user.id);
  }),

  accept: driverProcedure
    .input(z.object({ freteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await acceptFrete(input.freteId, ctx.user.id);
      if (!ok) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Frete não disponível ou já foi aceito por outro motorista.",
        });
      }
      return { success: true };
    }),

  complete: protectedProcedure
    .input(z.object({ freteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const frete = await getFreteById(input.freteId);
      if (!frete) throw new TRPCError({ code: "NOT_FOUND", message: "Frete não encontrado." });

      if (frete.driverId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para finalizar este frete." });
      }

      const total = parseFloat(String(frete.valor));
      const commission = parseFloat((total * COMMISSION_RATE).toFixed(2));
      const driverAmount = parseFloat((total - commission).toFixed(2));

      await completeFrete(input.freteId);
      await createPayment({
        freteId: input.freteId,
        total: String(total),
        commission: String(commission),
        driverAmount: String(driverAmount),
        status: "PENDING",
      });

      return { success: true, total, commission, driverAmount };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const frete = await getFreteById(input.id);
      if (!frete) throw new TRPCError({ code: "NOT_FOUND" });
      return frete;
    }),

  getPayment: protectedProcedure
    .input(z.object({ freteId: z.number() }))
    .query(async ({ input }) => {
      return getPaymentByFreteId(input.freteId);
    }),
});

// ─── PAYMENTS ROUTER ──────────────────────────────────────────────────────────
const paymentsRouter = router({
  createPix: protectedProcedure
    .input(z.object({ freteId: z.number() }))
    .mutation(async ({ input }) => {
      const frete = await getFreteById(input.freteId);
      if (!frete) throw new TRPCError({ code: "NOT_FOUND", message: "Frete não encontrado." });

      const total = parseFloat(String(frete.valor));
      const mpToken = process.env.MP_TOKEN;

      if (!mpToken) {
        // Modo demo: retorna QR code simulado
        return {
          demo: true,
          qrCode: "00020126580014BR.GOV.BCB.PIX0136demo-pix-key-mobi-green5204000053039865802BR5913MOBI GREEN6009SAO PAULO62070503***6304DEMO",
          qrCodeBase64: "",
          paymentId: "demo-" + Date.now(),
          total,
        };
      }

      try {
        const response = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mpToken}`,
          },
          body: JSON.stringify({
            transaction_amount: total,
            payment_method_id: "pix",
            payer: { email: "cliente@mobigreen.com.br" },
            description: `Frete #${input.freteId} - Mobi Green`,
          }),
        });

        const data = await response.json() as {
          id: string;
          point_of_interaction?: {
            transaction_data?: {
              qr_code?: string;
              qr_code_base64?: string;
            };
          };
        };

        return {
          demo: false,
          qrCode: data.point_of_interaction?.transaction_data?.qr_code ?? "",
          qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64 ?? "",
          paymentId: String(data.id),
          total,
        };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao gerar pagamento PIX." });
      }
    }),
});

// ─── PROFILE ROUTER ───────────────────────────────────────────────────────────
const profileRouter = router({
  update: protectedProcedure
    .input(
      z.object({
        userType: z.enum(["CLIENT", "DRIVER"]).optional(),
        phone: z.string().optional(),
        cidade: z.string().optional(),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.id, input);
      return { success: true };
    }),
});

// ─── ADMIN ROUTER ─────────────────────────────────────────────────────────────
const adminRouter = router({
  listFretes: adminProcedure.query(async () => {
    return getAllFretes();
  }),

  listUsers: adminProcedure.query(async () => {
    return getAllUsers();
  }),

  listPayments: adminProcedure.query(async () => {
    return getAllPayments();
  }),

  stats: adminProcedure.query(async () => {
    const [allFretes, allUsers, allPayments] = await Promise.all([
      getAllFretes(),
      getAllUsers(),
      getAllPayments(),
    ]);

    const totalRevenue = allPayments.reduce((sum, p) => sum + parseFloat(String(p.commission)), 0);
    const openFretes = allFretes.filter((f) => f.status === "OPEN").length;
    const deliveredFretes = allFretes.filter((f) => f.status === "DELIVERED").length;
    const drivers = allUsers.filter((u) => u.userType === "DRIVER").length;
    const clients = allUsers.filter((u) => u.userType === "CLIENT").length;

    return {
      totalFretes: allFretes.length,
      openFretes,
      deliveredFretes,
      totalUsers: allUsers.length,
      drivers,
      clients,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    };
  }),
});

// ─── APP ROUTER ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  fretes: fretesRouter,
  payments: paymentsRouter,
  profile: profileRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
