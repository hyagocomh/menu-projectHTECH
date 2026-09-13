"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { categories, menu, type CategoryId, type Product } from "@/lib/catalog";
import { brl } from "@/lib/money";
import { CartModal, type CartLine } from "@/components/checkout/CartModal";

type StorefrontProps = {
  mapsApiKey: string;
  mapsMapId: string;
  whatsappNumber: string;
};

type Toast = { id: number; message: string; kind: "red" | "green" };
type Testimonial = {
  name: string;
  image: string;
  rating: string;
  stars: string;
  text: string;
};

const testimonials: Testimonial[] = [
  {
    name: "Diego Pereira",
    image: "/img/diego.jpg",
    rating: "4.5",
    stars: "★★★★½",
    text: "Burger suculento, montagem caprichada e um molho da casa incrível. A Makna's virou meu pedido oficial do fim de semana.",
  },
  {
    name: "Ana Beatriz",
    image: "/img/ana.jpg",
    rating: "5.0",
    stars: "★★★★★",
    text: "Tudo chegou muito bem embalado e ainda quente. Dá para sentir o sabor da brasa em cada mordida. Experiência impecável.",
  },
  {
    name: "João Guilherme",
    image: "/img/joao.jpg",
    rating: "4.0",
    stars: "★★★★☆",
    text: "O ponto da carne veio perfeito e o atendimento foi super atencioso. Já indiquei para todo mundo — vale cada mordida.",
  },
];

const CART_KEY = "maknas-carrinho-v2";
const LEGACY_CART_KEY = "maknas-carrinho-v1";
const MAX_QUANTITY = 99;

