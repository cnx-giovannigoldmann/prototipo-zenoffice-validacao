
// ============= STATE =============
const state = {
  pessoal: {done:false},
  profissional: {done:false},
  planoSessao: {done:false},
  online: {done:false},
  presencial: {done:false},
  faturamento: 'pj',
  // approvedValue/lastOfficialValue/officialValue/pendingValue/pendingOfficial: ver banner de
  // transição (renderCnpjTransitionBanner) — mostram o CNPJ antigo (ainda oficial pra pagamento)
  // e o novo (validado, mas só oficial a partir do dia 25) lado a lado, de forma persistente.
  cnpj: {approved:false, attempts:0, locked:false, lockSeconds:0, lockTimer:null, everApproved:false, approvedValue:'', lastOfficialValue:'', officialValue:'', pendingValue:'', pendingOfficial:false},
  bank: {approved:false, attempts:0, locked:false, lockSeconds:0, lockTimer:null, everApproved:false, pendingCnpjChange:false, pendingOfficial:false, officialSummary:'', pendingSummary:''},
  // Janela de edição Zenklub (dias 24 a 10) — ver seção 5 do documento.
  window: {blocked:false},
  // Modal de revalidação obrigatória para profissionais legados (1º login pós go-live), ver seção 8, área Produto.
  // "active" liga o modal em steps (CNPJ -> Dados bancários -> Email). Os 3 itens exigem confirmação
  // explícita mesmo que já estivessem aprovados antes: clicando "Está correto" no modal, ou revalidando
  // de verdade lá no Financeiro/Pessoal (o que também marca cnpjConfirmed/bankConfirmed/emailConfirmed).
  revalidacao: {active:false, emailConfirmed:false, cnpjConfirmed:false, bankConfirmed:false, step:1},
  // Aviso não bloqueante mostrado pra TODOS os profissionais na semana anterior à virada obrigatória
  // (decisão da reunião com stakeholders: em vez de travar todo mundo sem aviso no dia da virada, a
  // gente comunica antes — banner na Agenda — pra ninguém ser pego de surpresa). Ver seção 12 do documento.
  avisoRevalidacao: {active:false, dismissed:false},
  scenario: null
};
// Datas do plano de comunicação da virada obrigatória:
// - AVISO_DATE: data em que o banner abaixo passa a ser exibido pra todos os profissionais (uma
//   semana antes do bloqueio). No protótipo o banner é ligado manualmente pelo painel de teste; em
//   produção essa exibição seria automática a partir dessa data.
// - LOCK_DATE: data da virada, quando passa a ser obrigatório revalidar CNPJ/dados bancários/e-mail
//   pra continuar recebendo pagamento (representado no protótipo pelo Cenário 2, modal obrigatória).
const AVISO_DATE = '12/10/2026';
const LOCK_DATE = '19/10/2026';
let currentAccountTab = 'pessoal';

function el(id){return document.getElementById(id);}

function financeiroCompleto(){
  return state.cnpj.approved && state.bank.approved;
}

// ============= NAV =============
// Cada validação (CNPJ e dados bancários) já é salva automaticamente ao ser aprovada,
// então não existe mais um estado de "validado mas não salvo" — sair da tela nunca perde dado.
// Edição de CNPJ ou dados bancários que foi feita mas ainda não foi validada de novo
// (o profissional editou um dado já aprovado antes e não clicou em validar).
function hasUnsavedFinanceiroEdits(){
  return (state.cnpj.everApproved && !state.cnpj.approved) || (state.bank.everApproved && !state.bank.approved);
}
function confirmLeaveFinanceiro(){
  if(currentAccountTab==='financeiro' && hasUnsavedFinanceiroEdits()){
    // Decisão de 25/09 (Giovanni): mensagem por domínio (só CNPJ/só banco) parecia mais precisa, mas
    // gerava falso positivo — trocar o CNPJ invalida o dado bancário automaticamente (ver
    // confirmCnpjBankInvalidateModal), então "editou os dados bancários" aparecia mesmo sem o
    // profissional ter tocado nesse campo. Mensagem genérica evita apontar o campo errado.
    return confirm('Você ainda não finalizou a edição dos seus dados financeiros. Se sair agora, a edição não é salva e os dados anteriores continuam valendo. Sair mesmo assim?');
  }
  return true;
}

