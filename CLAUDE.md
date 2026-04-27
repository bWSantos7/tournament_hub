# CLAUDE.md — Instruções obrigatórias para IA no projeto Tennis Hub

Este arquivo deve ser lido obrigatoriamente antes de qualquer alteração no projeto.

O objetivo deste documento é dar contexto técnico, regras de arquitetura, padrões de segurança e diretrizes de desenvolvimento para qualquer IA ou desenvolvedor que atue no código do Tennis Hub.

---

## 1. Visão geral do projeto

O Tennis Hub é uma plataforma/app para centralizar torneios de tênis no Brasil.

O projeto possui:

- Aplicativo mobile em React Native/Expo.
- Frontend web.
- Backend em Django/Django REST Framework.
- Banco PostgreSQL.
- Redis para filas/cache.
- Worker/Beat para tarefas assíncronas.
- Hospedagem no Railway.
- Cloudinary para imagens.
- Resend para e-mails transacionais.
- Sentry para monitoramento.
- Asaas para pagamentos de assinaturas.
- Domínio principal: `www.tennis.app.br`.
- API principal: `api.tennis.app.br`.

O projeto deve ser tratado como um produto real em fase de produção/MVP avançado.

---

## 2. Repositório

Repositório principal:

```txt
https://github.com/bWSantos7/tennis_hub.git
```

Sempre respeitar a estrutura atual do projeto. Não alterar arquitetura sem justificativa clara.

---

## 3. Arquitetura esperada

A arquitetura atual contempla os seguintes blocos:

```txt
Frontend Web
Mobile App React Native/Expo
Backend Django API
PostgreSQL
Redis
Celery Worker
Celery Beat
Cloudinary
Resend
Sentry
Asaas
Railway
```

O backend é a fonte da verdade para regras de negócio, autenticação, pagamentos, permissões e dados sensíveis.

O mobile e o frontend web devem consumir a API. Eles não devem conter regras críticas de segurança nem chaves privadas.

---

## 4. URLs e domínios corretos

Utilizar preferencialmente os domínios finais:

```txt
Frontend web:
https://www.tennis.app.br

Backend/API:
https://api.tennis.app.br
```

Evitar usar URLs antigas do Railway no código final, exceto quando necessário para debug ou healthcheck.

URLs Railway antigas não devem ser usadas como base definitiva no app mobile ou frontend web.

---

## 5. Variáveis de ambiente e segurança

Nunca commitar arquivos `.env`.

Nunca expor secrets no frontend web ou mobile.

Nunca colocar no código:

- SECRET_KEY
- DATABASE_URL
- REDIS_URL
- REDIS_PASSWORD
- POSTGRES_PASSWORD
- RESEND_API_KEY
- CLOUDINARY_URL
- ASAAS_API_KEY
- ASAAS_WEBHOOK_TOKEN
- VAPID_PRIVATE_KEY
- SENTRY_DSN
- qualquer outra chave sensível

Se alguma chave sensível aparecer no repositório, considerar comprometida e solicitar rotação imediata.

O projeto já teve chaves sensíveis compartilhadas durante o desenvolvimento. Portanto, sempre priorizar hardening e rotação de secrets quando necessário.

---

## 6. Regras críticas de produção

Em produção:

- Não usar SQLite.
- Não permitir fallback silencioso para SQLite.
- Não usar `ALLOWED_HOSTS=*`.
- Não deixar `DEBUG=True`.
- Não expor endpoints administrativos sem autenticação.
- Não expor stack trace para usuário final.
- Não usar mocks para esconder erro real.
- Não atualizar assinatura/plano sem confirmação real de pagamento.
- Não salvar dados sensíveis no AsyncStorage/SecureStore sem critério.
- Não expor chaves privadas no mobile.
- Não usar URLs antigas do Railway como padrão final.

---

## 7. Backend Django

O backend deve concentrar:

- Autenticação.
- Cadastro.
- Login.
- Recuperação de senha.
- Verificação de e-mail.
- Perfil esportista.
- Torneios.
- Inscrições.
- Lista de inscritos.
- Agenda.
- Alertas.
- Compatibilidade de torneios.
- Painel admin.
- Conectores.
- Pagamentos.
- Webhooks.
- Integrações externas.

