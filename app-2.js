
// ============= CNPJ VALIDATION =============
// Lista de exemplo pra demo — a lista real precisa variar por "Tipo Profissional" (ver nota de produto
// ao lado do item 2 do checklist) e ser confirmada com contabilidade/jurídico antes de produção.
const CNAE_LIST = ['8650-0/02','8650-0/03','8650-0/05','8630-5/03','8599-6/04','8650-0/06','8650-0/01'];
const CNPJ_MESSAGES = {
  nao_existe: 'Não conseguimos confirmar esse CNPJ com a Receita Federal. Confirme se preencheu o CNPJ corretamente ou, se for um CNPJ novo, aguarde mais alguns dias e tente novamente.',
  inativo: 'O CNPJ informado não está ativo.',
  cnae: 'O CNAE do seu CNPJ não é compatível com a especialidade cadastrada em "Tipo Profissional". Os CNAEs aceitos para a sua especialidade são: '+CNAE_LIST.join(', ')+'. Entre em contato com um contador(a) para ajustar o CNAE.',
  societario: 'O CPF informado não consta no quadro societário do CNPJ cadastrado.',
  // Confirmado com a Munin (Slack, 24/09): quadro societário sem nenhum sócio pessoa física (ex: holding).
  // Diferente do item "societario" acima (que é sobre O SEU CPF especificamente não estar no quadro).
  no_pf_socios: 'O quadro societário deste CNPJ não tem sócio pessoa física na Receita — sociedade por holding não é atendida. Consulte um contador para ajustar o quadro societário e tente novamente, ou use outro CNPJ que atenda a esse requisito.',
  // Confirmado com a Munin e o Thiago (Slack, 24/09): a Receita não devolveu nenhum CNAE utilizável.
  // Não é "CNAE errado" (isso é o item "cnae" acima) — aqui não há CNAE nenhum pra corrigir, então não
  // direcionamos pro contador. Como toda empresa ativa é obrigada por lei a ter CNAE, isso deveria ser raro.
  cnae_nao_publicado: 'Não foi possível validar a atividade econômica deste CNPJ. Tente cadastrar outro CNPJ.',
  // 3 códigos abaixo adicionados em 24/09 pra fechar 100% o mapeamento da tabela de retornos (nenhum
  // deles depende do profissional corrigir algo — por isso nenhum usa REGULARIZE_HINT).
  situacao_cadastral_nao_publicada: 'Identificamos uma pendência para concluir a validação do seu CNPJ. Tente novamente em alguns dias.',
  categoria_sem_regra_de_cnae: 'Identificamos uma pendência para concluir a validação do seu CNPJ. Tente novamente em alguns dias.',
  cnae_nao_classificado: 'Identificamos uma pendência para concluir a validação do seu CNPJ. Tente novamente em alguns dias.',
  indisponivel: 'Não foi possível validar seus dados agora. Tente novamente em alguns minutos.'
};
const REGULARIZE_HINT = ' Regularize e tente novamente.';

// O checklist de 3 itens (ativo / CNAE / quadro societário) é um único componente que serve tanto de
// aviso ANTES de validar (números neutros) quanto de resultado DEPOIS (✓/✗, com o motivo e o "regularize
// e tente novamente" junto do próprio item que falhou) — em vez de repetir tudo num card de erro solto.
function setCnpjCheckItem(key, status, detail){
  const mark = el('cc-mark-'+key);
  const detailEl = el('cc-detail-'+key);
  mark.classList.remove('ok','fail','skip');
  const numbers = {ativo:'1.', cnae:'2.', societario:'3.'};
  if(status==='ok'){
    mark.textContent = '✓'; mark.classList.add('ok');
    detailEl.style.display = 'none'; detailEl.classList.remove('skip');
  } else if(status==='fail'){
    mark.textContent = '✗'; mark.classList.add('fail');
    detailEl.textContent = detail; detailEl.classList.remove('skip'); detailEl.style.display = 'block';
  } else if(status==='skip'){
    mark.textContent = '–'; mark.classList.add('skip');
    detailEl.textContent = detail || ''; detailEl.classList.add('skip'); detailEl.style.display = detail ? 'block' : 'none';
  } else {
    mark.textContent = numbers[key];
    detailEl.style.display = 'none'; detailEl.classList.remove('skip');
  }
}
function resetCnpjChecklist(){
  ['ativo','cnae','societario'].forEach(k=>setCnpjCheckItem(k,'pending'));
}
// CNPJ inexistente é diferente dos outros erros: não dá nem pra começar a checar os 3 itens do
// checklist (não existe nada pra verificar), então o erro aparece direto no campo, não na lista.
function setCnpjFieldError(msg){
  el('f_cnpj').classList.add('input-error');
  el('f_cnpj-error').textContent = msg;
  el('f_cnpj-error').style.display = 'block';
}
function clearCnpjFieldError(){
  el('f_cnpj').classList.remove('input-error');
  el('f_cnpj-error').style.display = 'none';
}
// Traduz o cenário simulado (inclusive combinações de mais de um problema) pro estado de cada item
// do checklist, sempre com o motivo e a instrução de correção junto do item que falhou.
function applyCnpjChecklistResult(scenario){
  // Decisão de 25/09 (Giovanni): o checklist de 3 itens só faz sentido pros cenários "clássicos", onde
  // cada item realmente corresponde a uma causa que o profissional entende e consegue agir (CNAE, quadro
  // societário, situação cadastral). Os demais retornos são pendências de provedor/configuração ou nem
  // chegam a avaliar os 3 itens — pra esses, uma mensagem vermelha direto no campo do CNPJ é mais clara
  // do que forçar o resultado num item do checklist que não representa bem o problema.
  const USA_CHECKLIST = ['aprovado','inativo','cnae','societario','cnae_societario'];
  if(!USA_CHECKLIST.includes(scenario)){
    resetCnpjChecklist();
    setCnpjFieldError(CNPJ_MESSAGES[scenario]);
    return;
  }
  if(scenario==='aprovado'){
    setCnpjCheckItem('ativo','ok'); setCnpjCheckItem('cnae','ok'); setCnpjCheckItem('societario','ok');
  } else if(scenario==='inativo'){
    setCnpjCheckItem('ativo','fail', CNPJ_MESSAGES.inativo+REGULARIZE_HINT);
    setCnpjCheckItem('cnae','skip','Não verificado enquanto o CNPJ estiver inativo.');
    setCnpjCheckItem('societario','skip','Não verificado enquanto o CNPJ estiver inativo.');
  } else if(scenario==='cnae'){
    setCnpjCheckItem('ativo','ok');
    setCnpjCheckItem('cnae','fail', CNPJ_MESSAGES.cnae+REGULARIZE_HINT);
    setCnpjCheckItem('societario','ok');
  } else if(scenario==='societario'){
    setCnpjCheckItem('ativo','ok'); setCnpjCheckItem('cnae','ok');
    setCnpjCheckItem('societario','fail', CNPJ_MESSAGES.societario+REGULARIZE_HINT);
  } else if(scenario==='cnae_societario'){
    setCnpjCheckItem('ativo','ok');
    setCnpjCheckItem('cnae','fail', CNPJ_MESSAGES.cnae+REGULARIZE_HINT);
    setCnpjCheckItem('societario','fail', CNPJ_MESSAGES.societario+REGULARIZE_HINT);
  }
}

