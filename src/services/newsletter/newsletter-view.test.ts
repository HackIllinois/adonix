import { describe, expect, it } from "@jest/globals";
import { renderUnsubscribeEmailFooter, renderUnsubscribePage } from "./newsletter-view";

describe("unsubscribe HTML", () => {
    it("escapes page content and form attributes", () => {
        const html = renderUnsubscribePage("confirm", '" onmouseover="alert(1)', "<!--/email_off--><script>alert(1)</script>");
        expect(html).not.toContain("<script>");
        expect(html).toContain("<!--email_off-->&lt;!--/email_off--&gt;&lt;script&gt;alert(1)&lt;/script&gt;<!--/email_off-->");
        expect(html).toContain("&quot; onmouseover=&quot;");
        expect(html).not.toContain('" onmouseover="');
    });

    it("escapes the email footer URL and retains a visible unsubscribe link", () => {
        const html = renderUnsubscribeEmailFooter('https://example.com/?token=one&next=two"');
        expect(html).toContain('href="https://example.com/?token=one&amp;next=two&quot;"');
        expect(html).toContain("Unsubscribe from this mailing list");
    });

    it("keeps SES click tracking off the unsubscribe link", () => {
        const html = renderUnsubscribeEmailFooter("https://example.com/");
        expect(html).toContain('<a ses:no-track href="https://example.com/"');
    });
});
