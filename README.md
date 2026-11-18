# SeguroChain
Aplicação Descentralizada usando blockchain e smart contracts

Trabalho 2 de ODS III: dApp de seguro veicular na rede Ethereum Sepolia, com contrato em Solidity e frontend em HTML, CSS e JavaScript usando Web3.js e MetaMask.

| | |
|---|---|
| dApp na Vercel | [https://(preencher).vercel.app](https://segurochain-git-main-acme-24a01.vercel.app/) |
| Contrato na Sepolia | 0x989b1612A1B7123e422422926553e3197BcF8Af1 |
| Vídeo de demonstração | https://drive.google.com/file/d/1zvVFzrTueDuv3Ox_fACADRiwwL-q7--y/view?usp=sharing |
| Slides | [SeguroChain](https://canva.link/7zipel4ovjvhk01) |

## 1. Tema e problema

Num seguro de carro tradicional o segurado não acompanha o que acontece com a sua apólice: não sabe exatamente por que um sinistro foi negado nem quando vai receber. As regras ficam dentro do sistema da seguradora.

No SeguroChain essas regras ficam num contrato público:

- a seguradora emite a apólice e o segurado paga o prêmio em ETH para ativá-la;
- o segurado registra o sinistro pela própria carteira;
- a análise é feita pelo contrato, seguindo regras fixas (vigência, cobertura, franquia, perda total e saldo da apólice), e o motivo da decisão fica gravado;
- a indenização é paga em ETH direto para a carteira do segurado, a partir de uma reserva que qualquer pessoa pode conferir.

Atores: a **seguradora** (a conta que fez o deploy, `owner`) e o **segurado** (dono da carteira cadastrada na apólice). Qualquer pessoa pode consultar apólices, sinistros e eventos.

Por que blockchain: as regras de análise são públicas e não podem ser alteradas depois do deploy, todo o histórico fica registrado e o pagamento não depende de um intermediário.

### Estados

```
Apólice:  PENDENTE --pagarPremio--> ATIVA --cancelarApolice--> CANCELADA
              \_______________cancelarApolice_______________/

Sinistro: EM_ANALISE --analisarSinistro--> APROVADO --pagarSinistro--> PAGO
                                      \--> REJEITADO
```

O estado `EXPIRADA` existe no enum mas ainda não é usado (ver Limitações).

## 2. Integrantes

| Nome | Papel |
|---|---|
| Amós e Handryo | Contrato (Solidity, testes no Remix) |
| Amós e Handryo | Frontend (HTML e CSS) |
| Amós | Integração Web3 (Web3.js, MetaMask, eventos) |
| Amós e Handryo | Documentação e testes (README, vídeo, apresentação) |

## 3. Deploy na Sepolia

| | |
|---|---|
| Endereço do contrato | 0x989b1612A1B7123e422422926553e3197BcF8Af1 |
| Etherscan | https://sepolia.etherscan.io/address/(preencher) |
| Hash da transação de deploy | `(preencher)` |
| Bloco | (preencher) |
| Compilador | Solidity 0.8.24 ou superior, otimização ligada (200 runs) |
| Código verificado no Etherscan | (sim / não) |

## 4. Funções do contrato

Arquivo: [segurochain-dapp/contracts/SeguroChain.sol](segurochain-dapp/contracts/SeguroChain.sol)

### Transações

| Função | Quem chama | O que faz | Evento | Erros possíveis |
|---|---|---|---|---|
| `emitirApolice(...)` | seguradora | Cria a apólice como PENDENTE. Valida os dados, limita a franquia a 20% do valor segurado, exige ao menos uma cobertura e não aceita duas apólices vigentes para a mesma placa. | `ApoliceEmitida` | `PlacaJaSegurada`, `require` de validação |
| `pagarPremio(id)` (payable) | titular da apólice | Recebe o prêmio (5% do valor segurado) e ativa a apólice. A cobertura passa a valer a partir do pagamento. | `ApoliceAtivada` | `PremioIncorreto`, `require` |
| `cancelarApolice(id)` | seguradora | Cancela uma apólice PENDENTE ou ATIVA e libera a placa. | `ApoliceCancelada` | `require` |
| `registrarSinistro(apoliceId, tipo, valor, data)` | titular da apólice | Registra o sinistro como EM_ANALISE. A apólice precisa estar ATIVA e o limite é de 10 sinistros por apólice. | `SinistroRegistrado` | `require` |
| `analisarSinistro(id)` | seguradora | Aplica as regras de negócio e aprova ou rejeita, gravando o motivo. | `SinistroAnalisado` | `require` |
| `pagarSinistro(id)` | seguradora | Transfere a indenização em ETH para o segurado. | `SinistroPago` | `SaldoInsuficiente`, `TransferenciaFalhou`, `require` |
| `depositarFundos()` (payable) | seguradora | Deposita ETH na reserva usada para pagar indenizações. | `FundosDepositados` | `require` |
| `sacarFundos(valor)` | seguradora | Saca o que sobra na reserva. Não deixa sacar o valor de indenizações aprovadas e ainda não pagas. | `FundosSacados` | `SaldoInsuficiente`, `TransferenciaFalhou` |

### Consultas (view, sem custo)

`consultarApolice`, `saldoDisponivel`, `valorPremio`, `estaVigente`, `listarApolicesProprietario`, `listarSinistrosApolice`, `contarSinistrosPorStatus`, `saldoContrato`, `saldoLivre`, além dos getters automáticos (`owner`, `apolices`, `sinistros`, `totalApolices`, `totalSinistros`, `totalAPagar`, `apoliceAtivaDaPlaca` e as constantes).

### Regras da análise de sinistro

1. A apólice precisa estar vigente na data do sinistro.
2. O tipo do sinistro precisa estar entre as coberturas contratadas.
3. Roubo e perda total (valor pedido de pelo menos 75% do valor segurado) não têm franquia. Nos outros casos aplica-se a franquia da apólice.
4. O valor pedido precisa ser maior que a franquia.
5. A indenização (valor pedido menos franquia) não pode passar do saldo disponível da apólice.

## 5. Recursos de Solidity

Cada recurso está marcado no código com `// [Recurso: ...]`.

| Grupo | Onde aparece | Por que foi usado |
|---|---|---|
| TiposDeDados | `uint256` em valores e datas (struct `Apolice`, linha 28); `bool[3] coberturas`; `string modelo` e `placa`; `address payable proprietario` (30) e `owner` (60); `immutable owner` (60); `constant` nas regras de negócio (92 a 101); `int256` em `saldoLivre` (668) e `sacarFundos` (649); `bytes32` no hash da placa (`apoliceAtivaDaPlaca`, 87, e `_reservarPlaca`, 712) | `address payable` porque segurado e seguradora recebem ETH; `immutable` porque o dono não muda depois do deploy; `int256` porque a reserva livre fica negativa quando falta dinheiro para pagar o que foi aprovado; `bytes32` para usar a placa como chave de tamanho fixo |
| Funcoes | `constructor` (207); `external` nas transações (ex.: `emitirApolice`, 225); `public` em `estaVigente` (393), `valorPremio` (379) e `saldoLivre` (668); `internal` em `_liberarPlaca` (719) e `_toString` (728); `private` em `_reservarPlaca` (710); `payable` em `pagarPremio` (304) e `depositarFundos` (640); `view` nas consultas e `pure` em `_toString` | `public` quando a função é usada pelo frontend e também dentro do contrato (`estaVigente` é chamada em `analisarSinistro`, `valorPremio` em `pagarPremio`); `internal`/`private` para lógica auxiliar que não deve ser chamada de fora |
| EstruturasDeControle | `require` nas validações de `emitirApolice` (240); `if/else` nas regras de `analisarSinistro` (491); laço `for` em `contarSinistrosPorStatus` (699), limitado por `MAX_SINISTROS_POR_APOLICE`; laços `while` em `_toString` (734 e 741) | O limite de 10 sinistros por apólice (verificado em `registrarSinistro`) mantém o custo do laço previsível |
| ArraysEMappings | `mapping(uint256 => Apolice)` e `mapping(uint256 => Sinistro)` (74 e 77); `mapping(uint256 => uint256[])` e `mapping(address => uint256[])` com arrays dinâmicos (80 e 83); `mapping(bytes32 => uint256)` da placa (87) | Busca direta por ID; lista de sinistros de cada apólice e de apólices de cada carteira (usadas na consulta e em "Minhas Apólices"); controle de placa já segurada |
| StructsEEnums | `enum TipoCobertura`, `StatusApolice`, `StatusSinistro` (16 a 22); `struct Apolice` (28) e `struct Sinistro` (44) | Os enums representam os estados do diagrama acima; as structs guardam os dados de cada apólice e sinistro |
| Modificadores | `apenasOwner` (177); `apoliceExiste(id)` (183); `sinistroExiste(id)` (189); `apenasDono(apoliceId)` (195) | Controle de acesso (seguradora e titular da apólice) e validação de IDs reaproveitada em várias funções; três deles recebem parâmetro |
| EventosEErros | 8 eventos com parâmetros `indexed` (107 a 157); 4 erros personalizados (162 a 171) usados com `revert`, além dos `require` | Os eventos alimentam o histórico do frontend (`getPastEvents`); os erros levam dados (ex.: `SaldoInsuficiente(disponivel, solicitado)`) que o frontend usa para montar a mensagem |

### Segurança

- Controle de acesso com `apenasOwner` e `apenasDono`.
- `pagarSinistro` segue checks-effects-interactions: o sinistro é marcado como PAGO antes da transferência, então uma segunda chamada é recusada.
- Transferências com `call{value: ...}` e verificação do retorno (`TransferenciaFalhou`).
- A seguradora não consegue sacar o valor de indenizações já aprovadas (`saldoLivre`).
- O prêmio precisa ser o valor exato, e a cobertura só começa quando ele é pago, para não ser possível contratar o seguro depois do acidente.

## 6. Frontend, Vercel e MetaMask

Arquivos em [segurochain-dapp/frontend](segurochain-dapp/frontend):

| Arquivo | Conteúdo |
|---|---|
| `index.html` | estrutura da página |
| `style.css` | layout, tema escuro e versão para celular |
| `app.js` | conexão com a MetaMask, leituras, transações, eventos e erros |
| `contrato.js` | endereço, bloco do deploy e ABI do contrato |

O que a interface faz:

- conecta a MetaMask e mostra endereço, saldo em ETH e rede;
- se a MetaMask não estiver na Sepolia, mostra um aviso com o botão "Trocar para Sepolia";
- mostra só as seções do perfil conectado: a seguradora vê emitir apólice, analisar e pagar sinistro, reserva e cancelamento; o segurado vê suas apólices, o pagamento do prêmio e o registro de sinistro;
- painel com totais, saldo do contrato, valor a pagar e reserva livre;
- consulta de apólice com seus sinistros e o motivo de cada decisão;
- cada transação mostra o estado (aguardando assinatura, pendente com o hash, confirmada ou erro) com link para o Sepolia Etherscan;
- antes de enviar, a transação é simulada; se o contrato for recusar, a mensagem aparece sem gastar gas;
- histórico de eventos lido com `getPastEvents`;
- ao trocar de conta ou de rede na MetaMask a página recarrega e reconecta sozinha.

### Configurar depois do deploy

Em `segurochain-dapp/frontend/contrato.js`, preencher `CONTRACT_ADDRESS` com o endereço do contrato e `DEPLOY_BLOCK` com o bloco do deploy. Se o contrato mudar, copiar a ABI nova no Remix (Solidity Compiler > ABI).

### Rodar localmente

A MetaMask não funciona em páginas abertas como arquivo (`file://`), então é preciso servir a pasta.

Com o script do projeto:

```bash
npm run dev
```

Ou diretamente:

```bash
npx serve segurochain-dapp/frontend
```

Ou com Python:

```bash
python -m http.server 8000 --directory segurochain-dapp/frontend
```

### Vercel

O `vercel.json` na raiz já aponta para `segurochain-dapp/frontend`. Ao importar o repositório na Vercel, deixar o Root Directory vazio e o Framework Preset como "Other".

### MetaMask na Sepolia

1. Na MetaMask, ativar a opção de mostrar redes de teste e escolher Sepolia (Chain ID 11155111).
2. Pegar SepoliaETH num faucet.
3. Ter duas contas: a que fez o deploy (seguradora) e outra para o segurado.

## 7. Deploy do contrato (Remix)

1. Abrir https://remix.ethereum.org e criar `SeguroChain.sol` com o conteúdo do arquivo do repositório.
2. Solidity Compiler: versão 0.8.24 ou superior, marcar "Enable optimization" (sem otimização o contrato fica perto do limite de tamanho).
3. Deploy & Run: Environment "Injected Provider - MetaMask", conta da seguradora, rede Sepolia, Deploy.
4. Anotar endereço, hash e bloco do deploy e preencher a seção 3 e o `contrato.js`.
5. Verificar o código no Etherscan (Contract > Verify and Publish) com a mesma versão e otimização usadas no Remix.

## 8. Roteiro de teste

Conta A = seguradora, conta B = segurado.

| # | Conta | Ação | Resultado esperado |
|---|---|---|---|
| 1 | A | Conectar a carteira | Perfil "Seguradora", aparecem as seções da seguradora |
| 2 | A | Trocar a MetaMask para outra rede | Aviso e botão "Trocar para Sepolia" |
| 3 | A | Emitir apólice para B com valor 1 ETH e franquia 0,5 | Erro: franquia acima de 20% |
| 4 | A | Emitir com franquia 0,1, coberturas Colisão e Roubo | Apólice #1 PENDENTE, evento no histórico |
| 5 | B | Conectar e tentar registrar sinistro na apólice #1 | Erro: a apólice precisa estar ATIVA |
| 6 | B | Pagar o prêmio da apólice #1 | MetaMask pede 0,05 ETH; apólice fica ATIVA |
| 7 | B | Registrar sinistro de Colisão de 0,3 ETH | Sinistro #1 EM ANÁLISE |
| 8 | B | Registrar sinistro de Incêndio de 0,2 ETH | Sinistro #2 EM ANÁLISE |
| 9 | A | Analisar #1 e #2 | #1 APROVADO (0,2 ETH); #2 REJEITADO (cobertura não contratada); reserva livre negativa |
| 10 | A | Pagar o sinistro #1 | Erro: saldo insuficiente no contrato |
| 11 | A | Depositar 0,5 ETH e pagar o #1 | B recebe 0,2 ETH (conferir no Etherscan) |
| 12 | A | Sacar 5 ETH | Erro: saldo insuficiente |
| 13 | A | Cancelar a apólice #1 duas vezes | Primeira cancela, segunda dá erro |
| 14 | qualquer | Consultar a apólice #1 | Dados, prêmio e sinistros com motivo |
| 15 | qualquer | Histórico de eventos | Todos os passos acima, com link para o Etherscan |

## 9. Limitações e melhorias futuras

- O estado `EXPIRADA` não é usado: uma apólice vencida continua ATIVA, mas a análise rejeita sinistros fora da vigência. Falta uma função para marcar a expiração e liberar a placa.
- Valor e data do sinistro são informados pelo segurado e não são verificados por uma fonte externa (laudo, boletim de ocorrência).
- Só existe uma seguradora (`owner` imutável).
- As datas usam `block.timestamp`.
- O histórico de eventos depende do `DEPLOY_BLOCK` e do limite de consulta do RPC da MetaMask.
- Melhorias: renovação de apólice, devolução proporcional do prêmio no cancelamento, atualização em tempo real dos eventos.

## 10. Uso de ferramentas de IA

(Preencher pela equipe, indicando em que partes foram usadas.)

## Estrutura do repositório

```
SeguroChain/
├── segurochain-dapp/
│   ├── contracts/SeguroChain.sol
│   ├── frontend/
│   │   ├── index.html
│   │   ├── style.css
│   │   ├── app.js
│   │   └── contrato.js
│   └── docs/
│       ├── slides.pdf
│       └── prints/
├── dApp/          exemplo do professor (Mural de Mensagens)
├── seguroApp/     projeto Java do primeiro trabalho
├── package.json   script `dev` para servir o frontend localmente
├── vercel.json
└── README.md
```
