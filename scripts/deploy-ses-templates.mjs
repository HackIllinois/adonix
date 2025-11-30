import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
    SESv2Client,
    CreateEmailTemplateCommand,
    UpdateEmailTemplateCommand,
    GetEmailTemplateCommand,
} from "@aws-sdk/client-sesv2";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const TEMPLATES_DIR = join(__dirname, "..", "src", "templates");

const sesClient = new SESv2Client({ region: AWS_REGION });

function createTemplate(templateDir) {
    const metadataPath = join(templateDir, "metadata.json");
    const bodyHtmlPath = join(templateDir, "body.html");
    const bodyTxtPath = join(templateDir, "body.txt");

    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));

    if (
        !metadata.TemplateName ||
        typeof metadata.TemplateName !== "string" ||
        !metadata.SubjectPart ||
        typeof metadata.SubjectPart !== "string"
    ) {
        throw new Error(`Invalid metadata in ${metadataPath}`);
    }

    const htmlContent = readFileSync(bodyHtmlPath, "utf-8");
    const textContent = readFileSync(bodyTxtPath, "utf-8");

    return [metadata, htmlContent, textContent];
}

async function templateExists(templateName) {
    try {
        await sesClient.send(new GetEmailTemplateCommand({ TemplateName: templateName }));
        return true;
    } catch (error) {
        if (error.name === "NotFoundException") {
            return false;
        }
        throw error;
    }
}

async function deployTemplate(templateDir, templateName) {
    const [metadata, htmlContent, textContent] = createTemplate(templateDir);

    const templateContent = {
        Subject: metadata.SubjectPart,
        Html: htmlContent,
        Text: textContent,
    };

    const exists = await templateExists(templateName);

    const command = exists
        ? new UpdateEmailTemplateCommand({
              TemplateName: metadata.TemplateName,
              TemplateContent: templateContent,
          })
        : new CreateEmailTemplateCommand({
              TemplateName: metadata.TemplateName,
              TemplateContent: templateContent,
          });

    await sesClient.send(command);
}

async function main() {
    const entries = readdirSync(TEMPLATES_DIR);
    const templateDirs = entries.filter((entry) => {
        const fullPath = join(TEMPLATES_DIR, entry);
        return statSync(fullPath).isDirectory();
    });

    await Promise.all(
        templateDirs.map((templateName) => {
            const templateDir = join(TEMPLATES_DIR, templateName);
            return deployTemplate(templateDir, templateName);
        }),
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
