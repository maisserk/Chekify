type VercelRequest = { method?: string };
type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  if (!publicKey) {
    return res.status(503).json({ error: 'Push notifications are not configured on the server' });
  }
  return res.status(200).json({ publicKey });
}
