import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { SESv2Client, SendBulkEmailCommand, SendEmailCommand } from "@aws-sdk/client-sesv2";
import Config from "../../common/config";
import { sendBulkMail, sendMail } from "./mail-lib";

describe("SES configuration set", () => {
    const original = Config.SES_CONFIGURATION_SET;

    afterEach(() => {
        Config.SES_CONFIGURATION_SET = original;
        jest.restoreAllMocks();
    });

    function captureSends(): unknown[] {
        const sent: unknown[] = [];
        jest.spyOn(SESv2Client.prototype, "send").mockImplementation(async (command: unknown) => {
            sent.push(command);
            if (command instanceof SendBulkEmailCommand) {
                return { BulkEmailEntryResults: [{ Status: "SUCCESS" }] };
            }
            return { MessageId: "id" };
        });
        return sent;
    }

    it("names the configured set on single and bulk sends", async () => {
        Config.SES_CONFIGURATION_SET = "no-click-tracking";
        const sent = captureSends();

        await sendMail("template", "person@example.com");
        await sendBulkMail("template", [{ email: "person@example.com" }]);

        expect(sent[0]).toBeInstanceOf(SendEmailCommand);
        expect((sent[0] as SendEmailCommand).input.ConfigurationSetName).toBe("no-click-tracking");
        expect(sent[1]).toBeInstanceOf(SendBulkEmailCommand);
        expect((sent[1] as SendBulkEmailCommand).input.ConfigurationSetName).toBe("no-click-tracking");
    });

    it("leaves the identity's default set in place when unset", async () => {
        Config.SES_CONFIGURATION_SET = undefined;
        const sent = captureSends();

        await sendMail("template", "person@example.com");
        await sendBulkMail("template", [{ email: "person@example.com" }]);

        expect((sent[0] as SendEmailCommand).input.ConfigurationSetName).toBeUndefined();
        expect((sent[1] as SendBulkEmailCommand).input.ConfigurationSetName).toBeUndefined();
    });

    it("keeps a ses:no-track anchor intact in single and bulk template data", async () => {
        const body = '<a ses:no-track href="https://example.com/?a=1&amp;b=2">Link</a>';
        const sent = captureSends();

        await sendMail("template", "person@example.com", { body });
        await sendBulkMail("template", [{ email: "person@example.com", data: { body } }]);

        const single = (sent[0] as SendEmailCommand).input.Content?.Template?.TemplateData;
        const bulk = (sent[1] as SendBulkEmailCommand).input.BulkEmailEntries?.[0]?.ReplacementEmailContent?.ReplacementTemplate
            ?.ReplacementTemplateData;
        expect(JSON.parse(single!).body).toBe(body);
        expect(JSON.parse(bulk!).body).toBe(body);
    });
});
