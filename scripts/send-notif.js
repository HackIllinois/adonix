import inquirer from "inquirer";
import axios from "axios";

const options = [
    {
        type: "list",
        name: "host",
        message: "Select host (prod or local):",
        choices: ["https://adonix.hackillinois.org", "http://localhost:3000"],
    },
    {
        type: "password",
        name: "token",
        message: "Enter auth jwt token:",
    },
    {
        type: "list",
        name: "type",
        message: "Select notification topic type:",
        choices: ["role", "foodWave", "eventId", "staffShift"],
    },
    {
        type: "input",
        name: "id",
        message: "Enter notification topic:",
    },
    {
        type: "input",
        name: "title",
        message: "Enter notification title:",
    },
    {
        type: "input",
        name: "body",
        message: "Enter notification body:",
    },
];

const optionsConfirm = [
    {
        type: "confirm",
        name: "confirm",
        message: "Is the above correct?",
    },
];

async function main() {
    const answers = await inquirer.prompt(options);
    const confirm = await inquirer.prompt(optionsConfirm);

    if (!confirm.confirm) {
        return;
    }

    const config = {
        headers: {
            Authorization: answers.token,
        },
    };

    const batchResponse = await axios.post(
        `${answers.host}/notification/batch`,
        {
            title: answers.title,
            body: answers.body,
            [answers.type]: answers.id,
        },
        config,
    );

    if (batchResponse.status != 200) {
        throw new Error(`Failed to get notification batches: ${batchResponse}`);
    }

    const batches = batchResponse.data.batches;

    const sendResponses = await Promise.all(
        batches.map((batchId) =>
            axios.post(
                `${answers.host}/notification/send`,
                {
                    batchId,
                },
                config,
            ),
        ),
    );

    let sent = 0;
    let failed = 0;

    sendResponses.forEach((response) => {
        sent += response.data.sent.length;
        failed += response.data.failed.length;
    });

    console.log(`Notification sent to ${sent}, failed to send to ${failed}`);
}

main();