Ao alterar backend:

1. Identificar causa raiz antes de modificar.
2. Verificar models, serializers, views, permissions, urls e services.
3. Garantir que permissões estejam corretas.
4. Validar respostas da API.
5. Tratar estados de erro e dados vazios.
6. Evitar mudanças quebrando compatibilidade com mobile/web.

---

## 8. Mobile React Native/Expo

O app mobile deve funcionar em Android e iOS via Expo.

Regras para o mobile:

- Usar a API correta: `https://api.tennis.app.br`.
- Não usar secrets no app.
- Não implementar regra crítica apenas no mobile.
- Tratar loading, erro e estado vazio.
- Garantir boa usabilidade em telas pequenas.
- Usar `KeyboardAvoidingView`, `ScrollView` e ajustes de teclado quando houver inputs.
- Evitar que o teclado cubra campos.
- Manter identidade visual limpa, moderna e próxima do web.
- Não usar emojis desnecessários em telas profissionais.
- Não deixar textos técnicos aparecendo ao usuário, como nomes de campos do banco/API.
- Não deixar componentes sem sentido, vazios ou quebrados na interface.
- Testar fluxo completo após alterações.

---

## 9. Frontend web

O frontend web deve manter consistência visual com o produto.

Regras:

- Consumir API correta.
- Não expor secrets.
- Ter estados de loading, erro e vazio.
- Não usar dados mockados em produção.
- Preservar UX limpa e responsiva.
- Garantir compatibilidade com o domínio `www.tennis.app.br`.

---

## 10. Pagamentos e assinaturas

O Tennis Hub utiliza Asaas para pagamentos de planos.

Planos previstos:

- Gratuito/Base
- Pro
- Elite

Regras críticas:

- Toda integração com Asaas deve ficar no backend.
- O mobile/frontend nunca deve conter `ASAAS_API_KEY`.
- O usuário nunca deve ter o plano alterado apenas por clicar em “OK”.
- O plano só pode ser atualizado após confirmação real do pagamento.
- Confirmação deve ocorrer por webhook do Asaas ou consulta segura ao status da cobrança no backend.
- Para PIX, o backend deve gerar a cobrança e retornar ao app:
  - QR Code;
  - código Pix copia e cola;
  - status da cobrança;
  - identificador da cobrança.
- O app deve exibir:
  - QR Code;
  - Pix copia e cola;
  - botão de copiar código;
  - status “aguardando pagamento”;
  - status “pagamento confirmado”;
  - status de erro/expiração quando aplicável.
- Em ambiente sandbox, manter comportamento igual ao fluxo real.

Nunca atualizar plano antes do pagamento confirmado.

---

## 11. Alertas e notificações

O app pode ter alertas/notificações relacionados a torneios, inscrições, agenda e prazos.

Regras:

- Não exibir nomes técnicos de campos ao usuário.
- Exemplo ruim: `entry_close_at`.
- Exemplo correto: `As inscrições encerram em 30/04/2026 às 18:00`.
- Preferências de alertas devem refletir apenas canais suportados.
- Se o mobile não deve oferecer e-mail como canal de alerta, remover essa opção da interface e da lógica.
- Push/in-app devem ser priorizados quando aplicável.

---

## 12. Torneios

Funcionalidades importantes:

- Listagem de torneios.
- Filtros por federação.
- Filtros por cidade/localização.
- Filtros por categoria.
- Filtros por nível.
- Filtros por distância.
- Datas de inscrição.
- Status do torneio.
- Inscrição no torneio.
- Agenda do usuário.
- Lista de inscritos.
- Torneios compatíveis com o perfil do usuário.

Regras:

- Filtros devem ser validados no backend e no frontend/mobile.
- Se um filtro não retorna dados, investigar payload, query params, serializer, endpoint e banco.
- Não usar mock para simular torneios.
- Torneios compatíveis devem considerar dados reais do perfil esportista.
- Caso não existam torneios compatíveis, exibir mensagem amigável.

---

## 13. Torneios compatíveis

A funcionalidade “Torneios compatíveis com você” deve considerar, conforme disponibilidade no modelo atual:

- Cidade/localização.
- Distância preferida.
- Nível do jogador.
- Categoria.
- Idade.
- Gênero.
- Perfil esportista.
- Preferências configuradas pelo usuário.

Caso faltem dados no perfil, o app deve orientar o usuário a completar ou atualizar o perfil.

Não retornar lista vazia sem explicação.

---

## 14. Inscrições e lista de inscritos

A inscrição em torneios deve ter fluxo claro.

A lista de inscritos deve retornar, quando permitido:

- Quantidade total de inscritos.
- Nome ou identificação permitida do inscrito.
- Categoria.
- Status da inscrição.
- Status do pagamento.
- Posição ou informações relevantes, se existirem no modelo.

Respeitar privacidade e permissões.

Usuário comum não deve acessar informações sensíveis indevidas.

Admin pode ter visão ampliada conforme regra do sistema.

---

## 15. Agenda

A agenda deve mostrar torneios adicionados pelo usuário.

Regras de UI:

- Cards devem ser claros.
- Status não deve ser sobreposto por botões.
- Botão de lixeira/remover deve ficar preferencialmente no canto inferior direito do card.
- Toda exclusão deve pedir confirmação.
- Estado vazio deve ser amigável.
- Após adicionar torneio à agenda, o app deve refletir a alteração corretamente.

---

## 16. Painel administrativo

O painel admin deve permitir gestão e visão operacional do sistema.

Áreas importantes:

- Dashboard.
- Estatísticas.
- Conectores.
- Torneios.
- Usuários.
- Inscrições.
- Pagamentos.
- Logs/monitoramento, quando disponível.

Regras:

- Dashboard não deve quebrar se não houver dados.
- Conectores não devem quebrar se não estiverem configurados.
- Endpoints administrativos devem exigir autenticação/permissão.
- Erros devem ser tratados com mensagens claras.
- Evitar tela branca ou crash.

---

## 17. Stats e gráficos

Em telas de estatísticas:

- Gráficos devem ter espaçamento adequado.
- Não devem ficar colados.
- Devem ser legíveis em telas pequenas.
- Deve haver loading, erro e estado vazio.
- Evitar sobrecarga visual.

---

## 18. UX e padrão visual

O visual deve ser:

- Moderno.
- Limpo.
- Esportivo.
- Profissional.
- Coerente com Tennis Hub.
- Responsivo.
- Leve.
- Sem excesso de emojis.
- Sem textos técnicos visíveis ao usuário.

Sempre priorizar clareza, fluidez e experiência mobile.

---

## 19. LGPD e privacidade

O sistema deve respeitar LGPD.

Cadastro deve conter aceite de termos/LGPD quando aplicável.

Link oficial da LGPD:

```txt
https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
```

Regras:

- Não coletar dados desnecessários.
- Não expor dados pessoais indevidamente.
- Não mostrar lista de inscritos com informações sensíveis sem permissão.
- Garantir clareza no aceite de termos.
- Exclusões devem pedir confirmação.

---

## 20. E-mails

O projeto utiliza Resend para e-mails transacionais.

Usos esperados:

- Verificação de e-mail.
- Recuperação de senha.
- Eventuais comunicações transacionais necessárias.

Regras:

- Usar domínio validado.
- Preferir remetente do domínio oficial.
- Não usar `onboarding@resend.dev` em produção.
- Não usar e-mail como canal de alerta mobile se essa opção foi removida do produto.
- Não expor chave do Resend no frontend/mobile.

---

## 21. Cloudinary

Cloudinary é usado para imagens, como foto de perfil.

Regras:

- Upload deve ser feito de forma segura.
- Não expor credenciais sensíveis no mobile/frontend.
- Validar tamanho e tipo de arquivo quando aplicável.
- Tratar erro de upload.

---

## 22. Sentry

Sentry é usado para monitoramento.

Regras:

- Não registrar dados sensíveis em logs.
- Não enviar secrets para Sentry.
- Usar environment adequado.
- Erros críticos devem ser rastreáveis.

---

## 23. Railway

Infra atual no Railway:

- Frontend.
- Backend.
- Worker/Beat.
- Redis.
- PostgreSQL.

Regras:

