$(document).ready(function () {
    cardapio.eventos.init();
})

var cardapio = {};

var MEU_CARRINHO = [];
var MEU_ENDERECO = null;

var VALOR_CARRINHO = 0;
var VALOR_ENTREGA = 7.5;

var CARRINHO_STORAGE_KEY = 'maknas-carrinho-v1';
var ENDERECO_STORAGE_KEY = 'maknas-endereco-v1';
var LIMITE_ITEM_CARRINHO = 99;

var CELULAR_EMPRESA = '82999627481';
var CELULAR_EMPRESA_WA = `55${CELULAR_EMPRESA}`;

cardapio.eventos = {

    init: () => {
        cardapio.metodos.carregarEstadoSalvo();
        cardapio.metodos.obterItensCardapio();
        cardapio.metodos.atualizarBadgeTotal();
        cardapio.metodos.carregarBotaoLigar();
        cardapio.metodos.carregarBotaoReserva();
        cardapio.metodos.vincularEventos();
    }

}

cardapio.metodos = {

    // formata valores no padrão brasileiro
    formatarMoeda: (valor) => {
        return Number(valor || 0).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    },

    // recupera apenas itens válidos do catálogo e ignora preços adulterados no navegador
    carregarEstadoSalvo: () => {
        try {
            let carrinhoSalvo = JSON.parse(localStorage.getItem(CARRINHO_STORAGE_KEY) || '[]');
            let catalogo = {};

            $.each(MENU, (categoria, itens) => {
                $.each(itens, (i, item) => {
                    catalogo[item.id] = item;
                });
            });

            if (Array.isArray(carrinhoSalvo)) {
                MEU_CARRINHO = carrinhoSalvo
                    .filter(item => catalogo[item.id] && Number(item.qntd) > 0)
                    .map(item => Object.assign({}, catalogo[item.id], {
                        qntd: Math.min(parseInt(item.qntd), LIMITE_ITEM_CARRINHO)
                    }));
            }

            let enderecoSalvo = JSON.parse(localStorage.getItem(ENDERECO_STORAGE_KEY) || 'null');
            if (enderecoSalvo && typeof enderecoSalvo === 'object') {
                MEU_ENDERECO = enderecoSalvo;
            }
        }
        catch (erro) {
            MEU_CARRINHO = [];
            MEU_ENDERECO = null;
        }
    },

    salvarEstado: () => {
        try {
            let carrinhoParaSalvar = MEU_CARRINHO.map(item => ({
                id: item.id,
                qntd: item.qntd
            }));

            localStorage.setItem(CARRINHO_STORAGE_KEY, JSON.stringify(carrinhoParaSalvar));

            if (MEU_ENDERECO) {
                localStorage.setItem(ENDERECO_STORAGE_KEY, JSON.stringify(MEU_ENDERECO));
            }
        }
        catch (erro) {
            // O pedido continua funcionando mesmo se o navegador bloquear o localStorage.
        }
    },

    vincularEventos: () => {
        $(document).on('keydown', (evento) => {
            if (evento.key === 'Escape' && !$('#modalCarrinho').hasClass('hidden')) {
                cardapio.metodos.abrirCarrinho(false);
            }
        });

        $('#txtCEP').on('input', function () {
            let cep = $(this).val().replace(/\D/g, '').slice(0, 8);
            if (cep.length > 5) {
                cep = `${cep.slice(0, 5)}-${cep.slice(5)}`;
            }
            $(this).val(cep);
        });
    },

    preencherEnderecoSalvo: () => {
        if (!MEU_ENDERECO) return;

        $('#txtCEP').val(MEU_ENDERECO.cep || '');
        $('#txtEndereco').val(MEU_ENDERECO.endereco || '');
        $('#txtBairro').val(MEU_ENDERECO.bairro || '');
        $('#txtCidade').val(MEU_ENDERECO.cidade || '');
        $('#ddlUf').val(MEU_ENDERECO.uf || '-1');
        $('#txtNumero').val(MEU_ENDERECO.numero || '');
        $('#txtComplemento').val(MEU_ENDERECO.complemento || '');
    },

    // obtem a lista de itens do cardápio
    obterItensCardapio: (categoria = 'burgers', vermais = false) => {

        var filtro = MENU[categoria];
        if (!vermais) {
            $("#itensCardapio").html('');
            $("#btnVerMais").removeClass('hidden');
        }

        $.each(filtro, (i, e) => {

            let temp = cardapio.templates.item.replace(/\${img}/g, e.img)
            .replace(/\${nome}/g, e.name)
            .replace(/\${preco}/g, cardapio.metodos.formatarMoeda(e.price))
            .replace(/\${id}/g, e.id)

            // botão ver mais foi clicado (12 itens)
            if (vermais && i >= 8 && i < 12) {
                $("#itensCardapio").append(temp)
            }

            // paginação inicial (8 itens)
            if (!vermais && i < 8) {
                $("#itensCardapio").append(temp)
            }

        })

        // remove o ativo
        $(".container-menu a").removeClass('active');

        // seta o menu para ativo
        $("#menu-" + categoria).addClass('active');

        cardapio.metodos.sincronizarControlesCardapio();

    },

    // clique no botão de ver mais
    verMais: () => {

        var ativo = $(".container-menu a.active").attr('id').split('menu-')[1];
        cardapio.metodos.obterItensCardapio(ativo, true);

        $("#btnVerMais").addClass('hidden');

    },

    // localiza o produto em qualquer categoria do catálogo
    obterProdutoPorId: (id) => {
        let produto = null;

        $.each(MENU, (categoria, itens) => {
            let encontrado = itens.find(item => item.id === id);
            if (encontrado) {
                produto = encontrado;
                return false;
            }
        });

        return produto;
    },

    // alterna entre o botão "Adicionar" e o seletor do item já incluído
    sincronizarControlesCardapio: () => {
        $(".card-item").each(function () {
            let id = $(this).attr('data-produto-id');
            let itemCarrinho = MEU_CARRINHO.find(item => item.id === id);
            let quantidade = itemCarrinho ? itemCarrinho.qntd : 0;

            $(this).find('.btn-adicionar-produto').toggleClass('hidden', quantidade > 0);
            $(this).find('.controle-quantidade-card').toggleClass('hidden', quantidade <= 0);
            $(this).find('.quantidade-card').text(quantidade);
        });
    },

    // primeiro clique adiciona uma unidade imediatamente
    adicionarAoCarrinho: (id) => {
        let produto = cardapio.metodos.obterProdutoPorId(id);
        if (!produto) return;

        let objIndex = MEU_CARRINHO.findIndex(item => item.id === id);

        if (objIndex >= 0) {
            MEU_CARRINHO[objIndex].qntd = Math.min(MEU_CARRINHO[objIndex].qntd + 1, LIMITE_ITEM_CARRINHO);
        }
        else {
            MEU_CARRINHO.push(Object.assign({}, produto, { qntd: 1 }));
        }

        cardapio.metodos.salvarEstado();
        cardapio.metodos.atualizarBadgeTotal();
        cardapio.metodos.sincronizarControlesCardapio();
        cardapio.metodos.mensagem('Adicionado ao carrinho', 'green', 1800);
    },

    // altera diretamente a quantidade do produto que já está no carrinho
    alterarQuantidadeCardapio: (id, variacao) => {
        let objIndex = MEU_CARRINHO.findIndex(item => item.id === id);
        if (objIndex < 0) return;

        let novaQuantidade = MEU_CARRINHO[objIndex].qntd + variacao;

        if (novaQuantidade <= 0) {
            MEU_CARRINHO.splice(objIndex, 1);
        }
        else {
            MEU_CARRINHO[objIndex].qntd = Math.min(novaQuantidade, LIMITE_ITEM_CARRINHO);
        }

        cardapio.metodos.salvarEstado();
        cardapio.metodos.atualizarBadgeTotal();
        cardapio.metodos.sincronizarControlesCardapio();
    },

    diminuirQuantidade: (id) => {
        cardapio.metodos.alterarQuantidadeCardapio(id, -1);
    },

    aumentarQuantidade: (id) => {
        cardapio.metodos.alterarQuantidadeCardapio(id, 1);
    },

    // atualiza o badge de totais dos botões "Meu carrinho"
    atualizarBadgeTotal: () => {

        var total = 0;

        $.each(MEU_CARRINHO, (i, e) => {
            total += Number(e.qntd) || 0;
        })

        if (total > 0) {
            $(".botao-carrinho").removeClass('hidden');
            $(".container-total-carrinho").removeClass('hidden');
        }
        else {
            $(".botao-carrinho").addClass('hidden')
            $(".container-total-carrinho").addClass('hidden');
        }

        $(".badge-total-carrinho").html(total);
        $("#btnLimparCarrinho").toggleClass('hidden', total <= 0);
        $("#btnEtapaPedido").toggleClass('disabled', total <= 0).attr('aria-disabled', total <= 0);

    },

    // abrir a modal de carrinho
    abrirCarrinho: (abrir) => {

        if (abrir) {
            $("#modalCarrinho").removeClass('hidden').attr('aria-hidden', 'false');
            $("body").addClass('carrinho-aberto');
            cardapio.metodos.carregarCarrinho();
            setTimeout(() => $("#modalCarrinho .btn-fechar-carrinho").focus(), 80);
        }
        else {
            $("#modalCarrinho").addClass('hidden').attr('aria-hidden', 'true');
            $("body").removeClass('carrinho-aberto');
        }

    },

    // altera os texto e exibe os botões das etapas
    carregarEtapa: (etapa) => {

        if (etapa == 1) {
            $("#lblTituloEtapa").text('Seu carrinho:');
            $("#itensCarrinho").removeClass('hidden');
            $("#localEntrega").addClass('hidden');
            $("#resumoCarrinho").addClass('hidden');

            $(".etapa").removeClass('active');
            $(".etapa1").addClass('active');

            $("#btnEtapaPedido").removeClass('hidden');
            $("#btnEtapaEndereco").addClass('hidden');
            $("#btnEtapaResumo").addClass('hidden');
            $("#btnVoltar").addClass('hidden');
        }
        
        if (etapa == 2) {
            $("#lblTituloEtapa").text('Endereço de entrega:');
            $("#itensCarrinho").addClass('hidden');
            $("#localEntrega").removeClass('hidden');
            $("#resumoCarrinho").addClass('hidden');

            $(".etapa").removeClass('active');
            $(".etapa1").addClass('active');
            $(".etapa2").addClass('active');

            $("#btnEtapaPedido").addClass('hidden');
            $("#btnEtapaEndereco").removeClass('hidden');
            $("#btnEtapaResumo").addClass('hidden');
            $("#btnVoltar").removeClass('hidden');
        }

        if (etapa == 3) {
            $("#lblTituloEtapa").text('Resumo do pedido:');
            $("#itensCarrinho").addClass('hidden');
            $("#localEntrega").addClass('hidden');
            $("#resumoCarrinho").removeClass('hidden');

            $(".etapa").removeClass('active');
            $(".etapa1").addClass('active');
            $(".etapa2").addClass('active');
            $(".etapa3").addClass('active');

            $("#btnEtapaPedido").addClass('hidden');
            $("#btnEtapaEndereco").addClass('hidden');
            $("#btnEtapaResumo").removeClass('hidden');
            $("#btnVoltar").removeClass('hidden');
        }

        $("#modalCarrinho").attr('data-etapa', etapa);

    },

    // botão de voltar etapa
    voltarEtapa: () => {

        let etapa = $(".etapa.active").length;
        cardapio.metodos.carregarEtapa(etapa - 1);

    },

    // carrega a lista de itens do carrinho
    carregarCarrinho: () => {

        cardapio.metodos.carregarEtapa(1);
        $("#itensCarrinho").html('');

        if (MEU_CARRINHO.length > 0) {

            $.each(MEU_CARRINHO, (i, e) => {

                let temp = cardapio.templates.itemCarrinho.replace(/\${img}/g, e.img)
                .replace(/\${nome}/g, e.name)
                .replace(/\${preco}/g, cardapio.metodos.formatarMoeda(e.price))
                .replace(/\${subtotal}/g, cardapio.metodos.formatarMoeda(e.price * e.qntd))
                .replace(/\${id}/g, e.id)
                .replace(/\${qntd}/g, e.qntd)

                $("#itensCarrinho").append(temp);

            })

        }
        else {
            $("#itensCarrinho").html('<p class="carrinho-vazio"><i class="fa fa-shopping-bag"></i> Seu carrinho está vazio.</p>');
        }

        cardapio.metodos.carregarValores();
        cardapio.metodos.atualizarBadgeTotal();

    },

    // diminuir quantidade do item no carrinho
    diminuirQuantidadeCarrinho: (id) => {

        let qntdAtual = parseInt($("#qntd-carrinho-" + id).text()) || 0;

        if (qntdAtual > 1) {
            $("#qntd-carrinho-" + id).text(qntdAtual - 1);
            cardapio.metodos.atualizarCarrinho(id, qntdAtual - 1);
        }
        else {
            cardapio.metodos.removerItemCarrinho(id)
        }

    },

    // aumentar quantidade do item no carrinho
    aumentarQuantidadeCarrinho: (id) => {

        let qntdAtual = parseInt($("#qntd-carrinho-" + id).text()) || 0;
        let novaQuantidade = Math.min(qntdAtual + 1, LIMITE_ITEM_CARRINHO);
        $("#qntd-carrinho-" + id).text(novaQuantidade);
        cardapio.metodos.atualizarCarrinho(id, novaQuantidade);

    },

    // botão remover item do carrinho
    removerItemCarrinho: (id) => {

        MEU_CARRINHO = $.grep(MEU_CARRINHO, (e, i) => { return e.id != id });
        cardapio.metodos.salvarEstado();
        cardapio.metodos.carregarCarrinho();

        // atualiza o botão carrinho com a quantidade atualizada
        cardapio.metodos.atualizarBadgeTotal();
        cardapio.metodos.sincronizarControlesCardapio();
        
    },

    // atualiza o carrinho com a quantidade atual
    atualizarCarrinho: (id, qntd) => {

        let objIndex = MEU_CARRINHO.findIndex((obj => obj.id == id));

        if (objIndex < 0) return;

        MEU_CARRINHO[objIndex].qntd = Math.max(1, Math.min(qntd, LIMITE_ITEM_CARRINHO));

        cardapio.metodos.salvarEstado();

        // atualiza o botão carrinho com a quantidade atualizada
        cardapio.metodos.atualizarBadgeTotal();

        // atualiza os valores (R$) totais do carrinho
        cardapio.metodos.carregarValores();
        cardapio.metodos.sincronizarControlesCardapio();

    },

    // carrega os valores de SubTotal, Entrega e Total
    carregarValores: () => {

        VALOR_CARRINHO = MEU_CARRINHO.reduce((total, item) => {
            return total + (Number(item.price) * Number(item.qntd));
        }, 0);

        let entrega = MEU_CARRINHO.length > 0 ? VALOR_ENTREGA : 0;

        $("#lblSubTotal").text(cardapio.metodos.formatarMoeda(VALOR_CARRINHO));
        $("#lblValorEntrega").text(`+ ${cardapio.metodos.formatarMoeda(entrega)}`);
        $("#lblValorTotal").text(cardapio.metodos.formatarMoeda(VALOR_CARRINHO + entrega));

        $.each(MEU_CARRINHO, (i, item) => {
            $("#subtotal-carrinho-" + item.id).text(cardapio.metodos.formatarMoeda(item.price * item.qntd));
        });

    },

    // remove todos os produtos após confirmação
    limparCarrinho: () => {
        if (MEU_CARRINHO.length <= 0) return;

        if (!window.confirm('Deseja remover todos os itens do carrinho?')) return;

        MEU_CARRINHO = [];
        MEU_ENDERECO = null;
        try {
            localStorage.removeItem(CARRINHO_STORAGE_KEY);
            localStorage.removeItem(ENDERECO_STORAGE_KEY);
        }
        catch (erro) {
            // O carrinho em memória ainda é limpo normalmente.
        }
        cardapio.metodos.carregarCarrinho();
        cardapio.metodos.sincronizarControlesCardapio();
        cardapio.metodos.mensagem('Carrinho limpo.');
    },

    // carregar a etapa enderecos
    carregarEndereco: () => {

        if (MEU_CARRINHO.length <= 0) {
            cardapio.metodos.mensagem('Seu carrinho está vazio.')
            return;
        } 

        cardapio.metodos.preencherEnderecoSalvo();
        cardapio.metodos.carregarEtapa(2);

    },

    // API ViaCEP
    buscarCep: async () => {
        let cep = $("#txtCEP").val().trim().replace(/\D/g, '');
        let $botao = $("#btnBuscarCep");

        if (!/^[0-9]{8}$/.test(cep)) {
            cardapio.metodos.mensagem(cep ? 'Formato do CEP inválido.' : 'Informe o CEP, por favor.');
            $("#txtCEP").focus();
            return;
        }

        $botao.addClass('loading').attr('aria-busy', 'true');
        $botao.find('i').attr('class', 'fa fa-spinner fa-spin');

        try {
            let resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (!resposta.ok) throw new Error('Falha ao consultar o CEP');

            let dados = await resposta.json();

            if (dados.erro) {
                cardapio.metodos.mensagem('CEP não encontrado. Preencha o endereço manualmente.');
                $("#txtEndereco").focus();
                return;
            }

            $("#txtCEP").val(`${cep.slice(0, 5)}-${cep.slice(5)}`);
            $("#txtEndereco").val(dados.logradouro || '');
            $("#txtBairro").val(dados.bairro || '');
            $("#txtCidade").val(dados.localidade || '');
            $("#ddlUf").val(dados.uf || '-1');
            $("#txtNumero").focus();
            cardapio.metodos.mensagem('Endereço encontrado.', 'green', 2200);
        }
        catch (erro) {
            cardapio.metodos.mensagem('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
            $("#txtEndereco").focus();
        }
        finally {
            $botao.removeClass('loading').removeAttr('aria-busy');
            $botao.find('i').attr('class', 'fa fa-search');
        }
    },

    // validação antes de prosseguir para a etapa 3
    resumoPedido: () => {

        let cep = $("#txtCEP").val().trim();
        let cepNumerico = cep.replace(/\D/g, '');
        let endereco = $("#txtEndereco").val().trim();
        let bairro = $("#txtBairro").val().trim();
        let cidade = $("#txtCidade").val().trim();
        let uf = ($("#ddlUf").val() || '-1').trim();
        let numero = $("#txtNumero").val().trim();
        let complemento = $("#txtComplemento").val().trim();

        if (!/^[0-9]{8}$/.test(cepNumerico)) {
            cardapio.metodos.mensagem(cepNumerico ? 'Informe um CEP válido.' : 'Informe o CEP, por favor.');
            $("#txtCEP").focus();
            return;
        }

        if (endereco.length <= 0) {
            cardapio.metodos.mensagem('Informe o Endereço, por favor.');
            $("#txtEndereco").focus();
            return;
        }

        if (bairro.length <= 0) {
            cardapio.metodos.mensagem('Informe o Bairro, por favor.');
            $("#txtBairro").focus();
            return;
        }

        if (cidade.length <= 0) {
            cardapio.metodos.mensagem('Informe a Cidade, por favor.');
            $("#txtCidade").focus();
            return;
        }

        if (uf == "-1") {
            cardapio.metodos.mensagem('Informe a UF, por favor.');
            $("#ddlUf").focus();
            return;
        }

        if (numero.length <= 0) {
            cardapio.metodos.mensagem('Informe o Número, por favor.');
            $("#txtNumero").focus();
            return;
        }

        MEU_ENDERECO = {
            cep: `${cepNumerico.slice(0, 5)}-${cepNumerico.slice(5)}`,
            endereco: endereco,
            bairro: bairro,
            cidade: cidade,
            uf: uf,
            numero: numero,
            complemento: complemento
        }

        cardapio.metodos.salvarEstado();
        cardapio.metodos.carregarEtapa(3);
        cardapio.metodos.carregarResumo();

    },

    // carrega a etapa de Resumo do pedido
    carregarResumo: () => {

        $("#listaItensResumo").html('');

        $.each(MEU_CARRINHO, (i, e) => {

            let temp = cardapio.templates.itemResumo.replace(/\${img}/g, e.img)
                .replace(/\${nome}/g, e.name)
                .replace(/\${preco}/g, cardapio.metodos.formatarMoeda(e.price))
                .replace(/\${subtotal}/g, cardapio.metodos.formatarMoeda(e.price * e.qntd))
                .replace(/\${qntd}/g, e.qntd)

            $("#listaItensResumo").append(temp);

        });

        $("#resumoEndereco").text(`${MEU_ENDERECO.endereco}, ${MEU_ENDERECO.numero}, ${MEU_ENDERECO.bairro}`);
        $("#cidadeEndereco").text(
            `${MEU_ENDERECO.cidade}-${MEU_ENDERECO.uf} / ${MEU_ENDERECO.cep}${MEU_ENDERECO.complemento ? ` · ${MEU_ENDERECO.complemento}` : ''}`
        );

        cardapio.metodos.finalizarPedido();

    },

    // Atualiza o link do botão do WhatsApp
    finalizarPedido: () => {

        if (MEU_CARRINHO.length > 0 && MEU_ENDERECO != null) {
            cardapio.metodos.carregarValores();

            let itens = MEU_CARRINHO.map(item => {
                let subtotal = cardapio.metodos.formatarMoeda(item.price * item.qntd);
                return `• *${item.qntd}x* ${item.name} — ${subtotal}`;
            }).join('\n');

            let texto = `Olá! Gostaria de fazer um pedido na *Makna's Burguer* 🔥`;
            texto += `\n\n*Itens do pedido:*\n${itens}`;
            texto += `\n\n*Subtotal:* ${cardapio.metodos.formatarMoeda(VALOR_CARRINHO)}`;
            texto += `\n*Entrega:* ${cardapio.metodos.formatarMoeda(VALOR_ENTREGA)}`;
            texto += `\n*Total:* ${cardapio.metodos.formatarMoeda(VALOR_CARRINHO + VALOR_ENTREGA)}`;
            texto += '\n\n*Endereço de entrega:*';
            texto += `\n${MEU_ENDERECO.endereco}, ${MEU_ENDERECO.numero} — ${MEU_ENDERECO.bairro}`;
            texto += `\n${MEU_ENDERECO.cidade}-${MEU_ENDERECO.uf} · CEP ${MEU_ENDERECO.cep}`;

            if (MEU_ENDERECO.complemento) {
                texto += `\nComplemento: ${MEU_ENDERECO.complemento}`;
            }

            let URL = `https://wa.me/${CELULAR_EMPRESA_WA}?text=${encodeURIComponent(texto)}`;
            $("#btnEtapaResumo").attr('href', URL);

        }

    },

    // carrega o link do botão reserva
    carregarBotaoReserva: () => {

        var texto = 'Olá! gostaria de fazer uma *reserva*';

        let encode = encodeURI(texto);
        let URL = `https://wa.me/${CELULAR_EMPRESA_WA}?text=${encode}`;

        $("#btnReserva").attr('href', URL);

    },

    // carrega o botão de ligar
    carregarBotaoLigar: () => {

        $("#btnLigar").attr('href', `tel:${CELULAR_EMPRESA}`);

    },

    // abre/fecha o mini menu do WhatsApp flutuante
    alternarMiniWhatsapp: () => {
        $("#whatsappMiniMenu").toggleClass('hidden');

        if (!$("#whatsappMiniMenu").hasClass('hidden')) {
            $("#txtWppNome").focus();
        }
    },

    // fecha o mini menu do WhatsApp
    fecharMiniWhatsapp: () => {
        $("#whatsappMiniMenu").addClass('hidden');
    },

    // valida e envia os dados para o WhatsApp
    enviarMiniWhatsapp: () => {

        let nome = $("#txtWppNome").val().trim();
        let email = $("#txtWppEmail").val().trim();
        let numero = $("#txtWppNumero").val().trim();
        let numeroLimpo = numero.replace(/\D/g, '');

        if (nome.length < 2) {
            cardapio.metodos.mensagem('Informe seu nome.');
            $("#txtWppNome").focus();
            return;
        }

        if (email.length <= 0 || email.indexOf('@') < 0) {
            cardapio.metodos.mensagem('Informe um e-mail válido.');
            $("#txtWppEmail").focus();
            return;
        }

        if (numeroLimpo.length < 10) {
            cardapio.metodos.mensagem('Informe um WhatsApp válido.');
            $("#txtWppNumero").focus();
            return;
        }

        var texto = 'Olá! Quero atendimento.';
        texto += `\n*Nome:* ${nome}`;
        texto += `\n*E-mail:* ${email}`;
        texto += `\n*WhatsApp:* ${numero}`;

        let encode = encodeURI(texto);
        let URL = `https://wa.me/${CELULAR_EMPRESA_WA}?text=${encode}`;

        window.open(URL, '_blank');
        cardapio.metodos.fecharMiniWhatsapp();

    },

    // abre o depoimento
    abrirDepoimento: (depoimento) => {

        $("#depoimento-1").addClass('hidden');
        $("#depoimento-2").addClass('hidden');
        $("#depoimento-3").addClass('hidden');

        $("#btnDepoimento-1").removeClass('active');
        $("#btnDepoimento-2").removeClass('active');
        $("#btnDepoimento-3").removeClass('active');

        $("#depoimento-" + depoimento).removeClass('hidden');
        $("#btnDepoimento-" + depoimento).addClass('active');

    },

    // mensagens
    mensagem: (texto, cor = 'red', tempo = 3500) => {

        let id = Math.floor(Date.now() * Math.random()).toString();

        let msg = `<div id="msg-${id}" class="animated fadeInDown toast ${cor}">${texto}</div>`;

        $("#container-mensagens").append(msg);

        setTimeout(() => {
            $("#msg-" + id).removeClass('fadeInDown');
            $("#msg-" + id).addClass('fadeOutUp');
            setTimeout(() => {
                $("#msg-" + id).remove();
            }, 800);
        }, tempo)

    }

}

cardapio.templates = {

    item: `
        <div class="col-12 col-lg-3 col-md-3 col-sm-6 mb-5 animated fadeInUp">
            <div class="card card-item" id="\${id}" data-produto-id="\${id}">
                <div class="img-produto">
                    <img src="\${img}" alt="\${nome}" loading="lazy" />
                </div>
                <p class="title-produto text-center mt-4">
                    <b>\${nome}</b>
                </p>
                <p class="price-produto text-center">
                    <b>\${preco}</b>
                </p>
                <div class="add-carrinho">
                    <button type="button" class="btn btn-add btn-adicionar-produto" onclick="cardapio.metodos.adicionarAoCarrinho('\${id}')">
                        <i class="fa fa-shopping-bag"></i> Adicionar
                    </button>
                    <div class="controle-quantidade-card hidden" aria-label="Quantidade no carrinho">
                        <button type="button" class="btn-menos" aria-label="Remover uma unidade" onclick="cardapio.metodos.diminuirQuantidade('\${id}')"><i class="fas fa-minus"></i></button>
                        <span class="add-numero-itens quantidade-card" aria-live="polite">0</span>
                        <button type="button" class="btn-mais" aria-label="Adicionar mais uma unidade" onclick="cardapio.metodos.aumentarQuantidade('\${id}')"><i class="fas fa-plus"></i></button>
                    </div>
                </div>
            </div>
        </div>
    `,

    itemCarrinho: `
        <div class="col-12 item-carrinho">
            <div class="img-produto">
                <img src="\${img}" alt="\${nome}" />
            </div>
            <div class="dados-produto">
                <p class="title-produto"><b>\${nome}</b></p>
                <p class="price-produto cart-price-detail">
                    <span>\${preco} cada</span>
                    <b id="subtotal-carrinho-\${id}">\${subtotal}</b>
                </p>
            </div>
            <div class="add-carrinho">
                <button type="button" class="btn-menos" aria-label="Diminuir quantidade de \${nome}" onclick="cardapio.metodos.diminuirQuantidadeCarrinho('\${id}')"><i class="fas fa-minus"></i></button>
                <span class="add-numero-itens" id="qntd-carrinho-\${id}">\${qntd}</span>
                <button type="button" class="btn-mais" aria-label="Aumentar quantidade de \${nome}" onclick="cardapio.metodos.aumentarQuantidadeCarrinho('\${id}')"><i class="fas fa-plus"></i></button>
                <button type="button" class="btn btn-remove" aria-label="Remover \${nome}" title="Remover item" onclick="cardapio.metodos.removerItemCarrinho('\${id}')"><i class="fa fa-trash"></i></button>
            </div>
        </div>
    `,

    itemResumo: `
        <div class="col-12 item-carrinho resumo">
            <div class="img-produto-resumo">
                <img src="\${img}" alt="\${nome}" />
            </div>
            <div class="dados-produto">
                <p class="title-produto-resumo">
                    <b>\${nome}</b>
                </p>
                <p class="price-produto-resumo">
                    <span>\${preco} cada</span>
                    <b>\${subtotal}</b>
                </p>
            </div>
            <p class="quantidade-produto-resumo">
                x <b>\${qntd}</b>
            </p>
        </div>
    `

}
