import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
type TicketCard = { id: string; title: string; description: string; status: string; sla: { response: string; resolution: string } };

const query = `query Tickets { tickets(first: 30) { nodes { id title description status createdAt sla { response resolution } } } }`;
function App() {
  const [token, setToken] = useState(localStorage.getItem('token') ?? ''); const [email, setEmail] = useState('agent@example.com'); const [password, setPassword] = useState('password'); const [tickets, setTickets] = useState<TicketCard[]>([]);
  async function login() { const body = { query: `mutation { login(email: "${email}", password: "${password}") { token } }` }; const r = await fetch('/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const t = (await r.json()).data.login.token; localStorage.setItem('token', t); setToken(t); }
  async function load() { const r = await fetch('/graphql', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ query }) }); setTickets((await r.json()).data.tickets.nodes); }
  return <main><header><span className="eyebrow">BURDENOFF / OPERATIONS</span><h1>Keep every promise.</h1><p>Support work, measured in business hours.</p></header>{!token ? <section className="card login"><h2>Sign in</h2><input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" /><input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" /><button onClick={login}>Enter workspace</button></section> : <section><button onClick={load}>Refresh queue</button><div className="grid">{tickets.map(t => <article className="card" key={t.id}><div className="row"><strong>{t.title}</strong><span className={`pill ${t.status.toLowerCase()}`}>{t.status}</span></div><p>{t.description}</p><small>Response <b>{t.sla.response}</b> · Resolution <b>{t.sla.resolution}</b></small></article>)}</div></section>}</main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