export function Storefront({ mapsApiKey, mapsMapId, whatsappNumber }: StorefrontProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("burgers");
  const [showAll, setShowAll] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappForm, setWhatsappForm] = useState({ name: "", email: "", phone: "" });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const toastId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const currentCart = localStorage.getItem(CART_KEY);
        const legacyCart = localStorage.getItem(LEGACY_CART_KEY);
        const parsed = JSON.parse(currentCart ?? legacyCart ?? "{}") as
          | Record<string, number>
          | Array<{ id?: string; qntd?: number; quantity?: number }>;
        const saved = Array.isArray(parsed)
          ? Object.fromEntries(parsed.flatMap((item) => {
              const quantity = item.quantity ?? item.qntd;
              return item.id && Number.isInteger(quantity) && Number(quantity) > 0
                ? [[item.id, Number(quantity)]]
                : [];
            }))
          : parsed;
        const valid = Object.fromEntries(
          Object.entries(saved).filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0),
        );
        setCart(valid);
        if (!currentCart && legacyCart) localStorage.removeItem(LEGACY_CART_KEY);
      } catch {
        setCart({});
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // O carrinho continua em memória se o navegador bloquear localStorage.
    }
  }, [cart, hydrated]);

  useEffect(() => {
    document.body.classList.toggle("carrinho-aberto", cartOpen);
    return () => document.body.classList.remove("carrinho-aberto");
  }, [cartOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const catalogIndex = useMemo(() => {
    const index = new Map<string, Product>();
    Object.values(menu).flat().forEach((product) => index.set(product.id, product));
    return index;
  }, []);

  const cartItems = useMemo<CartLine[]>(() =>
    Object.entries(cart).flatMap(([id, quantity]) => {
      const product = catalogIndex.get(id);
      return product ? [{ ...product, quantity }] : [];
    }), [cart, catalogIndex]);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const notify = (message: string, kind: "red" | "green" = "red") => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  };

  const changeQuantity = (productId: string, quantity: number) => {
    const nextQuantity = Math.min(MAX_QUANTITY, Math.max(0, quantity));
    setCart((current) => {
      const next = { ...current };
      if (nextQuantity === 0) delete next[productId];
      else next[productId] = nextQuantity;
      return next;
    });
  };

  const addProduct = (product: Product) => {
    changeQuantity(product.id, (cart[product.id] ?? 0) + 1);
    notify(`${product.name} foi para a sacola.`, "green");
  };

  const selectCategory = (category: CategoryId) => {
    setActiveCategory(category);
    setShowAll(false);
  };

  const sendSupportWhatsapp = () => {
    if (whatsappForm.name.trim().length < 2) {
      notify("Informe seu nome.");
      return;
    }
    if (!whatsappForm.email.includes("@")) {
      notify("Informe um e-mail válido.");
      return;
    }
    if (whatsappForm.phone.replace(/\D/g, "").length < 10) {
      notify("Informe um WhatsApp válido.");
      return;
    }
    const text = [
      "Olá! Quero atendimento.",
      `Nome: ${whatsappForm.name}`,
      `E-mail: ${whatsappForm.email}`,
      `WhatsApp: ${whatsappForm.phone}`,
    ].join("\n");
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    setWhatsappOpen(false);
  };

  const products = showAll ? menu[activeCategory] : menu[activeCategory].slice(0, 8);
  const testimonial = testimonials[testimonialIndex];
  const reservationUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Olá! Gostaria de fazer uma reserva na Makna's Burguer.")}`;

  return (
    <>
      <div className="container-mensagens" aria-live="polite">
        {toasts.map((toast) => <div key={toast.id} className={`animated fadeInDown toast ${toast.kind}`}>{toast.message}</div>)}
      </div>

      {cartCount > 0 && (
        <button className="botao-carrinho animated bounceIn" type="button" onClick={() => setCartOpen(true)} aria-label={`Abrir sacola com ${cartCount} itens`}>
          <span className="badge-total-carrinho">{cartCount}</span>
          <i className="fa fa-shopping-bag" />
        </button>
      )}

      <div className="whatsapp-widget">
        {whatsappOpen && (
          <div className="whatsapp-mini-menu animated fadeIn">
            <div className="whatsapp-mini-header">
              <div><p className="whatsapp-mini-title"><b>Atendimento</b></p><p className="whatsapp-mini-status">Online agora</p></div>
              <button className="whatsapp-mini-close" type="button" onClick={() => setWhatsappOpen(false)} aria-label="Fechar atendimento"><i className="fa fa-times" /></button>
            </div>
            <div className="whatsapp-mini-body">
              <p className="whatsapp-mini-text">Oi! Para agilizar seu atendimento, preencha os dados abaixo.</p>
              <div className="whatsapp-mini-form">
                <input className="form-control form-control-mini" placeholder="Seu nome" value={whatsappForm.name} onChange={(event) => setWhatsappForm({ ...whatsappForm, name: event.target.value })} />
                <input className="form-control form-control-mini" type="email" placeholder="Seu e-mail" value={whatsappForm.email} onChange={(event) => setWhatsappForm({ ...whatsappForm, email: event.target.value })} />
                <input className="form-control form-control-mini" placeholder="WhatsApp" value={whatsappForm.phone} onChange={(event) => setWhatsappForm({ ...whatsappForm, phone: event.target.value })} />
                <button className="btn btn-whatsapp-enviar" type="button" onClick={sendSupportWhatsapp}>Ir para WhatsApp <i className="fab fa-whatsapp" /></button>
              </div>
            </div>
          </div>
        )}
        <button className="whatsapp-trigger" type="button" onClick={() => setWhatsappOpen((value) => !value)} aria-label="Atendimento pelo WhatsApp"><i className="fab fa-whatsapp" /></button>
      </div>

      <header className="header">
        <div className="container">
          <nav className="navbar navbar-expand-lg pl-0 pr-0 col-one">
            <a className="navbar-brand" href="#inicio" aria-label="Makna's Burguer - início">
              <Image src="/img/logo-maknas.png" className="img-logo" width={122} height={122} priority alt="Logo Makna's Burguer" />
            </a>
            <button className="navbar-toggler" type="button" aria-label="Abrir menu" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((value) => !value)}>
              <span className="navbar-toggler-icon"><i className={`fas ${mobileMenuOpen ? "fa-times" : "fa-bars"}`} /></span>
            </button>
            <div className={`collapse navbar-collapse ${mobileMenuOpen ? "show" : ""}`}>
              <ul className="navbar-nav ml-auto mr-auto">
                <li className="nav-item"><a href="#servicos" className="nav-link" onClick={() => setMobileMenuOpen(false)}><b>A experiência</b></a></li>
                <li className="nav-item"><a href="#cardapio" className="nav-link" onClick={() => setMobileMenuOpen(false)}><b>Cardápio</b></a></li>
                <li className="nav-item"><a href="#depoimentos" className="nav-link" onClick={() => setMobileMenuOpen(false)}><b>Depoimentos</b></a></li>
                <li className="nav-item"><a href="#reservas" className="nav-link" onClick={() => setMobileMenuOpen(false)}><b>Reservas</b></a></li>
              </ul>
              <button className="btn btn-white btn-icon" type="button" onClick={() => setCartOpen(true)}>
                Meu pedido <span className="icon">{cartCount > 0 && <span className="container-total-carrinho badge-total-carrinho">{cartCount}</span>}<i className="fa fa-shopping-bag" /></span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main>
        <section className="banner" id="inicio">
          <div className="container">
            <div className="row">
              <div className="col-12 col-lg-6 col-md-6 col-sm-12 col-one">
                <div className="d-flex text-banner">
                  <span className="hero-kicker">2026 <i /> feito na brasa</span>
                  <h1>Brasa alta.<br /><span className="color-primary">Sabor de verdade.</span></h1>
                  <p>Burgers artesanais, ingredientes selecionados e aquele sabor marcante que só a Makna&apos;s tem.</p>
                  <div>
                    <a href="#cardapio" className="btn btn-yellow mt-4 mr-3">Explorar cardápio <i className="fas fa-arrow-right" /></a>
                    <a href="tel:82999627481" className="btn btn-white btn-icon-left mt-4"><span className="icon-left"><i className="fa fa-phone" /></span>(82) 99962-7481</a>
                  </div>
                  <div className="hero-proof">
                    <span><i className="fas fa-fire" /> Burger na brasa</span>
                    <span><i className="fas fa-star" /> Ingredientes frescos</span>
                    <span><i className="fas fa-motorcycle" /> Entrega calculada</span>
                  </div>
                </div>
                <a href="https://www.instagram.com/hyagotech/" target="_blank" rel="noreferrer" className="btn btn-sm btn-white btn-social mt-4 mr-3"><i className="fab fa-instagram" /></a>
                <a href="#" className="btn btn-sm btn-white btn-social mt-4 mr-3" aria-label="Facebook"><i className="fab fa-facebook-f" /></a>
                <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-white btn-social mt-4" aria-label="WhatsApp"><i className="fab fa-whatsapp" /></a>
              </div>
              <div className="col-6 no-mobile hero-visual">
                <div className="card-banner" />
                <div className="d-flex img-banner"><Image src="/img/logo-maknas.png" width={550} height={550} priority alt="Emblema Makna's Burguer" /></div>
                <div className="card card-case"><span className="case-stars">★★★★★</span>“Chegou quente, suculento e com sabor de brasa de verdade.”<span className="card-case-name"><b>Thiago Lopes</b></span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="servicos" id="servicos">
          <div className="background-servicos" />
          <div className="container"><div className="row">
            <div className="col-12 col-one text-center mb-5"><span className="hint-title"><b>O jeito Makna&apos;s</b></span><h2 className="title"><b>Da nossa brasa para a sua mesa</b></h2></div>
            {[
              ["01", "fas fa-mobile-alt", "Peça sem complicação", "Escolha seus favoritos e adicione direto na sacola."],
              ["02", "fas fa-route", "Frete pela rota real", "Seu endereço aparece no mapa e a entrega é calculada pela distância."],
              ["03", "fas fa-fire", "Sabor sem atalho", "Ingredientes selecionados e preparo artesanal em cada pedido."],
            ].map(([number, icon, title, text], index) => (
              <div className="col-12 col-lg-4 col-md-4 col-sm-12 col-one mb-5" key={number}>
                <div className={`service-card ${index === 1 ? "featured" : ""}`}><span className="service-number">{number}</span><div className="card-icon text-center"><i className={icon} /></div><div className="card-text text-center mt-3"><p><b>{title}</b></p><span>{text}</span></div></div>
              </div>
            ))}
          </div></div>
        </section>

        <section className="cardapio" id="cardapio">
          <div className="background-cardapio" />
          <div className="container"><div className="row">
            <div className="col-12 col-one text-center mb-5"><span className="hint-title"><b>Escolha seu favorito</b></span><h2 className="title"><b>Cardápio para matar a fome</b></h2></div>
            <div className="col-12 col-one container-menu">
              {categories.map((category) => (
                <button key={category.id} type="button" className={`btn btn-white btn-sm mr-3 ${activeCategory === category.id ? "active" : ""}`} onClick={() => selectCategory(category.id)}>
                  <i className={category.icon} />&nbsp; {category.label}
                </button>
              ))}
            </div>
            <div className="col-12 col-one"><div className="row" id="itensCardapio">
              {products.map((product) => {
                const quantity = cart[product.id] ?? 0;
                return (
                  <div className="col-12 col-lg-3 col-md-3 col-sm-6 mb-5" key={product.id}>
                    <article className="card card-item">
                      <div className="img-produto"><Image src={product.img} width={420} height={320} sizes="(max-width: 767px) 100px, (max-width: 1199px) 22vw, 260px" alt={product.name} /></div>
                      <p className="title-produto text-center mt-4" title={product.name}><b>{product.name}</b></p>
                      <p className="price-produto text-center"><b>{brl.format(product.price)}</b></p>
                      <div className="add-carrinho">
                        {quantity === 0 ? (
                          <button type="button" className="btn btn-add" onClick={() => addProduct(product)}><i className="fa fa-shopping-bag" /> Adicionar</button>
                        ) : (
                          <div className="controle-quantidade-card" aria-label="Quantidade no carrinho">
                            <button type="button" className="btn-menos" aria-label={`Remover uma unidade de ${product.name}`} onClick={() => changeQuantity(product.id, quantity - 1)}><i className="fas fa-minus" /></button>
                            <span className="add-numero-itens quantidade-card" aria-live="polite">{quantity}</span>
                            <button type="button" className="btn-mais" aria-label={`Adicionar outra unidade de ${product.name}`} onClick={() => changeQuantity(product.id, quantity + 1)}><i className="fas fa-plus" /></button>
                          </div>
                        )}
                      </div>
                    </article>
                  </div>
                );
              })}
            </div></div>
            {!showAll && menu[activeCategory].length > 8 && <div className="col-12 col-one text-center"><button type="button" className="btn btn-white btn-sm" id="btnVerMais" onClick={() => setShowAll(true)}>Ver cardápio completo</button></div>}
          </div></div>
        </section>

        <section className="depoimentos" id="depoimentos">
          <div className="background-depoimentos" />
          <div className="container"><div className="row">
            <div className="col-5 no-mobile text-center"><div className="card-depoimentos" /><div className="d-flex img-banner"><Image src="/img/burguer.png" width={600} height={456} alt="Burger artesanal Makna's" /></div></div>
            <div className="col-12 col-lg-7 col-md-7 col-sm-12 col-one">
              <span className="hint-title"><b>Quem prova, recomenda</b></span><h2 className="title"><b>Good food. Good people.</b></h2>
              <div className="mb-5"><div className="depoimento animated fadeIn" key={testimonial.name}>
                <div className="container-dados-depoimento"><Image className="testimonial-image" src={testimonial.image} width={64} height={64} alt={testimonial.name} /><div><p className="nome-depoimento"><b>{testimonial.name}</b></p><p className="nota-depoimento"><span className="stars-text">{testimonial.stars}</span>&nbsp; <span>{testimonial.rating}</span></p></div></div>
                <p className="texto-depoimento"><i className="fas fa-quote-left" /><span>{testimonial.text}</span><i className="fas fa-quote-right" /></p>
              </div></div>
              {testimonials.map((item, index) => <button key={item.name} type="button" className={`btn btn-sm btn-white btn-social mr-3 ${testimonialIndex === index ? "active" : ""}`} onClick={() => setTestimonialIndex(index)}>{index + 1}</button>)}
            </div>
          </div></div>
        </section>

        <section className="reserva" id="reservas"><div className="container"><div className="row"><div className="col-12 col-one">
          <div className="card-secondary"><div className="row"><div className="col-12 col-lg-7 col-md-7 col-sm-12"><span className="hint-title"><b>Vem pra Makna&apos;s</b></span><h2 className="title"><b>Sua mesa. Nossa brasa.</b></h2><p className="pr-5">Reúna sua turma e deixe o resto com a gente. Reserve pelo WhatsApp de forma simples e rápida.</p><a className="btn btn-yellow mt-4" href={reservationUrl} target="_blank" rel="noreferrer">Reservar agora <i className="fab fa-whatsapp" /></a></div><div className="col-5 no-mobile"><div className="card-reserva" /><div className="d-flex img-banner"><Image src="/img/burguer.png" width={600} height={456} alt="Burger Makna's" /></div></div></div></div>
        </div></div></div></section>
      </main>

      <footer><div className="container"><div className="row">
        <div className="col-12 col-lg-3 col-md-3 col-sm-12 col-one container-logo-footer"><Image className="logo-footer" src="/img/logo-maknas.png" width={115} height={115} alt="Makna's Burguer" /></div>
        <div className="col-12 col-lg-6 col-md-6 col-sm-12 col-one container-texto-footer"><p className="mb-0"><b>Makna&apos;s Burguer</b> © 2026 · Good food, good people. · <Link href="/admin">Painel</Link></p></div>
        <div className="col-12 col-lg-3 col-md-3 col-sm-12 col-one container-redes-footer"><a href="https://www.instagram.com/hyagotech/" target="_blank" rel="noreferrer" className="btn btn-sm btn-white btn-social mr-3"><i className="fab fa-instagram" /></a><a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-white btn-social"><i className="fab fa-whatsapp" /></a></div>
      </div></div></footer>

      {cartOpen && <CartModal
        open={cartOpen}
        items={cartItems}
        mapsApiKey={mapsApiKey}
        mapsMapId={mapsMapId}
        whatsappNumber={whatsappNumber}
        onClose={() => setCartOpen(false)}
        onChangeQuantity={changeQuantity}
        onClear={() => setCart({})}
        onOrderCreated={() => setCart({})}
        notify={notify}
      />}
    </>
  );
}
