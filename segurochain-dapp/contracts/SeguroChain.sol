// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SeguroChain
/// @notice Contrato de seguro veicular na rede Sepolia.
///         A seguradora é quem faz o deploy (owner).
contract SeguroChain {

    // ENUMERAÇÕES

    enum TipoCobertura { COLISAO, ROUBO, INCENDIO }

    enum StatusApolice { PENDENTE, ATIVA, CANCELADA, EXPIRADA }

    enum StatusSinistro { EM_ANALISE, APROVADO, REJEITADO, PAGO }

    // STRUCTS

    struct Apolice {
        uint256 id;
        address proprietario;
        string  modelo;
        string  placa;
        uint256 ano;
        uint256 valorSegurado;      // em wei
        uint256 franquia;           // em wei
        uint256 dataInicio;         // timestamp
        uint256 dataFim;            // timestamp
        bool[3] coberturas;         // [0]=COLISAO, [1]=ROUBO, [2]=INCENDIO
        uint256 valorComprometido;
        StatusApolice status;
    }

    struct Sinistro {
        uint256 id;
        uint256 apoliceId;
        TipoCobertura  tipo;
        uint256 valorSolicitado;
        uint256 data;
        StatusSinistro status;
        string  motivo;
        uint256 franquiaAplicada;
        uint256 valorIndenizacao;
    }

    // VARIÁVEIS DE ESTADO

    address public owner;

    uint256 public totalApolices;

    uint256 public totalSinistros;

    mapping(uint256 => Apolice) public apolices;

    mapping(uint256 => Sinistro) public sinistros;

    // EVENTOS

    event ApoliceEmitida(
        uint256 id,
        address proprietario,
        string  modelo,
        string  placa,
        uint256 valorSegurado
    );

    event SinistroRegistrado(
        uint256 id,
        uint256 apoliceId,
        TipoCobertura tipo,
        uint256 valorSolicitado,
        uint256 data
    );

    event SinistroAnalisado(
        uint256 id,
        uint256 apoliceId,
        bool    aprovado,
        uint256 franquiaAplicada,
        uint256 valorIndenizacao,
        string  motivo
    );

    event SinistroPago(uint256 id, uint256 valorPago);

    // MODIFIERS

    modifier apenasOwner() {
        require(msg.sender == owner, "Apenas a seguradora pode executar esta acao");
        _;
    }

    // CONSTRUTOR

    constructor() {
        owner = msg.sender;
    }

    // FUNÇÕES DA SEGURADORA — APÓLICES

    function emitirApolice(
        address _proprietario,
        string  calldata _modelo,
        string  calldata _placa,
        uint256 _ano,
        uint256 _valorSegurado,
        uint256 _franquia,
        uint256 _dataInicio,
        uint256 _dataFim,
        bool[3] calldata _coberturas
    )
        external
        apenasOwner
        returns (uint256)
    {
        require(_proprietario != address(0), "Proprietario invalido");
        require(bytes(_modelo).length > 0,   "Modelo obrigatorio");
        require(bytes(_placa).length > 0,    "Placa obrigatoria");
        require(_valorSegurado > 0,          "Valor segurado deve ser maior que zero");
        require(_dataFim > _dataInicio,      "Data fim deve ser posterior a data inicio");

        uint256 novoId = totalApolices + 1;
        totalApolices  = novoId;

        apolices[novoId] = Apolice({
            id:                novoId,
            proprietario:      _proprietario,
            modelo:            _modelo,
            placa:             _placa,
            ano:               _ano,
            valorSegurado:     _valorSegurado,
            franquia:          _franquia,
            dataInicio:        _dataInicio,
            dataFim:           _dataFim,
            coberturas:        _coberturas,
            valorComprometido: 0,
            status:            StatusApolice.ATIVA
        });

        emit ApoliceEmitida(novoId, _proprietario, _modelo, _placa, _valorSegurado);

        return novoId;
    }

    function ativarApolice(uint256 _id) external apenasOwner {
        require(
            apolices[_id].status == StatusApolice.PENDENTE,
            "Apenas apolices PENDENTE podem ser ativadas"
        );
        apolices[_id].status = StatusApolice.ATIVA;
    }

    function cancelarApolice(uint256 _id) external apenasOwner {
        require(
            apolices[_id].status == StatusApolice.ATIVA ||
            apolices[_id].status == StatusApolice.PENDENTE,
            "Apolice nao pode ser cancelada neste estado"
        );
        apolices[_id].status = StatusApolice.CANCELADA;
    }

    // FUNÇÕES DE CONSULTA — APÓLICES

    function consultarApolice(uint256 _id)
        external
        view
        returns (Apolice memory)
    {
        return apolices[_id];
    }

    /// @notice saldo = valorSegurado - valorComprometido
    function saldoDisponivel(uint256 _id) external view returns (uint256) {
        Apolice storage a = apolices[_id];
        return a.valorSegurado - a.valorComprometido;
    }

    function estaVigente(uint256 _id, uint256 _data) public view returns (bool) {
        Apolice storage a = apolices[_id];
        return (_data >= a.dataInicio && _data < a.dataFim);
    }

    // FUNÇÕES DO SEGURADO — SINISTROS

    /// @dev TODO: qualquer carteira consegue registrar sinistro na apólice dos
    ///      outros. Restringir ao proprietario da apólice.
    function registrarSinistro(
        uint256 _apoliceId,
        TipoCobertura _tipo,
        uint256 _valorSolicitado,
        uint256 _data
    )
        external
        returns (uint256)
    {
        require(_valorSolicitado > 0, "Valor solicitado deve ser maior que zero");
        require(_data > 0,            "Data do sinistro invalida");

        uint256 novoId = totalSinistros + 1;
        totalSinistros = novoId;

        sinistros[novoId] = Sinistro({
            id:               novoId,
            apoliceId:        _apoliceId,
            tipo:             _tipo,
            valorSolicitado:  _valorSolicitado,
            data:             _data,
            status:           StatusSinistro.EM_ANALISE,
            motivo:           "",
            franquiaAplicada: 0,
            valorIndenizacao: 0
        });

        emit SinistroRegistrado(novoId, _apoliceId, _tipo, _valorSolicitado, _data);

        return novoId;
    }

    // FUNÇÕES DA SEGURADORA — SINISTROS

    // --- TODO: dá pra chamar analisarSinistro várias vezes no mesmo sinistro
    //     e o valorComprometido da apólice vai somando. Bloquear se já analisado. ---
    function analisarSinistro(uint256 _id)
        external
        apenasOwner
        returns (
            bool    aprovado,
            uint256 franquiaAplicada,
            uint256 valorIndenizacao,
            string memory motivo
        )
    {
        Sinistro storage s = sinistros[_id];
        Apolice  storage a = apolices[s.apoliceId];

        // --- Regra 1: vigência ---
        if (!estaVigente(s.apoliceId, s.data)) {
            motivo   = "Apolice nao estava vigente na data do sinistro";
            s.status = StatusSinistro.REJEITADO;
            s.motivo = motivo;
            emit SinistroAnalisado(_id, s.apoliceId, false, 0, 0, motivo);
            return (false, 0, 0, motivo);
        }

        // --- Regra 2: cobertura ---
        if (!a.coberturas[uint256(s.tipo)]) {
            motivo   = "Cobertura nao contratada";
            s.status = StatusSinistro.REJEITADO;
            s.motivo = motivo;
            emit SinistroAnalisado(_id, s.apoliceId, false, 0, 0, motivo);
            return (false, 0, 0, motivo);
        }

        // --- Regra 3: franquia ---
        bool perdaTotal = s.valorSolicitado > (a.valorSegurado * 75) / 100;
        bool isRoubo    = (s.tipo == TipoCobertura.ROUBO);

        if (isRoubo || perdaTotal) {
            franquiaAplicada = 0;
        } else {
            franquiaAplicada = a.franquia;
        }

        valorIndenizacao = s.valorSolicitado - franquiaAplicada;

        // --- Aprovado ---
        motivo = "Aprovado";

        s.status            = StatusSinistro.APROVADO;
        s.motivo            = motivo;
        s.franquiaAplicada  = franquiaAplicada;
        s.valorIndenizacao  = valorIndenizacao;
        a.valorComprometido += valorIndenizacao;

        emit SinistroAnalisado(_id, s.apoliceId, true, franquiaAplicada, valorIndenizacao, motivo);
        return (true, franquiaAplicada, valorIndenizacao, motivo);
    }

    function pagarSinistro(uint256 _id) external apenasOwner {
        Sinistro storage s = sinistros[_id];
        require(s.status == StatusSinistro.APROVADO, "Sinistro deve estar APROVADO para ser pago");

        s.status = StatusSinistro.PAGO;

        emit SinistroPago(_id, s.valorIndenizacao);
    }
}
