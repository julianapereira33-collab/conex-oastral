const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function sanitize(text) {
  return String(text || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/gu, '')
    .replace(/[^\x00-\xFF]/g, '');
}

async function gerarPdfMapa({ primeiroNome, mapaTexto }) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28, PAGE_H = 841.89, MARGIN = 50;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const COLOR_INDIGO = rgb(0.388, 0.4, 0.945);
  const COLOR_PURPLE = rgb(0.545, 0.361, 0.965);
  const COLOR_PINK = rgb(0.925, 0.286, 0.6);
  const COLOR_TEXT = rgb(0.118, 0.161, 0.231);
  const COLOR_MUTED = rgb(0.4, 0.455, 0.545);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y;

  function addFooter(p) {
    p.drawText('Conexao Astral  -  conexaoastral.com.br', { x: MARGIN, y: 28, size: 8, font: fontRegular, color: COLOR_MUTED });
  }

  function addHeaderBand(p) {
    p.drawRectangle({ x: 0, y: PAGE_H - 120, width: PAGE_W, height: 120, color: COLOR_INDIGO });
    p.drawText('CONEXAO ASTRAL', { x: MARGIN, y: PAGE_H - 58, size: 24, font: fontBold, color: rgb(1, 1, 1) });
    p.drawText(sanitize('Mapa Astral & Numerologico Completo'), { x: MARGIN, y: PAGE_H - 82, size: 11, font: fontRegular, color: rgb(0.9, 0.9, 1) });
  }

  addHeaderBand(page);
  addFooter(page);
  y = PAGE_H - 150;

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    addFooter(page);
    y = PAGE_H - MARGIN;
  }
  function ensureSpace(h) { if (y - h < 55) newPage(); }

  function wrapPlain(text, { size, font, color, lineHeight }) {
    const words = sanitize(text).split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(test, size) > CONTENT_W && line) {
        ensureSpace(lineHeight);
        page.drawText(line, { x: MARGIN, y, size, font, color });
        y -= lineHeight;
        line = word;
      } else line = test;
    }
    if (line) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: MARGIN, y, size, font, color });
      y -= lineHeight;
    }
  }

  function drawParagraph(raw) {
    const size = 10.5, lineHeight = 15.5;
    const parts = sanitize(raw).split(/(\*\*.*?\*\*)/g).filter(Boolean);
    let x = MARGIN;
    ensureSpace(lineHeight);
    for (let part of parts) {
      let bold = false, txt = part;
      if (/^\*\*.*\*\*$/.test(part)) { bold = true; txt = part.slice(2, -2); }
      const font = bold ? fontBold : fontRegular;
      const words = txt.split(/(\s+)/);
      for (const w of words) {
        if (w === '') continue;
        const ww = font.widthOfTextAtSize(w, size);
        if (x + ww > MARGIN + CONTENT_W) { y -= lineHeight; x = MARGIN; ensureSpace(lineHeight); }
        page.drawText(w, { x, y, size, font, color: COLOR_TEXT });
        x += ww;
      }
    }
    y -= lineHeight + 6;
  }

  function drawHeading(text, level) {
    const clean = sanitize(text.replace(/\*\*/g, ''));
    const size = level === 1 ? 17 : level === 2 ? 13.5 : 11.5;
    const color = level === 1 ? COLOR_INDIGO : level === 2 ? COLOR_PURPLE : COLOR_PINK;
    ensureSpace(size + 22);
    y -= 10;
    wrapPlain(clean, { size, font: fontBold, color, lineHeight: size + 4 });
    if (level <= 2) {
      ensureSpace(8);
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.75, color: rgb(0.88, 0.88, 0.95) });
      y -= 10;
    } else y -= 4;
  }

  function drawDivider() {
    ensureSpace(20);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 1, color: COLOR_PURPLE });
    y -= 16;
  }

  wrapPlain(`Ola, ${primeiroNome}!`, { size: 14, font: fontBold, color: COLOR_INDIGO, lineHeight: 20 });
  y -= 6;

  const lines = String(mapaTexto || '').replace(/\r\n/g, '\n').split('\n');
  let buf = [];
  const flush = () => { if (buf.length) { drawParagraph(buf.join(' ')); buf = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') { flush(); continue; }
    if (/^###\s+/.test(line)) { flush(); drawHeading(line.replace(/^###\s+/, ''), 3); continue; }
    if (/^##\s+/.test(line)) { flush(); drawHeading(line.replace(/^##\s+/, ''), 2); continue; }
    if (/^#\s+/.test(line)) { flush(); drawHeading(line.replace(/^#\s+/, ''), 1); continue; }
    if (/^---+$/.test(line)) { flush(); drawDivider(); continue; }
    buf.push(line);
  }
  flush();

  return Buffer.from(await pdfDoc.save());
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { nome, primeiroNome, email, mapaTexto, enviarEmail = true } = req.body || {};
    if (!mapaTexto) return res.status(400).json({ error: 'mapaTexto e obrigatorio' });

    const nomeExibicao = primeiroNome || (nome || 'Cliente').split(' ')[0];
    const pdfBuffer = await gerarPdfMapa({ primeiroNome: nomeExibicao, mapaTexto });
    const pdfBase64 = pdfBuffer.toString('base64');
    const fileName = `Mapa-Astral-${String(nomeExibicao).replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;

    let emailEnviado = false;
    let emailErro = null;
    if (enviarEmail && email && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'Conexão Astral <noreply@conexaoastral.com.br>',
          to: email,
          subject: `${nomeExibicao}, seu Mapa Astral e Numerológico completo chegou`,
          html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
            <h2 style="color:#6366f1">Olá, ${nomeExibicao}!</h2>
            <p style="color:#334155;line-height:1.7">Seu Mapa Astral e Numerológico completo está pronto. Abra o PDF em anexo para ler sua análise completa.</p>
            <p style="color:#64748b;font-size:13px">Não achou este e-mail na caixa de entrada? Confira também a pasta de Spam/Lixo Eletrônico e marque como "não é spam".</p>
          </div>`,
          attachments: [{ filename: fileName, content: pdfBase64 }]
        });
        emailEnviado = true;
      } catch (err) {
        emailErro = String((err && err.message) || err);
        console.error('Resend error:', err);
      }
    }

    res.status(200).json({ success: true, emailEnviado, emailErro, pdfBase64, fileName });
  } catch (err) {
    console.error('gerar/enviar mapa error:', err);
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
