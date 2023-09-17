import open from "open"
import inquirer from "inquirer";

// Options for auth token generation
const options = [
	{
		type: "list",
		name: "choice",
		message: "Select an option:",
		choices: [
			"Attendee (Github)",
			"Staff (Google)",
			"Exit"
		]
	}
];


// Process the choice (open the URL to generate JWT token)
async function processChoice(choice) {
	let provider;
	switch (choice) {
		case "Attendee (Github)":
			provider = "github";
			break;
		case "Staff (Google)":
			provider = "google";
			break;
		default:
			return;
	}
	await open(`https://adonix.hackillinois.org/auth/login/${provider}/?device=dev`)
}


// Main function to do this
async function main() {
	inquirer
		.prompt(options)
		.then(async answers => { await processChoice(answers.choice); })
		.catch(error => { console.error(error); });
}

await main();
