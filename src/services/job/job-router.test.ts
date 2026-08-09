import { describe, expect, it, beforeEach } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { delAsAdmin, delAsAttendee, getAsAttendee, postAsAdmin, postAsAttendee, putAsAdmin } from "../../common/testTools";

const TEST_POSTING = {
    companyName: "Example Corp",
    logoUrl: "https://example.com/logo.png",
    jobTitle: "Software Engineer Intern",
    jobDescription: "Build products with our engineering team.",
    applicationUrl: "https://example.com/careers/intern",
};

beforeEach(async () => {
    await Models.JobPosting.deleteMany({});
});

describe("GET /job/", () => {
    it("is public and sorts postings by company and title", async () => {
        await Models.JobPosting.create({ ...TEST_POSTING, companyName: "Zeta", jobTitle: "Analyst" });
        await Models.JobPosting.create({ ...TEST_POSTING, companyName: "Alpha", jobTitle: "Engineer" });
        await Models.JobPosting.create({ ...TEST_POSTING, companyName: "Alpha", jobTitle: "Designer" });

        const response = await getAsAttendee("/job/").expect(StatusCode.SuccessOK);
        expect(
            JSON.parse(response.text).map((posting: { companyName: string; jobTitle: string }) => [
                posting.companyName,
                posting.jobTitle,
            ]),
        ).toEqual([
            ["Alpha", "Designer"],
            ["Alpha", "Engineer"],
            ["Zeta", "Analyst"],
        ]);
    });
});

describe("job posting administration", () => {
    it("only permits admins to create postings", async () => {
        await postAsAttendee("/job/").send(TEST_POSTING).expect(StatusCode.ClientErrorForbidden);
        const response = await postAsAdmin("/job/").send(TEST_POSTING).expect(StatusCode.SuccessCreated);
        expect(JSON.parse(response.text)).toMatchObject(TEST_POSTING);
        expect(JSON.parse(response.text)).toHaveProperty("_id");
    });

    it("validates required text and URL fields", async () => {
        await postAsAdmin("/job/")
            .send({ ...TEST_POSTING, companyName: " ", logoUrl: "not-a-url" })
            .expect(StatusCode.ClientErrorBadRequest);
    });

    it("updates an existing posting and returns not found for a missing posting", async () => {
        const posting = await Models.JobPosting.create(TEST_POSTING);
        await putAsAdmin(`/job/${posting._id.toString()}/`)
            .send({ ...TEST_POSTING, jobTitle: "New Title" })
            .expect(StatusCode.SuccessOK)
            .expect((response) => expect(JSON.parse(response.text)).toMatchObject({ jobTitle: "New Title" }));

        await putAsAdmin("/job/65f0d1d7f6201f6a63dbf53f/").send(TEST_POSTING).expect(StatusCode.ClientErrorNotFound);
    });

    it("only permits admins to delete and returns not found when absent", async () => {
        const posting = await Models.JobPosting.create(TEST_POSTING);
        await delAsAttendee(`/job/${posting._id.toString()}/`).expect(StatusCode.ClientErrorForbidden);
        await delAsAdmin(`/job/${posting._id.toString()}/`).expect(StatusCode.SuccessOK);
        await delAsAdmin(`/job/${posting._id.toString()}/`).expect(StatusCode.ClientErrorNotFound);
    });
});
