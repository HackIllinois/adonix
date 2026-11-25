import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";
import Handlebars from "handlebars";
import { Templates } from "../../common/config";
import { escapeHtml } from "../../common/html";

const TEMPLATE_DIR = join(__dirname, "..", "..", "..", "templates", Templates.REGISTRATION_SUBMISSION);
const CHALLENGE_URL = "https://register.hackillinois.org/challenge/description";
const HOSTILE_NAME = `<a href="https://evil.example">O'Brien</a> & co`;

function read(file: string): string {
    return readFileSync(join(TEMPLATE_DIR, file), "utf-8");
}

/** Renders like SES, which runs Handlebars without HTML-escaping template data. */
function render(file: string, pro: boolean, name = "Ada"): string {
    const data = { name, nameHtml: escapeHtml(name), pro };
    return Handlebars.compile(read(file), { noEscape: true, strict: true })(data);
}

describe("registration confirmation template", () => {
    it("is the 2027 template", () => {
        expect(Templates.REGISTRATION_SUBMISSION).toBe("2027_registration_confirmation");
        const metadata = JSON.parse(read("metadata.json")) as { Subject: string };
        expect(metadata.Subject).toContain("HackIllinois 2027");
    });

    it.each(["body.html", "body.txt"])("%s thanks the applicant and says status updates are coming", (file) => {
        for (const pro of [true, false]) {
            const body = render(file, pro);
            expect(body).toContain("Howdy Ada,");
            expect(body).toContain("Thank you for registering for");
            expect(body).toContain("in touch about the status of your application");
        }
    });

    it.each(["body.html", "body.txt"])("%s shows the Saloon Rush challenge only to Pro applicants", (file) => {
        if (file === "body.html") {
            expect(render(file, true)).toMatch(new RegExp(`<a href="${CHALLENGE_URL}"[^>]*>Start Saloon Rush</a>`));
        }
        expect(render(file, true)).toContain(CHALLENGE_URL);
        expect(render(file, true)).toContain("Saloon Rush");
        expect(render(file, false)).not.toContain(CHALLENGE_URL);
        expect(render(file, false)).not.toContain("Saloon Rush");
    });

    it("escapes the applicant's name in the HTML body", () => {
        const html = render("body.html", false, HOSTILE_NAME);
        expect(html).not.toContain('evil.example">');
        expect(html).toContain("Howdy &lt;a href=&quot;https://evil.example&quot;&gt;O&#39;Brien&lt;/a&gt; &amp; co,");
    });

    it("keeps the applicant's name verbatim in the text body", () => {
        expect(render("body.txt", false, HOSTILE_NAME)).toContain(`Howdy ${HOSTILE_NAME},`);
    });

    it("loads the 2027 artwork from the admin site", () => {
        const sources = [...read("body.html").matchAll(/<img[^>]+src="([^"]+)"/g)].map(([, src]) => src);
        expect(sources).toEqual([
            "https://admin.hackillinois.org/email/header-2027.png",
            "https://admin.hackillinois.org/email/assets/2027/horse_divider.png",
            "https://admin.hackillinois.org/email/footer-2027.png",
        ]);
    });
});