function goto(view){
  if(view!=='account' && !confirmLeaveFinanceiro()) return;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  el('view-'+view).classList.add('active');
  el('navAgenda').classList.toggle('active', view==='agenda');
  el('topbar').style.display = (view==='login') ? 'none' : 'flex';
  if(view==='agenda'){
    renderAgendaBanners();
    maybeShowRevalModal();
  } else {
    el('reval-modal').classList.remove('open');
  }
  if(view==='assinatura') renderAssinatura();
}
// Mostra no modal o dado bancário de verdade (PIX ou banco/agência/conta), pra dar pro
// profissional o que ele precisa pra decidir se confirma ou edita, sem adivinhar.
function bankSummaryHTML(){
  const noPix = el('no-pix-check').checked;
  if(noPix){
    const banco = el('b_banco').value || '(sem banco informado)';
    const ag = el('b_ag').value || '(sem agência)';
    const conta = el('b_conta').value || '(sem conta)';
    const dig = el('b_dig').value;
    return 'Banco: '+banco+'<br>Agência: '+ag+' · Conta: '+conta+(dig?('-'+dig):'');
  }
  const tipo = el('b_tipo_chave').value || '(sem tipo de chave)';
  const chave = el('b_pix').value || '(sem chave cadastrada)';
  return 'Tipo de chave: '+tipo+'<br>Chave PIX: '+chave;
}

