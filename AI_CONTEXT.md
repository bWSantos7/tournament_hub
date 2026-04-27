# AI_CONTEXT.md — Contexto técnico oficial do Tennis Hub

Este documento resume o contexto do projeto Tennis Hub para qualquer IA, agente de código ou desenvolvedor que precise atuar no repositório.

Use este arquivo como referência geral do produto, arquitetura, regras de negócio, integrações e cuidados obrigatórios.

---

## 1. Nome do projeto

```txt
Tennis Hub
```

---

## 2. Objetivo do produto

O Tennis Hub é uma plataforma para centralizar torneios de tênis no Brasil.

A proposta é permitir que jogadores encontrem torneios, filtrem eventos, vejam compatibilidade com seu perfil esportista, acompanhem agenda, realizem inscrições e gerenciem planos de assinatura.

Também há painel administrativo para gestão, estatísticas, conectores, torneios, inscrições e visão operacional.

---

## 3. Público-alvo

- Jogadores de tênis.
- Organizadores de torneios.
- Administradores da plataforma.
- Usuários de planos gratuitos, Pro e Elite.

---

## 4. Escopo do MVP

O MVP deve conter, com qualidade de produção:

- Cadastro e login.
- Verificação de e-mail.
- Recuperação de senha.
- Perfil esportista.
- Listagem de torneios.
- Filtros de torneios.
- Torneios compatíveis.
- Agenda de torneios.
- Inscrição em torneios.
- Lista de inscritos.
- Alertas/notificações.
- Planos e assinaturas.
- Pagamento via Asaas.
- Painel administrativo.
- Dashboard admin.
- Estatísticas.
- Conectores.
- Upload de imagem de perfil.

---

## 5. Stack técnica

### Backend

```txt
Django
Django REST Framework
PostgreSQL
Redis
Celery Worker
Celery Beat
```

### Frontend Web

```txt
Frontend web hospedado no Railway
Domínio: https://www.tennis.app.br
```

### Mobile

```txt
React Native
Expo
Android
iOS
```

### Infraestrutura

```txt
Railway
PostgreSQL
Redis
```

### Integrações

```txt
Resend
Cloudinary
Sentry
Asaas
```

---

## 6. Repositório

```txt
https://github.com/bWSantos7/tennis_hub.git
```

---

## 7. Domínios oficiais

```txt
Site:
https://www.tennis.app.br

API:
https://api.tennis.app.br
```

Esses devem ser considerados os domínios finais do projeto.

Evitar utilizar URLs antigas do Railway como padrão no código de produção.

---

## 8. Estrutura de infraestrutura esperada

O projeto roda no Railway com serviços separados:

```txt
frontend
backend
worker/beat
Redis
PostgreSQL
```

O backend usa PostgreSQL em produção.

Redis é usado para filas/cache e suporte ao worker/beat.

---

## 9. Custos conhecidos

Custos aproximados atuais informados:

| Item | Valor | Pagamento | Plano |
|---|---:|---|---|
| Domínio | R$40,00 | Anual | - |
| Claude | R$118,87 | Mensal | Pro |
| Railway | R$108,23 | Mensal | Pro |
| Resend | R$0,00 | Mensal | Free |
| Cloudinary | R$0,00 | Mensal | Free |
| Sentry | R$0,00 | Mensal | Free |

Custo mensal/inicial aproximado informado:

```txt
R$267,10
```

---

## 10. Regras de segurança

Segurança é prioridade máxima.

Nunca inserir secrets no código.

Nunca commitar `.env`.

Nunca expor variáveis sensíveis no mobile ou frontend.

Secrets devem estar somente em ambiente seguro do Railway ou provedor equivalente.

São considerados sensíveis:

```txt
SECRET_KEY
DATABASE_URL
REDIS_URL
POSTGRES_PASSWORD
REDIS_PASSWORD
RESEND_API_KEY
CLOUDINARY_URL
ASAAS_API_KEY
ASAAS_WEBHOOK_TOKEN
VAPID_PRIVATE_KEY
SENTRY_DSN
```

