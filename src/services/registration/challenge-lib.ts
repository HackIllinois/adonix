/* eslint-disable no-magic-numbers */
import { RegistrationChallenge } from "./registration-schemas";

const PEOPLE = [
    "Zeus",
    "Poseidon",
    "Hades",
    "Ares",
    "Hermes",
    "Apollo",
    "Artemis",
    "Athena",
    "Aphrodite",
    "Hephaestus",
    "Demeter",
    "Dionysus",
    "Hera",
    "Eros",
    "Helios",
    "Selene",
    "Pan",
    "Heracles",
    "Prometheus",
    "Hecate",
    "Persephone",
    "Asclepius",
    "Aeolus",
    "Iris",
    "Nike",
    "Nemesis",
    "Hypnos",
    "Thanatos",
    "Chronos",
    "Rhea",
    "Cronus",
    "Gaia",
    "Uranus",
    "Oceanus",
    "Tethys",
    "Hyperion",
    "Theia",
    "Coeus",
    "Phoebe",
    "Iapetus",
    "Themis",
    "Mnemosyne",
    "Pontus",
    "Tartarus",
    "Nyx",
    "Erebus",
    "Harmonia",
    "Eris",
    "Tyche",
    "Phobos",
    "Deimos",
];

// Generates a challenge
// NOTE: We generate BACKWARDS from the solution in order to not reveal the solution to solve the problem
// So, if you're an attendee trying to solve the challenge by looking at the source code, great attempt but it won't work
export function generateChallenge(): Pick<RegistrationChallenge, "alliances" | "people" | "solution"> {
    // Random solution [-100_000_000, 100_000_000]
    const solution = Math.floor(Math.random() * 100_000_000) + 50_000_000;

    // Divide people into random groups
    const remainingPeople = [...PEOPLE];
    remainingPeople.sort(() => Math.random() - 0.5); // Randomly sort
    const groups = [];

    // One quarter to half group (random)
    groups.push(
        remainingPeople.splice(
            0,
            Math.floor(remainingPeople.length / 4) + Math.floor(Math.random() * (remainingPeople.length / 4)),
        ),
    );
    // A group of 5
    groups.push(remainingPeople.splice(0, 5));
    // Half of remaining into groups of 3
    for (let i = 0; i < Math.floor(remainingPeople.length / 3); i += 3) {
        groups.push(remainingPeople.splice(0, 3));
    }
    // Half of remaining into groups of 2
    for (let i = 0; i < Math.floor(remainingPeople.length / 2); i += 2) {
        groups.push(remainingPeople.splice(0, 2));
    }
    // Rest into groups of 1
    for (let i = 0; i < remainingPeople.length; i++) {
        groups.push(remainingPeople.splice(0, 1));
    }

    // Figure out weights for each person
    const people: Map<string, number> = new Map();
    const solutionGroup = groups[Math.floor(Math.random() * groups.length)];
    for (const group of groups) {
        // The goal sum of the group is the solution if it's the solution group, or some random about lower than that
        const groupSum = group === solutionGroup ? solution : solution - Math.floor(Math.random() * 50_000_000);
        // Weights start off evenly dividing group sum
        const groupWeights = group.map(() => Math.floor(groupSum / group.length));
        for (let n = 0; n < 10; n++) {
            for (let i = 0; i < groupWeights.length; i++) {
                // Apply offsets, where we both add and subtract the same value between two nodes in the group
                // This ensures the sum stays the same, but prevents all the values being just groupSum / length
                // Also makes it non-reversible
                const j = Math.floor(Math.random() * group.length);
                const offset = Math.floor(Math.random() * 50_000_000);
                groupWeights[i]! += offset;
                groupWeights[j]! -= offset;
            }
        }

        // Since we floor what each person gets, we'll be off by a little bit sometimes
        // This corrects that
        groupWeights[0]! -= groupWeights.reduce((acc, curr) => acc + curr) - groupSum;

        // Update each person in the group
        for (let i = 0; i < group.length; i++) {
            people.set(group[i]!, groupWeights[i]!);
        }
    }

    // Make edges
    const alliances: [string, string][] = [];

    const addAlliance = (a: string, b: string): void => {
        // Check for duplicates
        for (const alliance of alliances) {
            if ((alliance[0] == a && alliance[1] == b) || (alliance[1] == a && alliance[0] == b)) {
                return;
            }
        }

        alliances.push([a, b]);
    };

    for (const group of groups) {
        // If len > 1, add edges that at least ensure connectivity
        // For 2 and 3 this is a straight line, for the rest it's spread out
        if (group.length == 1) {
            continue;
        } else if (group.length == 2) {
            addAlliance(group[0]!, group[1]!);
        } else if (group.length == 3) {
            addAlliance(group[0]!, group[1]!);
            addAlliance(group[1]!, group[2]!);
        } else if (group.length == 4) {
            addAlliance(group[0]!, group[3]!);
            addAlliance(group[0]!, group[1]!);
            addAlliance(group[1]!, group[2]!);
        } else if (group.length == 5) {
            addAlliance(group[0]!, group[4]!);
            addAlliance(group[0]!, group[1]!);
            addAlliance(group[1]!, group[2]!);
            addAlliance(group[3]!, group[4]!);
        } else {
            for (let i = 0; i < group.length; i += 3) {
                addAlliance(group[i]!, group[(i + 3) % group.length]!);
                addAlliance(group[i]!, group[(i + 1) % group.length]!);
                addAlliance(group[(i + 2) % group.length]!, group[(i + 3) % group.length]!);
            }
        }

        // Add random edges
        for (const person1 of group) {
            for (const person2 of group) {
                if (person1 == person2 || Math.random() < 0.1) {
                    continue;
                }
                addAlliance(person1, person2);
            }
        }
    }

    return { people, alliances, solution };
}