// ============= MODAL DE REVALIDAÇÃO OBRIGATÓRIA (profissionais legados) =============
// Ordem fixa: CNPJ -> Dados bancários -> Email. O passo visível é sempre recalculado pro primeiro
// item ainda pendente sempre que a Agenda é (re)carregada, então o profissional sempre volta pro
// lugar certo mesmo depois de ser deslogado no meio do fluxo (troca de e-mail).
function revalGateDone(){
  return state.revalidacao.cnpjConfirmed && state.revalidacao.bankConfirmed && state.revalidacao.emailConfirmed;
}
function firstPendingRevalStep(){
  if(!state.revalidacao.cnpjConfirmed) return 1;
  if(!state.revalidacao.bankConfirmed) return 2;
  return 3;
}
function maybeShowRevalModal(){
  if(state.revalidacao.active && !revalGateDone()){
    state.revalidacao.step = firstPendingRevalStep();
    renderRevalModal();
    el('reval-modal').classList.add('open');
  } else {
    if(state.revalidacao.active) state.revalidacao.active = false;
    el('reval-modal').classList.remove('open');
  }
}
function renderRevalModal(){
  const step = state.revalidacao.step;
  el('reval-modal-stepnum').textContent = 'Passo '+step+' de 3';
  el('reval-modal-title').textContent = step===1 ? 'Confirme seu CNPJ' : step===2 ? 'Confirme seus dados bancários' : 'Confirme seu e-mail';
  el('reval-step-cnpj').style.display = step===1 ? 'block':'none';
  el('reval-step-bank').style.display = step===2 ? 'block':'none';
  el('reval-step-email').style.display = step===3 ? 'block':'none';

  // Em vez de sumir os botões quando o item é confirmado (o que dava a impressão de "sumiço" ao
  // clicar em Avançar), o botão "Está correto" continua visível, só muda de estado pra deixar claro
  // que foi selecionado, e o "Editar" continua disponível caso o profissional queira mudar de ideia.
  el('reval-cnpj-value').textContent = el('f_cnpj').value || '(sem CNPJ)';
  el('reval-cnpj-status').innerHTML = state.revalidacao.cnpjConfirmed
    ? '<span style="color:var(--green);font-weight:600;font-size:13.5px;">✓ Confirmado</span>'
    : '<span style="color:#92400E;font-weight:600;font-size:13.5px;">Pendente</span>';
  setConfirmBtnState('reval-cnpj-confirm-btn', state.revalidacao.cnpjConfirmed);

  el('reval-bank-value').innerHTML = bankSummaryHTML();
  el('reval-bank-status').innerHTML = state.revalidacao.bankConfirmed
    ? '<span style="color:var(--green);font-weight:600;font-size:13.5px;">✓ Confirmado</span>'
    : '<span style="color:#92400E;font-weight:600;font-size:13.5px;">Pendente</span>';
  setConfirmBtnState('reval-bank-confirm-btn', state.revalidacao.bankConfirmed);

  el('reval-email-value').textContent = el('p_email').value || '(sem e-mail cadastrado)';
  el('reval-email-status').innerHTML = state.revalidacao.emailConfirmed
    ? '<span style="color:var(--green);font-weight:600;font-size:13.5px;">✓ Confirmado</span>'
    : '<span style="color:#92400E;font-weight:600;font-size:13.5px;">Pendente</span>';
  setConfirmBtnState('reval-email-confirm-btn', state.revalidacao.emailConfirmed);

  // Passo 1 não tem pra onde voltar, então o botão nem aparece. Do passo 2 em diante, faz sentido.
  el('reval-modal-back').style.display = (step===1) ? 'none' : 'inline-block';
  el('reval-modal-actions').style.justifyContent = (step===1) ? 'flex-end' : 'space-between';

  // Só avança depois de resolver o item do passo atual (confirmar ou editar e validar de verdade).
  const stepDone = step===1 ? state.revalidacao.cnpjConfirmed : step===2 ? state.revalidacao.bankConfirmed : state.revalidacao.emailConfirmed;
  const nextBtn = el('reval-modal-next');
  nextBtn.textContent = step<3 ? 'Avançar' : 'Concluir';
  nextBtn.disabled = !stepDone;
}
// Deixa claro que "Está correto" foi selecionado (vira um estado "confirmado", em vez de sumir)
// e mantém o "Editar" sempre clicável, caso o profissional queira voltar atrás.
function setConfirmBtnState(btnId, confirmed){
  const btn = el(btnId);
  if(confirmed){
    btn.textContent = '✓ Selecionado';
    btn.disabled = true;
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-confirmed');
  } else {
    btn.textContent = 'Está correto';
    btn.disabled = false;
    btn.classList.remove('btn-confirmed');
    btn.classList.add('btn-primary');
  }
}
function revalModalBack(){
  if(state.revalidacao.step>1){ state.revalidacao.step--; renderRevalModal(); }
}
function revalModalNext(){
  if(state.revalidacao.step<3){
    state.revalidacao.step++;
    renderRevalModal();
  } else if(revalGateDone()){
    state.revalidacao.active = false;
    el('reval-modal').classList.remove('open');
    renderAgendaBanners();
  }
}
function confirmRevalCnpj(){ state.revalidacao.cnpjConfirmed = true; renderRevalModal(); }
function confirmRevalBank(){ state.revalidacao.bankConfirmed = true; renderRevalModal(); }
function confirmRevalEmail(){ state.revalidacao.emailConfirmed = true; renderRevalModal(); }
function goEditEmailFromRevalModal(){
  goto('account'); switchTab('pessoal');
  setTimeout(()=>{ const f = el('p_email'); if(f) f.scrollIntoView({behavior:'smooth', block:'center'}); }, 60);
}