Se qualquer uma dessas chaves aparecer no código, considerar comprometida.

---

## 11. Variáveis e ambientes

Ambiente de produção deve ter:

```txt
DEBUG=False
ALLOWED_HOSTS restrito
DATABASE_URL obrigatório
REDIS_URL obrigatório
SECURE_SSL_REDIRECT=True, quando compatível com proxy/infra
CSRF_TRUSTED_ORIGINS correto
CORS_ALLOWED_ORIGINS correto
```

Não deve existir fallback silencioso para SQLite em produção.

---

## 12. Backend — responsabilidades

O backend deve ser responsável por:

- Autenticação.
- Permissões.
- Regras de negócio.
- Pagamentos.
- Webhooks.
- Integrações externas.
- Segurança.
- Validação de dados.
- Dados de torneios.
- Compatibilidade de torneios.
- Lista de inscritos.
- Painel admin.
- Conectores.
- Estatísticas.

O frontend e o mobile não devem implementar regras críticas isoladas.

---

## 13. Mobile — responsabilidades

O mobile deve:

- Consumir API.
- Exibir dados.
- Permitir interação do usuário.
- Ter UX fluida.
- Tratar loading, erro e vazio.
- Não expor chaves.
- Não atualizar dados críticos sem retorno do backend.
- Funcionar em Android e iOS.
- Ser compatível com Expo.

O mobile não deve conter:

- Chaves de API privadas.
- Lógica de confirmação de pagamento.
- Regras administrativas críticas.
- Dados mockados em produção.

---

## 14. Pagamentos

Pagamentos são feitos via Asaas.

A integração deve funcionar inicialmente em sandbox e depois produção.

Regras obrigatórias:

1. O backend cria a cobrança.
2. O backend conversa com Asaas.
3. O mobile/web apenas solicita e exibe o resultado.
4. Para PIX, a tela deve mostrar QR Code e Pix copia e cola.
5. O usuário pode copiar o código PIX.
6. O plano fica pendente enquanto o pagamento não for confirmado.
7. O plano só muda após confirmação real do pagamento.
8. Confirmação deve vir de webhook ou consulta segura ao backend.
9. O app deve exibir status claro de pagamento.

Nunca alterar plano apenas porque o usuário clicou em “OK”.

---

## 15. Planos

Planos previstos:

```txt
Free/Base
Pro
Elite
```

Os planos devem ser controlados pelo backend.

Alterações de plano dependem de assinatura/pagamento confirmado.

---

## 16. Torneios

Entidades e recursos importantes:

- Torneio.
- Federação.
- Cidade/localização.
- Categoria.
- Nível.
- Datas.
- Inscrições.
- Agenda.
- Lista de inscritos.
- Status do torneio.
- Prazo de inscrição.

Filtros importantes:

- Federação.
- Cidade.
- Distância.
- Categoria.
- Nível.
- Data.
- Compatibilidade com perfil.

---

## 17. Torneios compatíveis

A seção “Torneios compatíveis com você” deve usar dados reais do perfil esportista do usuário.

Critérios possíveis:

- Localização.
- Distância máxima.
- Nível.
- Categoria.
- Idade.
- Gênero.
- Preferências do perfil.
- Regras do torneio.

Se não houver torneios compatíveis, exibir mensagem amigável e orientar o usuário a revisar preferências.

---

## 18. Inscrições

O fluxo de inscrição deve ser claro e funcional.

Ao se inscrever em torneio:

- O teclado não deve cobrir campos.
- Os campos devem ser visíveis.
- Deve haver validação.
- Deve haver loading.
- Deve haver feedback de sucesso/erro.
- Dados devem ser enviados para o backend.
- A inscrição deve refletir na lista de inscritos e/ou agenda quando aplicável.

---

## 19. Lista de inscritos

A lista de inscritos deve retornar dados reais do backend.

Informações desejáveis:

- Total de inscritos.
- Nome ou identificação permitida.
- Categoria.
- Status da inscrição.
- Status de pagamento.
- Posição, se existir.
- Dados relevantes do torneio.

Respeitar privacidade e permissões.

---

## 20. Agenda

A agenda deve listar torneios adicionados pelo usuário.

Regras:

- Cards organizados.
- Status visível.
- Botão de remover/lixeira no canto inferior direito.
- Não sobrepor botão com status.
- Toda exclusão deve pedir confirmação.
- Estado vazio deve ser amigável.

---

## 21. Alertas

Alertas devem ser amigáveis e sem campos técnicos.

Exemplo incorreto:

```txt
entry_close_at
```

Exemplo correto:

```txt
As inscrições encerram em 30/04/2026 às 18:00.
```

Preferências de alertas devem mostrar apenas canais suportados.

Se e-mail não for uma opção desejada no mobile, remover essa opção da interface e da lógica.

---

## 22. Painel admin

O painel administrativo deve ser estável e protegido.

Áreas importantes:

- Dashboard.
- Conectores.
- Estatísticas.
- Torneios.
- Usuários.
- Inscrições.
- Pagamentos.
- Monitoramento.

Regras:

- Exigir autenticação.
- Exigir permissão de admin.
- Não quebrar se não houver dados.
- Não quebrar se conectores estiverem vazios.
- Exibir mensagens claras de erro.
- Tratar loading e empty state.

---

## 23. Dashboard admin

O dashboard deve carregar indicadores e gráficos sem quebrar.

Possíveis causas de erro a investigar:

- Endpoint inexistente.
- Erro 401/403.
- Payload diferente do esperado.
- Dados nulos.
- Serializer quebrando.
- Query pesada.
- CORS.
- Token expirado.
- Falta de fallback no frontend.

---

## 24. Conectores admin

A área de conectores deve carregar mesmo sem conectores configurados.

Não deve gerar crash.

Deve mostrar estado vazio, por exemplo:

```txt
Nenhum conector configurado ainda.
```

---

## 25. Stats

A tela de estatísticas deve ter:

- Espaçamento adequado entre gráficos.
- Layout legível.
- Responsividade.
- Loading.
- Erro.
- Estado vazio.
- Gráficos visualmente separados.

---

## 26. UX geral

Diretrizes visuais:

- Interface limpa.
- Visual moderno.
- Estilo esportivo.
- Sem excesso de emojis.
- Sem cards sem função.
- Sem campos técnicos na interface.
- Boa hierarquia visual.
- Boa área de toque.
- Boa leitura em telas pequenas.
- Feedback claro para ações do usuário.

---

## 27. Teclado no mobile

Em telas com campos de formulário:

- Usar `KeyboardAvoidingView`.
- Usar `ScrollView`.
- Usar `keyboardShouldPersistTaps`.
- Adicionar padding inferior quando necessário.
- Garantir compatibilidade Android/iOS.
- Nenhum campo deve ficar coberto pelo teclado.

---

## 28. LGPD

O projeto deve respeitar LGPD.

Link oficial:

```txt
https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
```

Cadastro deve ter aceite claro quando aplicável.

Exclusões devem pedir confirmação.

Dados pessoais devem ser protegidos.

---

## 29. E-mails

Resend é utilizado para e-mails transacionais.

Usos esperados:

- Verificação de e-mail.
- Recuperação de senha.
- Mensagens transacionais necessárias.

Preferencialmente usar remetente do domínio oficial:

```txt
no-reply@tennis.app.br
```

Não usar e-mail como canal de alerta se essa opção foi removida do produto.

---

## 30. Cloudinary

Cloudinary é utilizado para imagens, especialmente foto de perfil.

Cuidados:

- Não expor credenciais.
- Validar tipo/tamanho de arquivo.
- Tratar erro de upload.
- Manter URLs e transformações seguras.

---

## 31. Sentry

Sentry é usado para monitoramento de erros.

Cuidados:

- Não enviar dados sensíveis.
- Não logar tokens.
- Não logar secrets.
- Usar ambiente correto.

---

## 32. Railway

O Railway hospeda:

- Frontend.
- Backend.
- Worker/Beat.
- Redis.
- PostgreSQL.

Cuidados:

- Não misturar responsabilidades.
- Não depender de seed automático em deploy.
- Usar variáveis de ambiente.
- Usar URLs privadas para comunicação interna quando possível.
- Validar healthcheck.

---

## 33. Padrão de análise antes de corrigir bug

Para qualquer bug:

1. Reproduzir ou entender o erro.
2. Identificar tela/endpoint afetado.
3. Verificar logs.
4. Verificar request/response.
5. Verificar autenticação.
6. Verificar serializer.
7. Verificar permissões.
8. Verificar dados no banco.
9. Corrigir causa raiz.
10. Testar fluxo completo.

---

## 34. Padrão de implementação

Ao implementar:

- Fazer alterações pequenas e rastreáveis.
- Evitar refatorações grandes sem necessidade.
- Não quebrar contrato da API.
- Atualizar tipos/interfaces.
- Manter compatibilidade com mobile e web.
- Adicionar fallback para dados vazios.
- Tratar erros adequadamente.
- Evitar duplicação de lógica.
- Preservar padrão visual.

---

## 35. Padrão de relatório final

Ao finalizar uma tarefa, retornar:

```txt
Resumo:
- ...

Arquivos alterados:
- ...

Causa raiz:
- ...

Correção aplicada:
- ...

Testes executados:
- ...

Como validar manualmente:
- ...

Riscos:
- ...

Pendências:
- ...
```

---

## 36. Checklist rápido para IA

Antes de concluir, verificar:

```txt
[ ] O app mobile compila?
[ ] O backend compila?
[ ] A API correta está sendo usada?
[ ] Não há secrets no código?
[ ] Não há mocks indevidos?
[ ] Loading foi tratado?
[ ] Erro foi tratado?
[ ] Estado vazio foi tratado?
[ ] Permissões foram respeitadas?
[ ] O fluxo principal foi testado?
[ ] O visual não quebrou?
[ ] Pagamentos não atualizam plano antes da confirmação?
[ ] Mobile funciona em tela pequena?
[ ] Teclado não cobre inputs?
[ ] Admin não quebra sem dados?
```

---

## 37. Problemas recentes conhecidos

Lista de problemas que já foram identificados no projeto e devem ser considerados em futuras alterações:

- Alertas exibindo `entry_close_at` como texto técnico.
- Card sem sentido na parte inferior do app.
- Filtro por federação sem retornar torneios.
- Lixeira da agenda sobrepondo status do card.
- Preferência de alertas exibindo opção de e-mail indevida.
- Painel admin com erro ao carregar dashboard.
- Painel admin com erro ao carregar conectores.
- Gráficos em Stats muito próximos.
- Fluxo de troca de plano via PIX incorreto.
- Plano sendo atualizado sem pagamento confirmado.
- Falta de QR Code e Pix copia e cola na tela.
- Emoji de alarme na página inicial.
- Teclado cobrindo campos na inscrição.
- Lista de inscritos não retornando.
- Torneios compatíveis não funcionando corretamente.

---

## 38. Correções prioritárias atuais

Prioridade alta:

1. Segurança e secrets.
2. Pagamento PIX correto.
3. Não atualizar plano sem pagamento confirmado.
4. Filtros de torneios.
5. Torneios compatíveis.
6. Lista de inscritos.
7. Painel admin.
8. UX mobile de inscrição.
9. Agenda.
10. Alertas.

---

## 39. Princípio geral

O Tennis Hub deve ser desenvolvido como produto real.

Toda IA ou desenvolvedor deve atuar com cuidado, priorizando:

- Segurança.
- Estabilidade.
- Experiência do usuário.
- Consistência visual.
- Dados reais.
- Código limpo.
- Manutenção futura.
- Baixo custo operacional.
- Escalabilidade gradual.