function renderCnpjButtonState(){
  el('btn-validar-cnpj').disabled = !financeiroUnlocked() || state.cnpj.locked || state.cnpj.approved || state.window.blocked;
}

function handleCnpjInput(input){
  maskCNPJ(input);
  clearCnpjFieldError();
  if(state.cnpj.approved){
    // Editar um CNPJ já validado invalida a validação anterior até validar de novo. A invalidação
    // dos dados bancários só acontece de fato no clique em "Validar CNPJ" (ver validateCNPJ), com aviso.
    // Captura o valor que ERA oficial antes dessa edição (pro banner de transição comparar depois).
    state.cnpj.lastOfficialValue = state.cnpj.approvedValue;
    state.cnpj.approved = false;
    el('cnpj-result').innerHTML = '<div class="msg pending">Você alterou o CNPJ. Valide novamente para confirmar os novos dados.</div>';
    el('cnpj-attempts-line').style.display = 'none';
    resetCnpjChecklist();
    renderDots();
    renderAgendaBanners();
  }
  renderCnpjButtonState();
}

function validateCNPJ(){
  if(!financeiroUnlocked() || state.cnpj.locked || state.cnpj.approved || state.window.blocked) return;
  const cnpjVal = el('f_cnpj').value.trim();
  if(cnpjVal.replace(/\D/g,'').length < 14){ alert('Informe um CNPJ completo (14 dígitos) para validar.'); return; }

  // O CNPJ mudou e havia dados bancários aprovados vinculados a ele: precisa avisar e invalidar antes de seguir.
  if(state.bank.approved){
    el('cnpj-bank-invalidate-modal').classList.add('open');
    return;
  }
  doValidateCNPJ();
}
function closeCnpjBankInvalidateModal(){
  el('cnpj-bank-invalidate-modal').classList.remove('open');
}
function confirmCnpjBankInvalidateModal(){
  closeCnpjBankInvalidateModal();
  // Guarda um resumo do dado bancário ATUAL (o que ainda vale pra pagamento) antes de limpar os campos,
  // pra poder mostrar antigo x novo no banner de transição depois que o novo for validado.
  state.bank.officialSummary = bankSummaryHTML();
  state.bank.approved = false;
  state.bank.pendingCnpjChange = true;
  el('b_pix').value = '';
  el('b_banco').value = ''; el('b_ag').value = ''; el('b_conta').value = ''; el('b_dig').value = '';
  el('no-pix-check').checked = false;
  el('bank-fields-box').style.display = 'none';
  el('bank-result').innerHTML = '<div class="msg pending">O CNPJ foi alterado. Preencha e valide os dados bancários novamente.</div>';
  el('bank-attempts-line').style.display = 'none';
  lockBankSection(true);
  renderDots();
  renderBankButtonState();
  renderAgendaBanners();
  doValidateCNPJ();
}
function doValidateCNPJ(){
  const scenario = el('cnpj-scenario').value;
  el('btn-validar-cnpj').disabled = true;
  el('cnpj-attempts-line').style.display = 'none';
  el('cnpj-result').innerHTML = '';
  el('cnpj-loading').style.display = 'block';
  resetCnpjChecklist();
  clearCnpjFieldError();

  setTimeout(()=>{
    el('cnpj-loading').style.display = 'none';
    finishCNPJ(scenario);
  }, 1300);
}