// ============= ASSINATURA =============
function onboardingCompleto(){
  return state.pessoal.done && state.profissional.done && state.planoSessao.done && state.online.done && financeiroCompleto();
}
function renderAssinatura(){
  const done = onboardingCompleto();
  el('assinatura-blocked-msg').style.display = done ? 'none' : 'block';
  const btn = el('btn-assinar-premium');
  btn.disabled = !done;
  el('assinar-premium-wrap').title = done ? '' : 'Você ainda não pode assinar: finalize o preenchimento do seu cadastro (incluindo a validação de CNPJ e dados bancários) pra liberar a assinatura. Vá para a sessão "Pessoal" pra continuar.';
}
function selectPeriodo(p){
  el('price-mensal').classList.toggle('selected', p==='mensal');
  el('price-anual').classList.toggle('selected', p==='anual');
}
function assinarPremium(){
  alert('Fluxo de pagamento da assinatura: fora do escopo deste protótipo.');
}
// Botão que já existe em produção na tela Financeiro. Ele abre a troca do cartão de crédito da
// assinatura Premium (Stripe), que não tem relação com o CNPJ/PIX/dados bancários de recebimento
// validados neste protótipo — por isso está aqui só pra manter a tela fiel, sem fluxo por trás.
function abrirFormasPagamento(){
  alert('Formas de pagamento (cartão da assinatura Premium via Stripe): fora do escopo deste protótipo.');
}

function toggleAvatarMenu(){ el('avatarMenu').classList.toggle('open'); }
function closeAvatarMenu(){ el('avatarMenu').classList.remove('open'); }
document.addEventListener('click', function(e){
  if(!e.target.closest('.avatar-wrap')) closeAvatarMenu();
});

function switchTab(tab){
  if(tab!=='financeiro' && !confirmLeaveFinanceiro()) return;
  currentAccountTab = tab;
  ['pessoal','profissional','planosessao','online','presencial','financeiro'].forEach(t=>{
    el('panel-'+t).style.display = (t===tab)?'block':'none';
    el('side-'+t).classList.toggle('active', t===tab);
  });
  if(tab==='financeiro') renderFinanceiroLock();
  // Ao trocar de sessão (seja pelo auto-avanço do "Salvar" ou clicando direto no menu lateral),
  // a página tem que voltar pro topo. Sem isso, quem salvou lá embaixo numa sessão longa cai no
  // meio ou no fim da próxima sessão, achando que o conteúdo do topo sumiu.
  window.scrollTo(0, 0);
}

// ============= MASKS =============
function maskCPF(input){
  let v = input.value.replace(/\D/g,'').slice(0,11);
  v = v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  input.value = v;
}
function maskCNPJ(input){
  let v = input.value.replace(/\D/g,'').slice(0,14);
  v = v.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2');
  input.value = v;
}
function maskDate(input){
  let v = input.value.replace(/\D/g,'').slice(0,8);
  v = v.replace(/(\d{2})(\d)/,'$1/$2').replace(/(\d{2})(\d{1,4})$/,'$1/$2');
  input.value = v;
}
function maskPhone(input){
  let v = input.value.replace(/\D/g,'').slice(0,11);
  v = v.replace(/^(\d{2})(\d)/,'($1) $2');
  v = v.replace(/(\d{5})(\d{1,4})$/,'$1-$2');
  input.value = v;
}
function maskCurrency(input){
  let v = input.value.replace(/\D/g,'');
  if(!v){ input.value = ''; return; }
  v = (parseInt(v,10)/100).toFixed(2);
  let [intPart, centPart] = v.split('.');
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  input.value = 'R$ ' + intPart + ',' + centPart;
}

// ============= PESSOAL =============
function checkPessoal(){}
function savePessoal(){
  const nome=el('p_nome').value.trim(), cpf=el('p_cpf').value.trim(), cel=el('p_cel').value.trim(), nasc=el('p_nasc').value.trim();
  if(!nome||!cpf||!cel||!nasc){ alert('Preencha todos os campos de dados pessoais.'); return; }
  state.pessoal.done = true;
  el('f_cpf_pj').value = cpf;
  renderDots();
  renderFinanceiroLock();
  switchTab('profissional');
}