- Backend, worker e beat devem ser serviços separados.
- Redis e Postgres devem ser acessados por URL privada interna quando possível.
- Evitar depender de URLs públicas para comunicação interna.
- Não rodar seed automático em todo deploy.
- Migrações devem ser controladas.
- Healthchecks devem estar funcionais.

---

## 24. Custos atuais conhecidos

Custos aproximados atuais:

- Domínio: R$40 anual.
- Claude Pro: cerca de R$118,87 mensal.
- Railway Pro: cerca de R$108,23 mensal.
- Resend: plano Free.
- Cloudinary: plano Free.
- Sentry: plano Free.

Custo mensal aproximado informado: R$267,10.

Ao sugerir mudanças de infraestrutura, considerar custo-benefício.

---

## 25. Proibições para IA

A IA não deve:

- Expor secrets.
- Criar ou commitar `.env`.
- Alterar plano do usuário sem pagamento confirmado.
- Usar mocks para mascarar erro.
- Remover funcionalidades sem justificativa.
- Trocar arquitetura sem aprovação.
- Usar SQLite em produção.
- Usar `ALLOWED_HOSTS=*`.
- Deixar `DEBUG=True`.
- Ignorar autenticação/permissões.
- Colocar lógica sensível no mobile.
- Usar URL Railway antiga como API principal.
- Ignorar testes.
- Criar endpoints sem permissão.
- Exibir campos técnicos ao usuário.
- Deixar telas sem tratamento de loading/erro/vazio.
- Fazer alterações grandes sem explicar impacto.

---

## 26. Processo obrigatório antes de alterar código

Antes de qualquer alteração:

1. Ler este arquivo.
2. Entender a arquitetura atual.
3. Identificar a causa raiz do problema.
4. Localizar arquivos envolvidos.
5. Verificar impacto em backend, web e mobile.
6. Evitar alterações desnecessárias.
7. Planejar solução segura.

---

## 27. Processo obrigatório após alterar código

Após qualquer alteração:

1. Rodar testes disponíveis.
2. Rodar lint/typecheck, se existirem.
3. Verificar build do mobile.
4. Verificar build do backend.
5. Testar fluxo manualmente.
6. Conferir se não há secrets no código.
7. Conferir se URLs estão corretas.
8. Conferir se não houve quebra visual.
9. Conferir permissões/autenticação.
10. Documentar o que foi alterado.

---

## 28. Checklist de validação

Sempre que mexer no projeto, validar:

- Login.
- Cadastro.
- Verificação de e-mail.
- Recuperação de senha.
- Perfil esportista.
- Listagem de torneios.
- Filtros.
- Torneios compatíveis.
- Inscrição em torneio.
- Lista de inscritos.
- Agenda.
- Alertas.
- Preferências de alertas.
- Pagamentos.
- Troca de plano.
- PIX.
- Painel admin.
- Dashboard admin.
- Conectores admin.
- Stats.
- Upload de imagem.
- Responsividade mobile.
- Permissões.
- Logs de erro.

---

## 29. Formato esperado de resposta da IA

Ao finalizar uma tarefa, a IA deve retornar:

```txt
Resumo da correção:
- ...

Arquivos alterados:
- ...

Causa raiz:
- ...

Solução aplicada:
- ...

Como testar:
- ...

Riscos ou pendências:
- ...

Comandos executados:
- ...

Validação final:
- ...
```

Não considerar uma tarefa concluída apenas porque o app compilou.

A tarefa só está concluída quando a funcionalidade foi testada e validada.

---

## 30. Prioridade máxima atual

Prioridades gerais do Tennis Hub:

1. Segurança.
2. Fluxo de pagamento correto.
3. Estabilidade da API.
4. Mobile funcional Android/iOS.
5. UX limpa e profissional.
6. Dados reais, sem mocks.
7. Painel admin estável.
8. Torneios, filtros e compatibilidade funcionando.
9. Escalabilidade gradual.
10. Redução de custos sem comprometer produção.

---

## 31. Observação final

Este projeto deve ser tratado como produto real.

Toda alteração deve ser feita com cuidado, pensando em produção, segurança, usuário final, escalabilidade e manutenção futura.