function finishCNPJ(scenario){
  applyCnpjChecklistResult(scenario);
  if(scenario === 'aprovado'){
    // Se o CNPJ já tinha sido aprovado antes (everApproved), essa validação é uma TROCA de CNPJ de um
    // profissional já ativo, não um cadastro novo — por isso mostra o aviso de corte por ciclo (decisão
    // da reunião jurídica de 21/09/2026: o CNPJ novo só vale pra pagamento a partir do próximo ciclo).
    const isTrocaDeCnpj = state.cnpj.everApproved;
    const novoValor = el('f_cnpj').value;
    // Decisão de 24/09 (Giovanni): tirar a explicação da mudança de data do toast verde — ninguém lê
    // mensagem de sucesso. O toast fica curto; o banner PERSISTENTE (renderCnpjTransitionBanner) é quem
    // carrega o antigo x novo e a data, e continua visível até a virada de ciclo ser simulada/concluída.
    if(isTrocaDeCnpj){
      state.cnpj.pendingOfficial = true;
      state.cnpj.officialValue = state.cnpj.lastOfficialValue || state.cnpj.approvedValue || '(CNPJ anterior)';
      state.cnpj.pendingValue = novoValor;
    }
    state.cnpj.approved = true;
    state.cnpj.everApproved = true;
    state.cnpj.approvedValue = novoValor;
    state.cnpj.attempts = 0;
    if(state.revalidacao.active) state.revalidacao.cnpjConfirmed = true;
    el('cnpj-result').innerHTML = isTrocaDeCnpj
      ? '<div class="msg success">Novo CNPJ validado e salvo com sucesso.</div>'
      : '<div class="msg success">CNPJ validado e salvo com sucesso. Agora só falta confirmar seus dados bancários.</div>';
    unlockBankSection();
    renderDots();
    renderCnpjButtonState();
    renderWindowPanelVisibility();
    renderCnpjTransitionBanner();
    renderAgendaBanners();
    // Decisão de 25/09 (Giovanni): muitos profissionais editam o CNPJ e nem rolam a tela até os dados
    // bancários pra perceber que precisam revalidar — leva o olhar pra lá automaticamente em vez de
    // depender de alguém ler o aviso.
    if(isTrocaDeCnpj && state.bank.pendingCnpjChange){
      const bankTitle = el('bank-section-title');
      if(bankTitle && bankTitle.scrollIntoView) bankTitle.scrollIntoView({behavior:'smooth', block:'center'});
    }
  } else {
    state.cnpj.attempts++;
    // O motivo e a instrução de correção já aparecem no checklist (pros cenários que usam checklist)
    // ou direto no campo do CNPJ, em vermelho (pros demais) — ver applyCnpjChecklistResult. Aqui só
    // cuida da contagem de tentativas e do bloqueio depois de 3.
    if(state.cnpj.attempts >= 3){
      lockCNPJ();
      el('cnpj-result').innerHTML = '<div class="msg locked" id="lock-msg">Você atingiu o limite de tentativas de validação do CNPJ. Tente novamente em <b id="lock-countdown">24:00:00</b>.</div>';
    } else {
      const remaining = 3 - state.cnpj.attempts;
      el('cnpj-attempts-line').style.display='block';
      el('cnpj-attempts-line').textContent = 'Você tem mais '+remaining+' tentativa'+(remaining>1?'s':'')+'.';
      renderCnpjButtonState();
    }
    renderAgendaBanners();
  }
}