// ============= PREENCHIMENTO VINDO DO FORMULÁRIO DO SITE (Cenário 1) =============
// Quando o profissional chega até aqui, é porque ele já veio de algum lugar, normalmente
// do formulário de cadastro do site. Esses campos já vêm preenchidos com o que foi
// informado lá, marcados com um asterisco colorido pra deixar isso claro.
function prefillNovoProfissionalSite(){
  el('p_nome').value = 'Giovanni Goldmann';
  el('p_email').value = 'giovanni.goldmann@gmail.com';
  el('p_cel').value = '(11) 91234-5678';
  el('p_genero').value = 'Homem cis';
  el('p_cpf').value = '111.222.333-44';
  ['nome','email','senha','cel','genero','cpf'].forEach(k=>{
    const b = el('site-badge-'+k);
    if(b) b.style.display = 'inline';
  });
  el('pessoal-site-hint').style.display = 'block';
}
function hideSitePrefillBadges(){
  ['nome','email','senha','cel','genero','cpf'].forEach(k=>{
    const b = el('site-badge-'+k);
    if(b) b.style.display = 'none';
  });
  if(el('pessoal-site-hint')) el('pessoal-site-hint').style.display = 'none';
}

// ============= ALTERAR E-MAIL (modal na sessão Pessoal) =============
function openChangeEmailConfirmModal(){
  el('change-email-confirm-modal').classList.add('open');
}
function closeChangeEmailConfirmModal(){
  el('change-email-confirm-modal').classList.remove('open');
}
function confirmChangeEmailConfirmModal(){
  closeChangeEmailConfirmModal();
  openChangeEmailModal();
}
function openChangeEmailModal(){
  el('ce-current').value = el('p_email').value || '(sem e-mail cadastrado ainda)';
  el('ce-new').value = '';
  el('ce-new-confirm').value = '';
  clearChangeEmailError();
  el('change-email-form').style.display = 'block';
  el('change-email-modal').classList.add('open');
}
function closeChangeEmailModal(){
  el('change-email-modal').classList.remove('open');
}
function clearChangeEmailError(){
  el('ce-new').classList.remove('input-error');
  el('ce-new-confirm').classList.remove('input-error');
  el('ce-error').style.display = 'none';
}
function setChangeEmailError(msg){
  el('ce-new').classList.add('input-error');
  el('ce-new-confirm').classList.add('input-error');
  el('ce-error').textContent = msg;
  el('ce-error').style.display = 'block';
}
function saveChangeEmail(){
  const novo = el('ce-new').value.trim();
  const confirmacao = el('ce-new-confirm').value.trim();
  if(!novo || !novo.includes('@')){ setChangeEmailError('Informe um e-mail válido.'); return; }
  if(novo !== confirmacao){ setChangeEmailError('Os e-mails não são iguais. Confira e tente novamente.'); return; }
  clearChangeEmailError();
  el('p_email').value = novo;
  state.revalidacao.emailConfirmed = true;
  // Ao salvar, já desconecta direto pro login com o novo e-mail — sem tela intermediária, já que o
  // aviso de que isso ia acontecer foi mostrado antes, no modal de confirmação (openChangeEmailConfirmModal).
  closeChangeEmailModal();
  el('login-email').value = novo;
  goto('login');
}
function doLogin(){
  goto('agenda');
}

// ============= PROFISSIONAL =============
function checkProfissional(){}
function saveProfissional(){
  if(!el('pr_tipo').value || !el('pr_crp').value){ alert('Selecione o tipo profissional e informe o CRP/registro.'); return; }
  state.profissional.done = true;
  renderDots(); renderFinanceiroLock();
  switchTab('planosessao');
}

// ============= PLANO E SESSÃO =============
function checkPlanoSessao(){}
function savePlanoSessao(){
  state.planoSessao.done = true;
  renderDots(); renderFinanceiroLock();
  switchTab('online');
}

