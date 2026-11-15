import { put, list, del } from '@vercel/blob';

const PREFIXO = 'calendars/';
const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

export default async function handler(req, res) {
  try {
    // Qualquer pessoa pode LER (listar e abrir).
    if (req.method === 'GET') {
      const id = slug(req.query.id);
      const { blobs } = await list({ prefix: PREFIXO });
      if (!id) {
        return res.status(200).json(
          blobs.map((b) => ({
            id: b.pathname.slice(PREFIXO.length).replace(/\.json$/, ''),
            atualizado: b.uploadedAt,
          }))
        );
      }
      const b = blobs.find((x) => x.pathname === `${PREFIXO}${id}.json`);
      if (!b) return res.status(404).json({ erro: 'Calendário não encontrado.' });
      const r = await fetch(b.url);
      return res.status(200).json(await r.json());
    }

    // Só quem tem a senha pode SALVAR ou EXCLUIR.
    const senha = process.env.EDIT_PASSWORD;
    if (!senha || req.headers['x-senha'] !== senha) {
      return res.status(401).json({ erro: 'Senha de edição incorreta.' });
    }

    if (req.method === 'POST') {
      const { nome, dados } = req.body || {};
      const id = slug(nome);
      if (!id || !dados) return res.status(400).json({ erro: 'Informe nome e dados.' });
      await put(`${PREFIXO}${id}.json`, JSON.stringify(dados), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
      });
      return res.status(200).json({ id });
    }

    if (req.method === 'DELETE') {
      const id = slug(req.query.id);
      const { blobs } = await list({ prefix: PREFIXO });
      const b = blobs.find((x) => x.pathname === `${PREFIXO}${id}.json`);
      if (b) await del(b.url);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ erro: 'Método não permitido.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: 'Erro no servidor.' });
  }
}
