export type NotificationChannel = "email" | "sms";

export interface NotificationTarget {
	userId: string;
	email?: string | null;
	phone?: string | null;
}

export interface NotificationMessage {
	subject: string;
	bodyText: string;
}

async function sendEmailResend(to: string, message: NotificationMessage): Promise<void> {
	const apiKey = import.meta.env.VITE_RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
	const from = import.meta.env.VITE_RESEND_FROM || process.env.VITE_RESEND_FROM || "noreply@localhost";
	if (!apiKey) return; // no-op if not configured
	await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			from,
			to,
			subject: message.subject,
			html: message.bodyText.replace(/\n/g, "<br/>")
		}),
	});
}

async function sendSmsTwilio(to: string, message: string): Promise<void> {
	const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID || process.env.VITE_TWILIO_ACCOUNT_SID;
	const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN || process.env.VITE_TWILIO_AUTH_TOKEN;
	const from = import.meta.env.VITE_TWILIO_FROM || process.env.VITE_TWILIO_FROM;
	if (!accountSid || !authToken || !from) return; // no-op if not configured
	const body = new URLSearchParams();
	body.set("From", from);
	body.set("To", to);
	body.set("Body", message);
	await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
		},
		body,
	});
}

export async function sendNotification(target: NotificationTarget, message: NotificationMessage): Promise<void> {
	const tasks: Promise<void>[] = [];
	if (target.email) tasks.push(sendEmailResend(target.email, message));
	if (target.phone) tasks.push(sendSmsTwilio(target.phone, message.bodyText));
	await Promise.allSettled(tasks);
}