let formacaoCount = 0;
function addFormacao(){
  formacaoCount++;
  const id = 'formacao-'+formacaoCount;
  const div = document.createElement('div');
  div.className = 'pixbox';
  div.id = id;
  div.innerHTML = '<div class="row2">'
    + '<div class="field"><label>Instituição</label><input placeholder="Nome da instituição"></div>'
    + '<div class="field"><label>Curso</label><input placeholder="Nome do curso"></div>'
    + '</div>'
    + '<div class="row2">'
    + '<div class="field"><label>Ano de conclusão</label><input placeholder="AAAA"></div>'
    + '<div style="align-self:flex-end;"><span class="linklike" onclick="document.getElementById(\''+id+'\').remove()">Remover formação</span></div>'
    + '</div>';
  el('formacaoList').appendChild(div);
}

// ============= SESSÕES =============
function checkOnline(){}
function saveOnline(){
  if(!el('on_valor').value){ alert('Informe o valor da sessão.'); return; }
  state.online.done = true; renderDots(); renderFinanceiroLock();
  switchTab('financeiro');
}

let enderecoCount = 0;
function addEndereco(){
  if(enderecoCount >= 3){ alert('Limite de 3 endereços de atendimento.'); return; }
  enderecoCount++;
  const id = 'endereco-'+enderecoCount;
  const div = document.createElement('div');
  div.className = 'pixbox';
  div.id = id;
  div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'
    + '<b style="font-size:13px;">Endereço '+enderecoCount+'</b>'
    + '<span class="linklike" onclick="document.getElementById(\''+id+'\').remove(); enderecoCount--; renderAddEnderecoBtn(); checkPresencial();">Remover</span>'
    + '</div>'
    + '<div class="field"><label>Nome do local</label><input class="pres_nome" placeholder="Ex: Consultório Centro SP" oninput="checkPresencial()"></div>'
    + '<div class="field"><label>Endereço</label><input class="pres_end" placeholder="Rua, número, bairro, cidade/UF, CEP" oninput="checkPresencial()"></div>'
    + '<div class="row2">'
    + '<div class="field"><label>Telefone</label><input class="pres_tel" placeholder="(00) 00000-0000"></div>'
    + '<div class="field"><label>Valor da sessão particular</label><input class="pres_valor" placeholder="R$ 0,00" oninput="checkPresencial()"></div>'
    + '</div>'
    + '<div class="field"><label style="font-weight:600;">Aceitar sessão corporativa neste endereço</label>'
    + '<label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-bottom:4px;"><input type="checkbox" style="width:auto;"> R$ 100,00 | corporativo</label>'
    + '</div>';
  el('enderecosList').appendChild(div);
  renderAddEnderecoBtn();
}
function renderAddEnderecoBtn(){
  el('btn-add-endereco').style.display = enderecoCount >= 3 ? 'none' : 'inline-block';
}
function checkPresencial(){}
function savePresencial(){
  const nomes = document.querySelectorAll('.pres_nome');
  const ends = document.querySelectorAll('.pres_end');
  const valores = document.querySelectorAll('.pres_valor');
  if(nomes.length===0){ alert('Adicione pelo menos um endereço de atendimento.'); return; }
  for(let i=0;i<nomes.length;i++){
    if(!nomes[i].value || !ends[i].value || !valores[i].value){ alert('Preencha nome, endereço e valor de cada endereço adicionado.'); return; }
  }
  state.presencial.done = true; renderDots(); renderFinanceiroLock();
  alert('Sessão presencial salva.');
}

// ============= DOTS =============
function renderDots(){
  el('dot-pessoal').style.display = state.pessoal.done ? 'none':'inline-block';
  el('dot-profissional').style.display = state.profissional.done ? 'none':'inline-block';
  el('dot-planosessao').style.display = state.planoSessao.done ? 'none':'inline-block';
  el('dot-online').style.display = state.online.done ? 'none':'inline-block';
  const completo = financeiroCompleto();
  el('dot-financeiro').style.display = completo ? 'none':'inline-block';
  const m = el('financeiro-complete-msg');
  if(m) m.style.display = completo ? 'block' : 'none';
}

