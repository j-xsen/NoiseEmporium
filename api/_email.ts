import { Resend } from 'resend'

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({ from: 'Noise Emporium <noreply@jxsen.com>', to, subject, html })
}