function formatHMS(totalSeconds){
  const h = Math.floor(totalSeconds/3600), m = Math.floor((totalSeconds%3600)/60), s = totalSeconds%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

function lockCNPJ(){
  state.cnpj.locked = true;
  state.cnpj.lockSeconds = 24*60*60;
  el('btn-validar-cnpj').disabled = true;
  el('f_cnpj').disabled = true;
  clearInterval(state.cnpj.lockTimer);
  state.cnpj.lockTimer = setInterval(()=>{
    state.cnpj.lockSeconds--;
    const formatted = formatHMS(Math.max(state.cnpj.lockSeconds,0));
    const cd = document.getElementById('lock-countdown');
    if(cd) cd.textContent = formatted;
    const agendaCd = document.getElementById('agenda-lock-countdown');
    if(agendaCd) agendaCd.textContent = formatted;
    if(state.cnpj.lockSeconds<=0){
      clearInterval(state.cnpj.lockTimer);
      unlockCNPJRetry();
    }
  },1000);
  setTimeout(()=>{
    if(document.getElementById('lock-msg')){
      const skip = document.createElement('div');
      skip.className='linklike';
      skip.style.marginTop='6px';
      skip.textContent='Pular espera (modo teste)';
      skip.onclick = unlockCNPJRetry;
      document.getElementById('lock-msg').appendChild(document.createElement('br'));
      document.getElementById('lock-msg').appendChild(skip);
    }
  },50);
  renderAgendaBanners();
}
function unlockCNPJRetry(){
  state.cnpj.locked = false;
  state.cnpj.attempts = 0;
  clearInterval(state.cnpj.lockTimer);
  el('cnpj-result').innerHTML = '<div class="msg pending">Você já pode tentar validar novamente.</div>';
  renderFinanceiroLock();
  renderAgendaBanners();
}

// ============= BANK DATA =============
// PIX (pix-keys:verify-ownership) e conta bancária (bank-account-verifications) são 2 endpoints
// diferentes na Munin, com retornos e regras de retry diferentes (confirmado com o Bruno, Slack):
// - PIX: tem botão de tentar de novo; depois de ~3 tentativas, a tela oferece trocar pra agência/conta.
// - Conta bancária: nos casos falha_operacional/approve_nao_confirmado, NÃO oferecemos retry direto
//   (risco de duplicar verificação) — a alternativa é validar por chave PIX em vez de tentar de novo.
// Tabela completa de todos os retornos mapeados: link no painel de teste abaixo.
const PIX_MESSAGES = {
  titular: 'A chave PIX informada não pertence ao CNPJ do seu cadastro. Corrija o dado e tente novamente.',
  mascarado: 'Não conseguimos confirmar essa chave PIX com o seu banco. Cadastre seus dados bancários por agência e conta clicando em "Não tenho PIX" acima.',
  indisponivel: 'Não conseguimos validar agora. Tente novamente em alguns minutos.',
  nao_validavel: 'Essa chave PIX não pôde ser validada. Tente cadastrar outra chave PIX ou, se preferir, seus dados por agência e conta clicando em "Não tenho PIX" acima.'
};
const BANK_MESSAGES = {
  titular: 'A conta bancária informada não pertence ao CNPJ do seu cadastro. Enquanto isso não for corrigido, você não vai receber o seu pagamento. Corrija o dado bancário e tente novamente.',
  recusa_nao_classificada: 'Revise os dados da sua conta bancária e tente novamente.',
  status_desconhecido: 'Não conseguimos confirmar seus dados bancários agora. Nosso time já foi avisado e vai retornar.',
  falha_operacional: 'Não conseguimos confirmar seus dados bancários agora. Você pode validar sua conta usando uma chave PIX.',
  approve_nao_confirmado: 'Não conseguimos confirmar seus dados bancários agora. Você pode validar sua conta usando uma chave PIX.'
  // Removido "indisponivel" (24/09): não corresponde a nenhum dos 7 códigos documentados de
  // bank-account-verifications — pra manter o de-para 1:1 exato com a tabela, tiramos o cenário
  // fabricado. Casos de instabilidade real caem em status_desconhecido ou falha_operacional.
};
// Casos em que a Munin recomendou NÃO oferecer retry direto (risco de duplicar verificação) — a
// tela deve, em vez disso, oferecer a chave PIX como alternativa e não conta pra tentativa/bloqueio.
const BANK_NO_RETRY = ['falha_operacional', 'approve_nao_confirmado'];

function unlockBankSection(){
  el('bank-content').classList.remove('disabled-block');
  el('bank-locked-msg').style.display='none';
  el('bank-lock-icon').style.display='none';
}
function lockBankSection(showLockedMsg){
  el('bank-content').classList.add('disabled-block');
  if(showLockedMsg){ el('bank-locked-msg').style.display='block'; el('bank-lock-icon').style.display='inline'; }
}

function renderBankButtonState(){
  el('btn-validar-bank').disabled = state.bank.approved || state.window.blocked || state.bank.locked;
}

function handleBankFieldInput(){
  el('pix-switch-hint').style.display = 'none';
  el('account-switch-hint').style.display = 'none';
  if(state.bank.approved){
    // Editar dados bancários já validados invalida a validação anterior até validar de novo.
    state.bank.approved = false;
    el('bank-result').innerHTML = '<div class="msg pending">Você alterou os dados bancários. Valide novamente para confirmar as mudanças.</div>';
    renderDots();
    renderAgendaBanners();
  }
  renderBankButtonState();
}

function toggleNoPix(){
  const noPix = el('no-pix-check').checked;
  el('b_tipo_chave').disabled = noPix;
  el('b_pix').disabled = noPix;
  el('bank-fields-box').style.display = noPix ? 'block' : 'none';
  el('pix-scenario').style.display = noPix ? 'none' : 'block';
  el('bank-scenario').style.display = noPix ? 'block' : 'none';
  el('pix-switch-hint').style.display = 'none';
  el('account-switch-hint').style.display = 'none';
  handleBankFieldInput();
}

// Chamado pelo link "Trocar para agência e conta" (ver pix-switch-hint) — troca de método sem contar
// como nova tentativa bloqueada, já que é uma verificação diferente (bank-account, não PIX).
function switchToNoPix(){
  el('no-pix-check').checked = true;
  toggleNoPix();
  state.bank.attempts = 0;
  el('bank-attempts-line').style.display = 'none';
  el('bank-result').innerHTML = '<div class="msg pending">Preencha os dados da sua conta bancária abaixo.</div>';
}
// Chamado pelo link "Trocar para chave PIX" (ver account-switch-hint) — direção contrária de
// switchToNoPix(), pros casos em que o problema é específico da conta bancária (BANK_NO_RETRY).
function switchToPix(){
  el('no-pix-check').checked = false;
  toggleNoPix();
  state.bank.attempts = 0;
  el('bank-attempts-line').style.display = 'none';
  el('bank-result').innerHTML = '<div class="msg pending">Preencha sua chave PIX abaixo.</div>';
}

function validateBank(){
  if(state.bank.approved || state.window.blocked || state.bank.locked) return;
  // Esse dado bancário está sendo revalidado por causa de uma troca de CNPJ recente — avisa
  // ANTES de validar que o novo dado só vale a partir do próximo dia 11 (ver nota acima).
  if(state.bank.pendingCnpjChange){
    el('bank-cnpj-transition-modal').classList.add('open');
    return;
  }
  // Sempre que um dado bancário é enviado (novo ou editado), checa se o CNPJ é compartilhado
  // com outros profissionais, já que a alteração vale pra todos eles.
  if(el('cnpj-shared-check').checked){
    el('bank-shared-modal').classList.add('open');
    return;
  }
  doValidateBank();
}
function closeBankCnpjTransitionModal(){
  el('bank-cnpj-transition-modal').classList.remove('open');
}
function confirmBankCnpjTransitionModal(){
  closeBankCnpjTransitionModal();
  if(el('cnpj-shared-check').checked){
    el('bank-shared-modal').classList.add('open');
    return;
  }
  doValidateBank();
}
function closeBankSharedModal(){
  el('bank-shared-modal').classList.remove('open');
}
function confirmBankSharedModal(){
  closeBankSharedModal();
  doValidateBank();
}
function doValidateBank(){
  const noPix = el('no-pix-check').checked; // true = validando por agência/conta; false = validando por chave PIX
  const scenario = noPix ? el('bank-scenario').value : el('pix-scenario').value;
  el('btn-validar-bank').disabled = true;
  el('bank-checklist-loading').style.display='block';
  el('bank-result').innerHTML='';
  el('bank-attempts-line').style.display = 'none';
  el('pix-switch-hint').style.display = 'none';
  setTimeout(()=>{
    el('bank-checklist-loading').style.display='none';
    if(scenario==='aprovado'){
      state.bank.approved = true;
      state.bank.everApproved = true;
      state.bank.attempts = 0;
      if(state.revalidacao.active) state.revalidacao.bankConfirmed = true;
      // Decisão de 24/09 (Giovanni): toast verde curto, sem explicação embutida — quem carrega a
      // data/detalhe é o banner PERSISTENTE (renderBankTransitionBanner), só sobre dado bancário.
      if(state.bank.pendingCnpjChange){
        state.bank.pendingCnpjChange = false;
        state.bank.pendingOfficial = true;
        state.bank.pendingSummary = bankSummaryHTML();
      }
      el('bank-result').innerHTML = '<div class="msg success">Dados bancários validados e salvos com sucesso.</div>';
      renderDots();
      renderWindowPanelVisibility();
      renderBankButtonState();
      renderBankTransitionBanner();
      renderAgendaBanners();
      return;
    }

    const msg = noPix ? BANK_MESSAGES[scenario] : PIX_MESSAGES[scenario];

    // Confirmado com a Munin: falha_operacional e approve_nao_confirmado (só existem do lado da conta
    // bancária) não devem oferecer retry direto — oferece trocar pra chave PIX em vez de contar tentativa.
    if(noPix && BANK_NO_RETRY.includes(scenario)){
      el('bank-result').innerHTML = '<div class="msg error">'+msg+'</div>';
      // Bug corrigido (25/09): esse caso é específico de agência/conta, então a alternativa certa é
      // sugerir a chave PIX (account-switch-hint), não "trocar para agência e conta" (pix-switch-hint)
      // — o profissional já está validando por agência/conta. Também faltava renderBankButtonState():
      // o botão ficava travado (disabled) pra sempre, sem jeito de tentar de novo sem resetar o cenário.
      el('account-switch-hint').style.display = 'block';
      renderBankButtonState();
      renderAgendaBanners();
      return;
    }

    state.bank.attempts++;
    if(state.bank.attempts >= 3){
      if(noPix){
        lockBank();
        el('bank-result').innerHTML = '<div class="msg error">'+msg+'</div><div class="msg locked" id="bank-lock-msg">Você atingiu o limite de tentativas de validação dos dados bancários. Tente novamente em <b id="bank-lock-countdown">24:00:00</b>.</div>';
      } else {
        // PIX não bloqueia por 24h (confirmado com o Bruno): depois de 3 tentativas, oferece agência/conta.
        el('bank-result').innerHTML = '<div class="msg error">'+msg+'</div>';
        el('pix-switch-hint').style.display = 'block';
        renderBankButtonState();
      }
    } else {
      const remaining = 3 - state.bank.attempts;
      el('bank-result').innerHTML = '<div class="msg error">'+msg+'</div>';
      el('bank-attempts-line').style.display = 'block';
      el('bank-attempts-line').textContent = 'Você tem mais '+remaining+' tentativa'+(remaining>1?'s':'')+'.';
      renderBankButtonState();
    }
    renderAgendaBanners();
  }, 900);
}

function lockBank(){
  state.bank.locked = true;
  state.bank.lockSeconds = 24*60*60;
  el('btn-validar-bank').disabled = true;
  clearInterval(state.bank.lockTimer);
  state.bank.lockTimer = setInterval(()=>{
    state.bank.lockSeconds--;
    const formatted = formatHMS(Math.max(state.bank.lockSeconds,0));
    const cd = document.getElementById('bank-lock-countdown');
    if(cd) cd.textContent = formatted;
    const agendaCd = document.getElementById('agenda-bank-lock-countdown');
    if(agendaCd) agendaCd.textContent = formatted;
    if(state.bank.lockSeconds<=0){
      clearInterval(state.bank.lockTimer);
      unlockBankRetry();
    }
  },1000);
  setTimeout(()=>{
    if(document.getElementById('bank-lock-msg')){
      const skip = document.createElement('div');
      skip.className='linklike';
      skip.style.marginTop='6px';
      skip.textContent='Pular espera (modo teste)';
      skip.onclick = unlockBankRetry;
      document.getElementById('bank-lock-msg').appendChild(document.createElement('br'));
      document.getElementById('bank-lock-msg').appendChild(skip);
    }
  },50);
  renderAgendaBanners();
}
function unlockBankRetry(){
  state.bank.locked = false;
  state.bank.attempts = 0;
  clearInterval(state.bank.lockTimer);
  el('bank-result').innerHTML = '<div class="msg pending">Você já pode tentar validar novamente.</div>';
  renderBankButtonState();
  renderAgendaBanners();
}

// ============= AVISO PRÉ-VIRADA (semana anterior à virada obrigatória) =============
function toggleAvisoRevalidacao(){
  state.avisoRevalidacao.active = el('aviso-golive-check').checked;
  state.avisoRevalidacao.dismissed = false;
  if(state.avisoRevalidacao.active){
    // Mutuamente exclusivo com a simulação da virada: são dois momentos diferentes da linha do tempo.
    el('virada-19-10-check').checked = false;
    state.revalidacao.active = false;
    el('reval-modal').classList.remove('open');
  }
  renderAgendaBanners();
}
// ============= SIMULAÇÃO DA VIRADA (19/10 em diante — bloqueio obrigatório) =============
function toggleVirada1910(){
  if(el('virada-19-10-check').checked){
    // Mutuamente exclusivo com o aviso pré-prazo.
    el('aviso-golive-check').checked = false;
    state.avisoRevalidacao.active = false;
    state.avisoRevalidacao.dismissed = false;
    state.revalidacao.active = true;
    state.revalidacao.emailConfirmed = false;
    state.revalidacao.cnpjConfirmed = false;
    state.revalidacao.bankConfirmed = false;
    state.revalidacao.step = 1;
    renderAgendaBanners();
    maybeShowRevalModal();
  } else {
    state.revalidacao.active = false;
    el('reval-modal').classList.remove('open');
    renderAgendaBanners();
  }
}
function dismissAvisoRevalidacao(){
  state.avisoRevalidacao.dismissed = true;
  renderAgendaBanners();
}

// ============= AGENDA BANNERS =============
function renderAgendaBanners(){
  const wrap = el('agendaBanners');
  wrap.innerHTML = '';
  const unlocked = financeiroUnlocked();

  // Esse aviso aparece pra todo mundo, independente do cadastro estar completo ou não, por isso vem
  // antes de qualquer outro banner e não depende do financeiro estar liberado.
  if(state.avisoRevalidacao.active && !state.avisoRevalidacao.dismissed){
    wrap.innerHTML += '<div class="banner notice"><span>📌</span><span><b>Aviso importante:</b> no dia <b>'+LOCK_DATE+'</b>, quando você entrar na plataforma, vai precisar confirmar ou editar 3 informações antes de iniciar qualquer atendimento: <b>CNPJ</b>, <b>Dados Bancários</b> e <b>E-mail</b>. Para evitar transtornos, atualize essas informações com antecedência nas sessões <span class="linklike" style="font-weight:700;" onclick="event.stopPropagation();goto(\'account\');switchTab(\'pessoal\')">Pessoal</span> e <span class="linklike" style="font-weight:700;" onclick="event.stopPropagation();goto(\'account\');switchTab(\'financeiro\')">Financeiro</span> — assim, no dia 19/10, você só precisa confirmar que os dados continuam certos.</span><span class="arrow" style="cursor:pointer;" onclick="event.stopPropagation();dismissAvisoRevalidacao()" title="Dispensar aviso">✕</span></div>';
  }

  if(!unlocked){
    wrap.innerHTML = '<div class="banner pending" onclick="goto(\'account\');switchTab(\'pessoal\')"><span>⏳</span><span>Finalize seu cadastro (dados pessoais, profissionais e sessões) para liberar seu cadastro financeiro.</span><span class="arrow">›</span></div>';
    renderChecklists();
    return;
  }

  if(state.cnpj.locked){
    wrap.innerHTML += '<div class="banner locked" onclick="goto(\'account\');switchTab(\'financeiro\')"><span>⏰</span><span>Você atingiu o limite de tentativas de validação do CNPJ. Tente novamente em <b id="agenda-lock-countdown">'+formatHMS(state.cnpj.lockSeconds)+'</b>.</span><span class="arrow">›</span></div>';
  } else if(!state.cnpj.approved && state.cnpj.attempts===0){
    wrap.innerHTML += '<div class="banner pending" onclick="goto(\'account\');switchTab(\'financeiro\')"><span>⏳</span><span>Estamos validando o CNPJ informado.</span><span class="arrow">›</span></div>';
  } else if(!state.cnpj.approved && state.cnpj.attempts>0){
    wrap.innerHTML += '<div class="banner error" onclick="goto(\'account\');switchTab(\'financeiro\')"><span>⚠️</span><span><b>CNPJ não aprovado.</b> Corrija seus dados e tente novamente.</span><span class="arrow">›</span></div>';
  } else if(state.cnpj.approved && state.bank.locked){
    wrap.innerHTML += '<div class="banner locked" onclick="goto(\'account\');switchTab(\'financeiro\')"><span>⏰</span><span>Você atingiu o limite de tentativas de validação dos dados bancários. Tente novamente em <b id="agenda-bank-lock-countdown">'+formatHMS(state.bank.lockSeconds)+'</b>.</span><span class="arrow">›</span></div>';
  } else if(state.cnpj.approved && !state.bank.approved){
    wrap.innerHTML += '<div class="banner pending" onclick="goto(\'account\');switchTab(\'financeiro\')"><span>⏳</span><span>Estamos validando seus dados bancários.</span><span class="arrow">›</span></div>';
  }

  if(financeiroCompleto()){
    wrap.innerHTML += '<div class="banner success"><span>✅</span><span>Cadastro completo! Você já está liberado para receber agendamentos.</span></div>';
  }
  renderChecklists();
}

function renderChecklists(){
  const items = [
    {label:'Preencha seus dados pessoais', done: state.pessoal.done, go:"switchTab('pessoal')"},
    {label:'Insira suas informações profissionais', done: state.profissional.done, go:"switchTab('profissional')"},
    {label:'Defina sua disponibilidade de atendimento', done: false, go:null},
    {label:'Configure o formato de faturamento', done: state.cnpj.attempts>0 || state.cnpj.approved, go:"switchTab('financeiro')"},
    {label:'Aguardando aprovação do perfil de faturamento', done: financeiroCompleto(), go:null}
  ];
  const doneCount = items.filter(i=>i.done).length;
  const pct = Math.round(doneCount/items.length*100);
  const badge1 = el('cc-atenda-badge');
  if(badge1){
    badge1.textContent = pct+'%';
    badge1.className = 'cc-badge ' + (pct>=100?'done':'progress');
    el('cc-atenda-list').innerHTML = items.map(i=>
      '<div class="cc-item '+(i.done?'':'pending')+'"'+(!i.done && i.go?' onclick="goto(\'account\'); '+i.go+'"':'')+'>'+(i.done?'✓':'○')+' <span>'+i.label+'</span>'+(i.done?'':'<span class="arrow">›</span>')+'</div>'
    ).join('');
  }

  const items2 = [
    {label:'Defina o valor da sua sessão', done: state.online.done, go:"switchTab('online')"},
    {label:'Insira seus dados bancários', done: state.bank.approved, go:"switchTab('financeiro')"}
  ];
  const doneCount2 = items2.filter(i=>i.done).length;
  const pct2 = Math.round(doneCount2/items2.length*100);
  const badge2 = el('cc-receba-badge');
  if(badge2){
    badge2.textContent = pct2+'%';
    badge2.className = 'cc-badge ' + (pct2>=100?'done':'progress');
    el('cc-receba-list').innerHTML = items2.map(i=>
      '<div class="cc-item '+(i.done?'':'pending')+'"'+(!i.done && i.go?' onclick="goto(\'account\'); '+i.go+'"':'')+'>'+(i.done?'✓':'○')+' <span>'+i.label+'</span>'+(i.done?'':'<span class="arrow">›</span>')+'</div>'
    ).join('');
  }
}

// ============= RESET (só para teste) =============
function resetPrototype(){
  if(!confirm('Isso apaga tudo que foi preenchido no cenário atual e volta ao início dele. Continuar?')) return;
  hardResetState();
  if(state.scenario) applyScenarioData(state.scenario);
}

function hardResetState(){
  clearInterval(state.cnpj.lockTimer);
  clearInterval(state.bank.lockTimer);
  state.pessoal.done = false;
  state.profissional.done = false;
  state.planoSessao.done = false;
  state.online.done = false;
  state.presencial.done = false;
  state.faturamento = 'pj';
  state.cnpj = {approved:false, attempts:0, locked:false, lockSeconds:0, lockTimer:null, everApproved:false};
  state.bank = {approved:false, attempts:0, locked:false, lockSeconds:0, lockTimer:null, everApproved:false, pendingCnpjChange:false, pendingOfficial:false, officialSummary:'', pendingSummary:''};
  state.window = {blocked:false};
  state.revalidacao = {active:false, emailConfirmed:false, cnpjConfirmed:false, bankConfirmed:false, step:1};
  state.avisoRevalidacao = {active:false, dismissed:false};
  el('window-locked-msg').style.display = 'none';
  closeChangeEmailModal();
  closeChangeEmailConfirmModal();
  closeBankSharedModal();
  closeCnpjBankInvalidateModal();
  el('reval-modal').classList.remove('open');
  resetCnpjChecklist();
  clearCnpjFieldError();

  document.querySelectorAll('input').forEach(i=>{
    if(i.type==='checkbox') i.checked=false;
    else { i.value=''; i.disabled=false; }
  });
  document.querySelectorAll('select').forEach(s=>{
    if(s.multiple){ Array.from(s.options).forEach(o=>o.selected=false); }
    else { s.selectedIndex = 0; }
  });
  document.querySelectorAll('textarea').forEach(t=>{ t.value=''; });
  // CPF em Financeiro e o Email em Pessoal são só leitura (editam-se por outro caminho) — o loop
  // acima reabilita todo input indiscriminadamente, então precisa travar os dois de novo aqui.
  el('f_cpf_pj').disabled = true;
  el('p_email').disabled = true;
  el('p_senha_display').value = '123456';
  el('p_senha_display').disabled = true;
  hideSitePrefillBadges();
  // Os checkboxes de Plano e sessão vêm marcados por padrão no produto real, e os selects têm uma
  // opção padrão diferente da primeira, e o loop genérico acima desfaz os dois, então corrige aqui.
  if(el('ps_aceita_clientes')) el('ps_aceita_clientes').checked = true;
  if(el('ps_horas_fechadas')) el('ps_horas_fechadas').checked = true;
  if(el('ps_antecedencia_agendamento')) el('ps_antecedencia_agendamento').selectedIndex = 2;
  if(el('ps_antecedencia_reagendamento')) el('ps_antecedencia_reagendamento').selectedIndex = 2;
  if(el('ps_fuso')) el('ps_fuso').selectedIndex = 0;
  if(el('pr_resumo_count')) el('pr_resumo_count').textContent = '0';
  if(el('pr_descricao_count')) el('pr_descricao_count').textContent = '0';

  el('enderecosList').innerHTML = '';
  enderecoCount = 0;
  renderAddEnderecoBtn();

  el('formacaoList').innerHTML = '';
  formacaoCount = 0;

  el('cnpj-result').innerHTML = '';
  el('cnpj-loading').style.display = 'none';
  el('cnpj-attempts-line').style.display = 'none';
  el('cnpj-test-panel').style.display = 'block';
  el('cnpj-scenario').selectedIndex = 0;

  el('bank-result').innerHTML = '';
  el('bank-attempts-line').style.display = 'none';
  el('pix-switch-hint').style.display = 'none';
  el('account-switch-hint').style.display = 'none';
  el('no-pix-check').checked = false;
  el('b_tipo_chave').disabled = false;
  el('b_pix').disabled = false;
  el('bank-fields-box').style.display = 'none';
  el('pix-scenario').style.display = 'block';
  el('pix-scenario').selectedIndex = 0;
  el('bank-scenario').style.display = 'none';
  el('bank-scenario').selectedIndex = 0;
  el('cnpj-shared-check').checked = false;
  lockBankSection(true);
  el('window-lock-check').checked = false;
  el('cycle-turnover-check').checked = false;
  el('virada-19-10-check').checked = false;
  state.cnpj.pendingOfficial = false;
  state.bank.pendingOfficial = false;
  renderCnpjTransitionBanner();
  renderBankTransitionBanner();

  el('change-email-form').style.display = 'block';
  closeChangeEmailConfirmModal();

  renderDots();
  renderFinanceiroLock();
  renderBankButtonState();
  renderAgendaBanners();
  switchTab('pessoal');
}

// ============= CENÁRIOS DA DEMO (só para a apresentação) =============
// Cenário 1: novo profissional — estado limpo, sem pré-preenchimento.
// Cenários 2 e 3 simulam um profissional que já usa o Zenklub hoje, com CNPJ e dados
// bancários já validados anteriormente (state.cnpj/bank.approved = true).
function prefillProfissionalExistente(){
  el('p_nome').value = 'Ana Beatriz Souza';
  el('p_cpf').value = '123.456.789-00';
  el('p_cel').value = '(11) 98888-7777';
  el('p_nasc').value = '14/03/1990';
  el('p_email').value = 'ana.souza@gmail.com';
  el('p_cidade').value = 'São Paulo/SP';
  el('pr_tipo').value = 'Psicólogo(a)';
  el('pr_crp').value = '06/123456';
  el('on_valor').value = 'R$ 180,00';
  el('f_cpf_pj').value = '123.456.789-00';
  el('f_cnpj').value = '12.345.678/0001-90';
  el('b_tipo_chave').value = 'CNPJ';
  el('b_pix').value = '12.345.678/0001-90';
  el('ps_aceita_clientes').checked = true;
  el('ps_horas_fechadas').checked = true;
  el('ps_antecedencia_agendamento').selectedIndex = 2;
  el('ps_antecedencia_reagendamento').selectedIndex = 2;
  el('ps_fuso').selectedIndex = 0;

  state.pessoal.done = true;
  state.profissional.done = true;
  state.planoSessao.done = true;
  state.online.done = true;
  state.cnpj.approved = true;
  state.cnpj.everApproved = true;
  // Bug corrigido (25/09): esse prefill de demo pulava a validação normal (finishCNPJ), então
  // approvedValue nunca era setado — o banner de transição caía no fallback "(CNPJ anterior)"
  // em vez de mostrar o CNPJ real quando o profissional trocava o CNPJ depois de carregar a demo.
  state.cnpj.approvedValue = el('f_cnpj').value;
  state.bank.approved = true;
  state.bank.everApproved = true;
  applyCnpjChecklistResult('aprovado');

  unlockBankSection();
  renderDots();
  renderFinanceiroLock();
  renderCnpjButtonState();
  renderBankButtonState();
  renderAgendaBanners();
}
function loadScenario(n){
  hardResetState();
  state.scenario = n;
  applyScenarioData(n);
}
function applyScenarioData(n){
  if(n===1){
    prefillNovoProfissionalSite();
    goto('agenda');
  } else if(n===2){
    // Decisão de 25/09 (Giovanni): cenário 2 agora simula o profissional entrando ANTES da virada
    // obrigatória (ex.: 12/10) — vê o aviso amigável, mas ainda não é bloqueado. O gate obrigatório
    // (modal que força confirmar CNPJ/banco/e-mail) fica só pra quem entra DEPOIS do dia 19/10.
    prefillProfissionalExistente();
    el('aviso-golive-check').checked = true;
    toggleAvisoRevalidacao();
    goto('agenda');
  } else if(n===3){
    prefillProfissionalExistente();
    goto('agenda');
  }
}

// ============= CALENDAR GRID (decorativo) =============
function buildCalendarGrid(){
  const grid = document.querySelector('.cal-grid');
  for(let h=7; h<=20; h++){
    const label = document.createElement('div');
    label.className = 'cal-time';
    label.textContent = String(h).padStart(2,'0')+':00';
    grid.appendChild(label);
    for(let d=0; d<7; d++){
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      grid.appendChild(cell);
    }
  }
}

// ============= INIT =============
renderDots();
renderAgendaBanners();
renderFinanceiroLock();
buildCalendarGrid();
el('cnae-list-fixo').textContent = CNAE_LIST.join(', ');
