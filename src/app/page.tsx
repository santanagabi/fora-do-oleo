"use client";

import { useEffect, useState, type FormEvent } from "react";

const examples = ["frango, limão e farinha", "batata, parmesão e páprica", "banana, aveia e canela"];
const FAVORITES_KEY = "fora-do-oleo:favorites:v1";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; sources?: { title: string; url: string }[]; fallback?: boolean; fallbackAi?: boolean };
type FavoriteRecipe = { id: string; title: string; content: string };

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [favorites, setFavorites] = useState<FavoriteRecipe[]>([]);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [interactionId, setInteractionId] = useState<string>();
  const [error, setError] = useState("");
  const [apiErrorCode, setApiErrorCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FAVORITES_KEY);
      if (saved) setFavorites(JSON.parse(saved) as FavoriteRecipe[]);
    } catch {
      setFavorites([]);
    }
  }, []);

  async function submitPrompt(value: string, forceFallback = false) {
    const nextPrompt = value.trim();
    if (!nextPrompt || isLoading) return;
    setIsLoading(true);
    setError("");
    setApiErrorCode("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: nextPrompt }]);
    setPrompt("");

    try {
      const response = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: nextPrompt, previousInteractionId: interactionId, forceFallback }),
      });
      const result: { reply?: string; interactionId?: string; sources?: { title: string; url: string }[]; error?: string; code?: string; fallback?: boolean; fallbackAi?: boolean; resetConversation?: boolean } = await response.json();
      if (!response.ok) {
        setApiErrorCode(result.code || "");
        throw new Error(result.error || "Não consegui responder agora.");
      }
      if (result.resetConversation) setInteractionId(undefined);
      else if (result.interactionId) setInteractionId(result.interactionId);
      const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: result.reply || "Não consegui montar uma resposta. Pode reformular?", sources: result.sources, fallback: result.fallback, fallbackAi: result.fallbackAi };
      setMessages((current) => [...current, assistantMessage]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Algo deu errado. Tente de novo.");
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitPrompt(prompt);
  }

  async function sendFallbackMessage() {
    await submitPrompt(prompt, true);
  }

  function toggleFavorite(message: ChatMessage) {
    const existing = favorites.some((favorite) => favorite.id === message.id);
    const title = message.content.split("\n").map((line) => line.replace(/^[#*\s-]+/, "").trim()).find(Boolean)?.slice(0, 72) || "Receita da conversa";
    const next = existing
      ? favorites.filter((favorite) => favorite.id !== message.id)
      : [{ id: message.id, title, content: message.content }, ...favorites];
    setFavorites(next);
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Fora do Óleo, início">
          <span className="brand-mark">f.</span>
          <span>fora do óleo</span>
        </a>
        <div className="top-note"><span className="status-dot" /> cozinha experimental <span className="top-note-divider">/</span> projeto de estudo</div>
        <button className="favorites-toggle" type="button" onClick={() => setFavoritesOpen((open) => !open)} aria-expanded={favoritesOpen}>♡ favoritas <span>{favorites.length}</span></button>
        <button className="avatar" aria-label="Informações do projeto" aria-haspopup="dialog" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>G</button>
        {profileOpen && <section className="profile-menu" role="dialog" aria-label="Informações do projeto"><p className="eyebrow"><span>G</span> SEU ESPAÇO</p><p>Projeto local, sem login. As favoritas ficam salvas neste navegador e abrir uma delas não chama a IA.</p><div className="profile-integrations"><span>MODELO</span> Gemini API <i>·</i> <span>FERRAMENTAS</span> MCP</div><button type="button" onClick={() => { setFavoritesOpen(true); setProfileOpen(false); }}>Ver minhas favoritas <span>↗</span></button></section>}
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span>01</span> SUA BANCADA, SUAS REGRAS</p>
          <h1>O que tem aí<br />vira <em>jantar.</em></h1>
          <p className="hero-description">Conte o que tem na geladeira. A gente encontra um caminho crocante, sem complicar a sua noite.</p>
          <div className="hero-footnote"><span className="sparkle">✳</span> feito para a vida real — e para a air fryer</div>
        </div>
        <div className="hero-art" aria-label="Ilustração de batata dourada saindo da air fryer" role="img">
          <div className="art-sun" />
          <div className="art-caption">CROCÂNCIA<br />SEM DRAMA</div>
          <div className="airfryer">
            <div className="fryer-top"><span /></div>
            <div className="fryer-body"><div className="fryer-window"><div className="fry fry-one"/><div className="fry fry-two"/><div className="fry fry-three"/><div className="fry fry-four"/><div className="fry fry-five"/><span className="herb herb-one">✳</span><span className="herb herb-two">✳</span></div><div className="fryer-controls"><span/><span/><span/></div></div>
            <div className="fryer-handle" />
          </div>
          <span className="art-doodle doodle-one">✳</span><span className="art-doodle doodle-two">✦</span><span className="art-doodle doodle-three">· · ·</span>
          <div className="art-label">nº 001 <span>•</span> receitas de improviso</div>
        </div>
      </section>

      <section className="workspace" aria-labelledby="form-title">
        <div className="workspace-heading">
          <div><p className="eyebrow"><span>02</span> VAMOS DE DESPENSA</p><h2 id="form-title">O que você tem?</h2></div>
          <p className="section-aside">Pode ser ingrediente, vontade<br />ou o que precisa acabar logo.</p>
        </div>
        <form onSubmit={sendMessage} className="recipe-form">
          <label className="sr-only" htmlFor="prompt">Peça uma receita ou ajuste algo da conversa</label>
          <textarea id="prompt" value={prompt} onChange={(event) => { setPrompt(event.target.value); setError(""); }} placeholder={messages.length ? "Ex.: não tenho açúcar; substitua e ajuste as quantidades…" : "Ex.: pesquise uma receita de frango na air fryer com limão…"} rows={2} />
          <div className="form-bottom">
            <span className="input-hint"><span className="hint-icon">↳</span> continue ajustando: troca, quantidade, temperatura, ponto…</span>
            <div className="form-actions"><button className="fallback-button" type="button" onClick={sendFallbackMessage} disabled={isLoading || !prompt.trim()}>Testar sem IA</button><button className="submit-button" type="submit" disabled={isLoading}>{isLoading ? "Pesquisando e pensando…" : messages.length ? "Enviar ajuste" : "Pesquisar receita"} <span aria-hidden="true">{isLoading ? "···" : "↗"}</span></button></div>
          </div>
        </form>
        <div className="suggestions"><span className="suggestions-label">EXPERIMENTE</span>{examples.map((example) => <button key={example} type="button" onClick={() => { setPrompt(example); setError(""); }}>{example}<span>↗</span></button>)}</div>
      </section>

      {favoritesOpen && <section className="favorites-panel" aria-label="Receitas favoritas">
        <div className="favorites-heading"><div><p className="eyebrow"><span>♡</span> SUA COLEÇÃO</p><h2>Receitas favoritas</h2></div><button type="button" className="close-favorites" onClick={() => setFavoritesOpen(false)}>Fechar ×</button></div>
        {favorites.length === 0 ? <p className="empty-favorites">Suas receitas salvas aparecem aqui. Toque em “Salvar receita” numa resposta para guardá-la.</p> : <div className="favorite-list">{favorites.map((favorite) => <details className="favorite-item" key={favorite.id}><summary>{favorite.title}<span>ver receita ↘</span></summary><p>{favorite.content}</p><button type="button" onClick={() => toggleFavorite({ ...favorite, role: "assistant" })}>Remover das favoritas</button></details>)}</div>}
        <p className="favorites-note">Salvas neste navegador, sem conta ou sincronização.</p>
      </section>}

      {error && <div className="error-message" role="alert"><strong>{error}</strong>{apiErrorCode === "MISSING_API_KEY" && <div className="key-setup"><span>Crie uma chave no <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio ↗</a>, depois coloque em <code>.env.local</code> na pasta do projeto:</span><code>GEMINI_API_KEY=sua_chave_aqui</code><span>Reinicie o servidor com <code>npm run dev</code>. Não cole a chave no chat.</span></div>}{apiErrorCode === "QUOTA_EXCEEDED" && <div className="key-setup"><span>Confira o uso e os limites do projeto no <a href="https://aistudio.google.com/rate-limit" target="_blank" rel="noreferrer">painel de limites do AI Studio ↗</a>. Se o limite for temporário, aguarde e tente novamente.</span></div>}{apiErrorCode === "API_ACCESS_DENIED" && <div className="key-setup"><span>Confira se a chave e o projeto corretos estão selecionados no <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio ↗</a>.</span></div>}</div>}
      {messages.length > 0 && <section className="recipe-result conversation" aria-live="polite" aria-label="Conversa sobre receitas">
        <div className="result-kicker"><span className="result-star">✳</span> UMA IDEIA PRA HOJE <span className="result-line" /></div>
        <div className="message-list">{messages.map((message) => <article className={`chat-message ${message.role}`} key={message.id}><div className="message-meta">{message.role === "user" ? "VOCÊ" : message.fallbackAi ? "FORA DO ÓLEO · GEMINI LEVE + FONTE PÚBLICA" : message.fallback ? "FORA DO ÓLEO · RECEITA DE RESERVA" : "FORA DO ÓLEO · GEMINI + MCP"}</div><p>{message.content}</p>{message.role === "assistant" && <button type="button" className="save-recipe" onClick={() => toggleFavorite(message)}>{favorites.some((favorite) => favorite.id === message.id) ? "♥ Salva nas favoritas" : "♡ Salvar receita"}</button>}{message.sources && message.sources.length > 0 && <div className="source-list"><span>FONTES CONSULTADAS</span>{message.sources.map((source) => <a href={source.url} key={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div>}</article>)}{isLoading && <article className="chat-message assistant"><div className="message-meta">FORA DO ÓLEO · GEMINI + MCP</div><p className="thinking">Pesquisando a receita e conferindo as medidas<span>···</span></p></article>}</div>
      </section>}

      <footer className="footer"><span>F.O. <span className="footer-dot">•</span> LABORATÓRIO DE RECEITAS</span><span>uma pitada de IA, sem complicar.</span><span className="footer-right">BRASIL <span>↗</span></span></footer>
    </main>
  );
}
