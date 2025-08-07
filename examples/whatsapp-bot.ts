import makeWASocket, { useMultiFileAuthState } from 'baileys';
import P from 'pino';
import OpenAI from 'openai';
import path from 'path';

// This example requires the OPENAI_API_KEY environment variable to be set.

// categorías posibles
const CATEGORIES = ['venta', 'alquiler', 'otro'] as const;
type Category = typeof CATEGORIES[number];

// respuestas predeterminadas para cada categoría
const PREDEFINED: Record<Category, { text: string; media: any }> = {
  venta: {
    text: 'Gracias por su interés en nuestra opción de venta.',
    media: {
      image: {
        url: 'https://samplelib.com/lib/preview/jpg/sample-5s.jpg'
      },
      caption: 'Imagen de venta'
    }
  },
  alquiler: {
    text: 'Gracias por consultar por alquiler.',
    media: {
      video: {
        url: 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4'
      },
      caption: 'Video de alquiler'
    }
  },
  otro: {
    text: 'Gracias por contactarnos. En breve responderemos.',
    media: {
      document: {
        url: 'https://samplelib.com/lib/preview/pdf/sample-5s.pdf'
      },
      mimetype: 'application/pdf',
      fileName: 'informacion.pdf'
    }
  }
};

// clasifica el mensaje utilizando OpenAI
async function classifyMessage(text: string): Promise<Category> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  const openai = new OpenAI({ apiKey });
  const response = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: `Clasifica el mensaje como "venta", "alquiler" o "otro": ${text}`
  });
  const output = response.output_text.toLowerCase();
  if (output.includes('venta')) return 'venta';
  if (output.includes('alquiler')) return 'alquiler';
  return 'otro';
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'));
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true
  });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (!body) return;

    const category = await classifyMessage(body);
    const predefined = PREDEFINED[category];

    await sock.sendMessage(msg.key.remoteJid!, { text: predefined.text });
    await sock.sendMessage(msg.key.remoteJid!, predefined.media);
  });
}

startBot().catch(err => console.error('Error al iniciar bot', err));
