function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return entities[character]!;
    });
}

export function renderUnsubscribeEmailFooter(url: string): string {
    return `<div style="padding:24px 20px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#555555;">You're receiving this because you subscribed to a HackIllinois mailing list.<br /><a href="${escapeHtml(
        url,
    )}" style="color:#168277;text-decoration:underline;">Unsubscribe from this mailing list</a></div>`;
}

export function renderUnsubscribePage(
    state: "confirm" | "success" | "invalid" | "error",
    token?: string,
    emailAddress?: string,
): string {
    let heading = "Unsubscribe from this mailing list?";
    let content = `<p>Confirm that you'd like to stop receiving these HackIllinois newsletter emails at <strong>${escapeHtml(
        emailAddress ?? "",
    )}</strong>.</p>
        <form method="post" action="/newsletter/unsubscribe/?token=${escapeHtml(
            token ?? "",
        )}"><button type="submit">Unsubscribe</button></form>`;
    if (state === "success") {
        heading = "You're unsubscribed";
        content = "<p>You won't receive future emails from this mailing list.</p>";
    } else if (state === "invalid") {
        heading = "This link isn't valid";
        content = "<p>Please use the unsubscribe link in a recent HackIllinois newsletter.</p>";
    } else if (state === "error") {
        heading = "We couldn't unsubscribe you";
        content = `<p>Please try again in a moment.</p><form method="post" action="/newsletter/unsubscribe/?token=${escapeHtml(
            token ?? "",
        )}"><button type="submit">Try again</button></form>`;
    }
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex,nofollow" /><title>${escapeHtml(
        heading,
    )} | HackIllinois</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#edf7f5;color:#183b36;font-family:Arial,Helvetica,sans-serif;line-height:1.6}
main{width:100%;max-width:520px;padding:40px;background:white;border:1px solid #c4e3dd;border-radius:20px;box-shadow:0 12px 40px #183b3610}
.brand{margin:0 0 24px;color:#168277;font-size:14px;font-weight:bold;letter-spacing:2px}h1{font-size:30px;line-height:1.2;margin:0 0 20px}p{margin:0 0 24px}strong{overflow-wrap:anywhere}
button{width:100%;padding:14px 24px;border:0;border-radius:10px;background:#168277;color:white;font:inherit;font-weight:bold;cursor:pointer}button:hover{background:#11685f}button:focus-visible{outline:3px solid #fba036;outline-offset:3px}
.note{margin:24px 0 0;font-size:14px;color:#506762}a{color:#168277}@media(max-width:480px){main{padding:28px 24px}h1{font-size:26px}}
</style></head><body><main><p class="brand">HACKILLINOIS</p><h1>${escapeHtml(
        heading,
    )}</h1>${content}<p class="note">Registration and event logistics emails are unaffected.</p><p class="note">Need help? <a href="mailto:contact@hackillinois.org">Contact us</a>.</p></main></body></html>`;
}
