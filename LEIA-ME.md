# MOBI GREEN — Deploy no Vercel

## Passo a passo completo

---

### 1. Criar conta no GitHub (se não tiver)
1. Acesse https://github.com e clique em **Sign up**
2. Use seu e-mail e crie uma senha
3. Confirme o e-mail

---

### 2. Subir o projeto no GitHub
1. Acesse https://github.com/new
2. Nome do repositório: `mobi-green`
3. Deixe como **Private** e clique em **Create repository**
4. Faça upload dos arquivos desta pasta:
   - Clique em **uploading an existing file**
   - Arraste todos os arquivos e pastas desta pasta
   - Clique em **Commit changes**

---

### 3. Deploy no Vercel
1. Acesse https://vercel.com e clique em **Sign Up with GitHub**
2. Clique em **Add New Project**
3. Escolha o repositório `mobi-green`
4. Clique em **Deploy** (as configurações já estão prontas)
5. Em ~1 minuto seu site estará no ar com um link Vercel

---

### 4. Conectar o domínio www.registrary.com.br
**No Vercel:**
1. Vá em **Settings → Domains**
2. Digite `www.registrary.com.br` e clique em **Add**
3. Vercel vai mostrar dois registros DNS para configurar

**No painel do seu registro de domínio (onde você comprou):**
Adicione estes registros DNS:

| Tipo  | Nome | Valor                    |
|-------|------|--------------------------|
| CNAME | www  | cname.vercel-dns.com     |
| A     | @    | 76.76.21.21              |

> ⚠️ Pode levar até 24h para o domínio propagar, mas geralmente é em minutos.

---

### Pronto! 🎉
Seu site estará acessível em **www.registrary.com.br**

---

### Suporte
- Vercel Docs: https://vercel.com/docs
- Dúvidas de DNS: consulte o painel do seu registrador de domínio
