# Mobi Green - TODO

## Schema & Backend
- [x] Estender schema do banco com tabelas fretes e payments
- [x] Adicionar campo userType (CLIENT/DRIVER) na tabela users
- [x] Criar helpers de DB para fretes e payments
- [x] Router tRPC: registro de usuário com tipo (cliente/motorista)
- [x] Router tRPC: criar frete (cliente)
- [x] Router tRPC: listar fretes abertos por cidade (motorista)
- [x] Router tRPC: aceitar frete (motorista, OPEN → ASSIGNED)
- [x] Router tRPC: finalizar frete com cálculo de comissão 5%
- [x] Router tRPC: pagamento PIX via Mercado Pago
- [x] Router tRPC: painel admin - listar todos fretes
- [x] Router tRPC: painel admin - listar todos usuários
- [x] Router tRPC: listar fretes do cliente logado
- [x] Router tRPC: listar fretes do motorista logado

## Frontend
- [x] Estilo global e tema verde (Mobi Green)
- [x] Página de login/registro com seleção de perfil (cliente/motorista)
- [x] Dashboard do cliente: criar frete + listar fretes próprios
- [x] Dashboard do motorista: listar fretes abertos por cidade + aceitar
- [x] Painel de detalhes do frete (status, valor, comissão)
- [x] Tela de pagamento PIX
- [x] Painel administrativo: fretes e usuários
- [x] Navegação diferenciada por perfil
- [x] Responsividade mobile

## Testes
- [x] Testes vitest para routers de fretes
- [x] Testes vitest para cálculo de comissão

## Secrets
- [x] Configurar MP_TOKEN (Mercado Pago) via secrets