function financeiroUnlocked(){
  // Sessão presencial não é obrigatória hoje no Zenklub, não entra no gating.
  return state.pessoal.done && state.profissional.done && state.planoSessao.done && state.online.done;
}

function renderFinanceiroLock(){
  const unlocked = financeiroUnlocked();
  el('fin-locked-note').style.display = unlocked ? 'none':'block';
  el('fin-content').classList.toggle('disabled-block', !unlocked);
  el('f_cnpj').disabled = !unlocked || state.cnpj.locked || state.window.blocked;
  el('cnpj-edit-area').classList.toggle('disabled-block', state.window.blocked);
  renderCnpjButtonState();
  renderBankButtonState();
  applyWindowLockToBank();
  renderWindowPanelVisibility();
}

// O painel de teste da janela de edição só faz sentido depois que o cadastro financeiro
// (CNPJ + dados bancários) já foi validado ao menos uma vez — antes disso o profissional
// pode preencher e validar a qualquer momento, sem restrição de data.
function renderWindowPanelVisibility(){
  const completo = financeiroCompleto();
  el('window-test-panel').style.display = completo ? 'block' : 'none';
  if(!completo && state.window.blocked){
    state.window.blocked = false;
    el('window-lock-check').checked = false;
    el('window-locked-msg').style.display = 'none';
  }
}

// Janela de edição Zenklub (24 a 10): enquanto ativa, bloqueia edição de CNPJ e dados bancários.
function toggleWindowLock(){
  state.window.blocked = el('window-lock-check').checked;
  el('window-locked-msg').style.display = state.window.blocked ? 'block':'none';
  renderFinanceiroLock();
}

// Painel de teste: simula a passagem do dia 25 (CNPJ) / dia 11 do mês seguinte (dado bancário), já
// que o protótipo não roda com data real. Limpa os 2 banners de transição de uma vez.
function toggleCycleTurnover(){
  const done = el('cycle-turnover-check').checked;
  if(done){
    state.cnpj.pendingOfficial = false;
    state.bank.pendingOfficial = false;
  }
  renderCnpjTransitionBanner();
  renderBankTransitionBanner();
}

// Banner PERSISTENTE só sobre CNPJ (nunca menciona dado bancário) — decisão de 24/09: mensagem de
// sucesso verde não é lida, então o antigo x novo + a data ficam aqui, visíveis até a virada de ciclo.
function renderCnpjTransitionBanner(){
  const box = el('cnpj-transition-banner');
  if(!state.cnpj.pendingOfficial){ box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'block';
  box.innerHTML = '<b style="display:block;margin-bottom:6px;">⚠️ CNPJ em transição</b>'
    + 'CNPJ ativo para pagamento agora: <b>'+(state.cnpj.officialValue || '—')+'</b><br>'
    + 'Novo CNPJ validado: <b>'+(state.cnpj.pendingValue || '—')+'</b> — só passa a valer para pagamento a partir do <b>dia 25 deste mês</b>. Mantenha o CNPJ antigo ativo até essa data.';
}

// Banner PERSISTENTE só sobre dado bancário (nunca menciona CNPJ) — mesma decisão de 24/09.
function renderBankTransitionBanner(){
  const box = el('bank-transition-banner');
  if(!state.bank.pendingOfficial){ box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'block';
  box.innerHTML = '<b style="display:block;margin-bottom:6px;">⚠️ Dados bancários em transição</b>'
    + 'Dados bancários ativos para pagamento agora: <b>'+(state.bank.officialSummary || '—')+'</b><br>'
    + 'Novos dados validados: <b>'+(state.bank.pendingSummary || '—')+'</b><br>'
    + 'Os dados bancários serão atualizados somente no próximo <b>dia 11</b>, pois o pagamento será feito na conta vinculada ao CNPJ antigo.';
}
function applyWindowLockToBank(){
  if(state.window.blocked){
    el('bank-content').classList.add('disabled-block');
  } else if(state.cnpj.approved){
    unlockBankSection();
  } else {
    lockBankSection(true);
  }
}
